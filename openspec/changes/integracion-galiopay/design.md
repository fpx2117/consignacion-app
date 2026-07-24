# Diseno: Integracion de pagos proveedor-agnostica (GalioPay inicial)

## Enfoque Tecnico

El cambio introduce una capa de pagos proveedor-agnostica para el checkout publico, manteniendo `CheckoutIntent` como entidad de orquestacion y reutilizando el patron actual de confirmacion asincronica por webhook.

La implementacion se apoya en tres principios:

1. Separar logica de proveedor (GalioPay) de logica de negocio (checkout, venta, stock).
2. Mantener compatibilidad hacia atras con flujo Mercado Pago existente.
3. Habilitar rollout y rollback por feature flags sin migraciones destructivas.

En terminos de arquitectura, las rutas API (`/api/public/checkout`, `/api/public/checkout/status`, `/api/webhooks/*`) dejan de invocar SDKs directos y pasan a resolver un `PaymentProviderAdapter` segun `paymentProvider` efectivo del `CheckoutIntent`.

## Decisiones de Arquitectura

### Decision: Introducir modulo `src/lib/payments` con contrato comun

**Eleccion**: crear una interfaz comun (`PaymentProviderAdapter`) con operaciones minimas: crear link, consultar estado remoto y parsear webhook.

**Alternativas consideradas**:

- Continuar con integraciones directas por ruta (`mercadopago` hardcoded) y copiar estructura para GalioPay.
- Crear un unico servicio procedural con `switch(provider)` sin adapters.

**Justificacion**: el repositorio ya tiene flujos y webhooks acoplados a proveedor en rutas; un contrato explicito reduce acoplamiento, facilita agregar un segundo proveedor y baja riesgo de regresion en checkout publico.

### Decision: Mantener `CheckoutIntent` como source of truth del proceso

**Eleccion**: extender `CheckoutIntent` para almacenar trazabilidad multi-proveedor (`paymentProvider`, IDs externos, estados remotos y metadata de sincronizacion), sin crear una tabla nueva de intents.

**Alternativas consideradas**:

- Crear una tabla nueva por proveedor (`GalioPayIntent`, `MercadoPagoIntent`).
- Mover toda metadata externa a un event store separado.

**Justificacion**: `CheckoutIntent` ya es el eje del flujo V2, tiene indices y estados utiles, y ya participa en la idempotencia de webhooks. Extenderlo minimiza costo de migracion y complejidad operativa.

### Decision: Idempotencia por llave de evento + bloqueo transaccional

**Eleccion**: aplicar idempotencia en dos niveles:

- Unicidad de pago externo por proveedor (ej: `providerPaymentId` o combinacion `provider + providerPaymentId`).
- Lock transaccional por `externalReference` (mismo patron de `pg_advisory_xact_lock` ya usado en webhook MP).

**Alternativas consideradas**:

- Solo deduplicar in-memory.
- Solo deduplicar por estado terminal del intent.

**Justificacion**: los proveedores reintentan webhooks y pueden entregar eventos fuera de orden. La combinacion de constraint + lock serializable protege contra doble venta/doble descuento de stock.

### Decision: Resolver proveedor efectivo por jerarquia de configuracion

**Eleccion**: definir orden de resolucion:

1. `paymentProvider` recibido en `POST /api/public/checkout` (si permitido).
2. proveedor por defecto de sucursal/configuracion.
3. fallback a `MERCADOPAGO` para compatibilidad.

**Alternativas consideradas**:

- Forzar siempre proveedor desde frontend.
- Forzar siempre proveedor desde backend sin permitir override.

**Justificacion**: permite rollout gradual por sucursal y pruebas controladas de GalioPay sin romper consumidores actuales que no envian `paymentProvider`.

### Decision: Seguridad centralizada en backend para secretos y webhooks

**Eleccion**:

- Guardar credenciales GalioPay (`clientId`, `apiKey`, opcional `webhookSecret`) solo server-side.
- Enmascarar secretos en `/api/settings/general` como ya se hace con `mpAccessTokenTienda`.
- Validar autenticidad de webhook de GalioPay segun contrato disponible (firma HMAC o token compartido) antes de tocar DB.

**Alternativas consideradas**:

- Exponer `clientId`/`apiKey` al cliente para crear links directo.
- Aceptar webhooks sin validacion criptografica.

**Justificacion**: evita leakage de credenciales y reduce riesgo de eventos falsos que marquen intents como pagados.

### Decision: Feature flag explicito para activar GalioPay

**Eleccion**: agregar flags de despliegue controlado:

- `featureFlags.galioPayEnabled`
- `featureFlags.publicCheckoutProviderAgnostic`

**Alternativas consideradas**:

- Activacion implicita por presencia de credenciales.

**Justificacion**: permite rollback inmediato sin revertir migraciones y sin deshabilitar checkout completo.

## Flujo de Datos

```text
Cliente (Checkout Publico)
  -> POST /api/public/checkout
      -> valida carrito/cliente/sucursal
      -> resuelve proveedor efectivo (GALIOPAY|MERCADOPAGO)
      -> crea CheckoutIntent(status=INITIATED, paymentProvider=...)
      -> PaymentProviderAdapter.createPaymentLink(intent)
      -> guarda providerCheckoutId/proof/url
      -> responde { init_point, checkout_token }

GalioPay/MercadoPago
  -> Usuario paga en link externo
  -> Proveedor envia webhook a /api/webhooks/{provider}
      -> valida autenticidad (firma/token)
      -> adapter.parseWebhookEvent(raw)
      -> obtiene referenceId/externalReference + providerPaymentId + estado
      -> lock transaccional por externalReference
      -> si estado aprobado y no procesado:
           - valida stock
           - crea Venta + VentaDetalle + Pago (+ Envio si aplica)
           - marca CheckoutIntent=PAID + processedAt + providerPaymentId
         si estado final fallido:
           - marca FAILED/CANCELLED/EXPIRED + failureReason
      -> responde 200 idempotente

Cliente (polling)
  -> GET /api/public/checkout/status?token=chk_...
      -> lee CheckoutIntent
      -> opcional: si estado no terminal y TTL superado, consulta adapter.getPaymentStatus()
      -> responde estado publico normalizado { PENDING|PAID|FAILED }
```

## Cambios en Archivos

| Archivo                                                  | Accion    | Descripcion                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                   | Modificar | Extender `CheckoutIntentProvider` con `GALIOPAY`; agregar campos provider-agnosticos (`providerPaymentId`, `providerLinkId`, `providerStatus`, `providerRawLastEvent`, `lastSyncedAt`, `webhookProcessedAt`, `idempotencyKey`) y mantener campos MP legacy para compatibilidad temporal. |
| `prisma/migrations/*_integracion_galiopay/migration.sql` | Crear     | Migracion para enum + columnas + indices/constraints de idempotencia.                                                                                                                                                                                                                    |
| `src/lib/paymentConfig.ts`                               | Modificar | Incluir bloque `galiopay` (baseUrl, clientId, apiKey, webhookSecret opcional) y feature flags de rollout.                                                                                                                                                                                |
| `src/lib/payments/types.ts`                              | Crear     | Tipos comunes de proveedores, estados normalizados y contratos de request/response internos.                                                                                                                                                                                             |
| `src/lib/payments/provider.ts`                           | Crear     | Fabrica/registry para resolver adapter por `CheckoutIntentProvider`.                                                                                                                                                                                                                     |
| `src/lib/payments/stateMapper.ts`                        | Crear     | Mapeo de estados externos -> `CheckoutIntentStatus` con fallback controlado.                                                                                                                                                                                                             |
| `src/lib/payments/galiopay.adapter.ts`                   | Crear     | Implementacion del adapter GalioPay (create link, get payment, parse webhook).                                                                                                                                                                                                           |
| `src/lib/payments/mercadopago.adapter.ts`                | Crear     | Encapsular logica MP existente bajo contrato comun (sin romper webhook actual en primera fase).                                                                                                                                                                                          |
| `src/lib/payments/checkoutProcessor.ts`                  | Crear     | Orquestacion transaccional provider-agnostica para marcar intent, crear venta/pago y aplicar idempotencia.                                                                                                                                                                               |
| `src/app/api/public/checkout/route.ts`                   | Modificar | Reemplazar creacion directa de preference MP por uso de `PaymentProviderAdapter`; persistir metadata provider-agnostica.                                                                                                                                                                 |
| `src/app/api/public/checkout/status/route.ts`            | Modificar | Soportar polling normalizado multi-proveedor y sincronizacion eventual opcional contra proveedor.                                                                                                                                                                                        |
| `src/app/api/webhooks/galiopay/route.ts`                 | Crear     | Endpoint webhook GalioPay con validacion de autenticidad, parseo y procesamiento idempotente.                                                                                                                                                                                            |
| `src/app/api/webhooks/mercadopago/route.ts`              | Modificar | Reusar `checkoutProcessor` para rama checkout publico y evitar duplicar reglas entre proveedores.                                                                                                                                                                                        |
| `src/app/api/settings/general/route.ts`                  | Modificar | Permitir guardar/enmascarar credenciales GalioPay por sucursal sin exponer `apiKey`.                                                                                                                                                                                                     |
| `src/lib/apiService.ts`                                  | Modificar | Extender contrato de `createPublicCheckout` para aceptar `paymentProvider` opcional, manteniendo backward compatibility.                                                                                                                                                                 |

## Interfaces / Contratos

```ts
// src/lib/payments/types.ts
export type PaymentProvider = "MERCADOPAGO" | "GALIOPAY";

export type NormalizedPaymentStatus =
  "INITIATED" | "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED";

export interface CreatePaymentLinkInput {
  provider: PaymentProvider;
  externalReference: string;
  amount: number;
  currency: "ARS";
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    currencyId: "ARS";
  }>;
  customer?: { name?: string; email?: string };
  backUrls?: { success?: string; failure?: string; pending?: string };
  notificationUrl?: string;
  sandbox?: boolean;
}

export interface CreatePaymentLinkResult {
  checkoutUrl: string;
  providerLinkId?: string;
  proofToken?: string;
  raw: unknown;
}

export interface PaymentStatusResult {
  providerPaymentId: string;
  providerStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
  referenceId?: string;
  raw: unknown;
}

export interface ParsedWebhookEvent {
  eventId?: string;
  providerPaymentId?: string;
  referenceId?: string;
  providerStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
  raw: unknown;
}

export interface PaymentProviderAdapter {
  createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<CreatePaymentLinkResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResult>;
  parseWebhookEvent(
    payload: string,
    headers: Headers,
  ): Promise<ParsedWebhookEvent | null>;
}
```

### Contrato API publico (sin ruptura)

`POST /api/public/checkout` (request incremental):

```json
{
  "items": [{ "id": 1, "quantity": 2 }],
  "clienteData": { "nombre": "Ana", "email": "ana@correo.com" },
  "envioData": { "costo": 1200, "metodoEnvio": "DOMICILIO" },
  "sucursalId": 1,
  "paymentProvider": "GALIOPAY"
}
```

`POST /api/public/checkout` (response):

```json
{
  "data": {
    "init_point": "https://pay.galio.app/payment/...",
    "checkout_token": "chk_abc123",
    "payment_provider": "GALIOPAY"
  }
}
```

`GET /api/public/checkout/status?token=chk_abc123` (response):

```json
{
  "data": {
    "status": "PENDING",
    "ventaId": 123,
    "reason": "Pago rechazado"
  }
}
```

### Contrato webhook GalioPay (normalizacion esperada)

`POST /api/webhooks/galiopay`

- Entrada: payload de evento de GalioPay (`approved`/`refunded`/otros).
- Salida: `200 { "received": true }` aun en duplicados (idempotente).
- Rechazo: `403` si firma/token invalido.

## Estrategia de Pruebas

| Capa        | Que Probar                                    | Enfoque                                                                                                           |
| ----------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Unitaria    | `stateMapper` para GalioPay y MP              | Tabla de casos (`approved`, `pending`, `cancelled`, desconocido) y verificacion de fallback a `PENDING` + reason. |
| Unitaria    | `galiopay.adapter`                            | Mock de `fetch` para validar headers (`Authorization`, `x-client-id`) y parseo de respuestas/errores.             |
| Unitaria    | `provider.ts` factory                         | Resolucion correcta por provider + error controlado para provider no soportado.                                   |
| Integracion | `POST /api/public/checkout`                   | Crea `CheckoutIntent` con provider elegido, llama adapter, persiste IDs externos y responde contrato estable.     |
| Integracion | `POST /api/webhooks/galiopay`                 | Firma valida -> actualiza estado; webhook duplicado -> no duplica `Venta` ni `Pago`.                              |
| Integracion | `POST /api/webhooks/galiopay` estado aprobado | Reusa `checkoutProcessor` y crea `Venta`/`Pago`/movimientos stock en transaccion serializable.                    |
| Integracion | `GET /api/public/checkout/status`             | Mapea estados internos terminales y no terminales, respeta formato publico sin exponer detalles sensibles.        |
| Regresion   | Webhook MP existente                          | Garantizar que `MERCADOPAGO` no cambia comportamiento funcional en rollout inicial.                               |
| E2E         | Checkout publico GalioPay sandbox             | Crear link, simular aprobacion webhook, verificar estado final `PAID` y venta creada una sola vez.                |

## Migracion / Despliegue

### Fase 0 - Preparacion

1. Agregar columnas/enum en Prisma con migracion forward-compatible.
2. Desplegar codigo con adapters y rutas nuevas detras de flags (`galioPayEnabled=false`).

### Fase 1 - Activacion controlada

1. Cargar credenciales GalioPay por `settings/general` en sucursal piloto.
2. Activar `galioPayEnabled=true` y `publicCheckoutProviderAgnostic=true` solo en entorno de prueba/sucursal piloto.
3. Configurar webhook GalioPay hacia `/api/webhooks/galiopay` (HTTPS publico).

### Fase 2 - Produccion gradual

1. Habilitar proveedor por cohortes de sucursales.
2. Monitorear metricas clave por proveedor: links creados, pagos aprobados, webhooks rechazados, intents en timeout, duplicados evitados.
3. Mantener fallback de proveedor default a MP durante toda la fase.

### Rollback operativo por feature flag

- Desactivar `galioPayEnabled` y/o forzar provider default a `MERCADOPAGO`.
- Mantener endpoint webhook GalioPay activo devolviendo `200` sin procesar (opcional) para evitar reintentos agresivos del proveedor.
- No requiere revertir migracion para recuperar operacion estable.

### Observabilidad

- Logging estructurado por evento con campos: `provider`, `externalReference`, `providerPaymentId`, `intentId`, `eventId`, `normalizedStatus`.
- Contadores recomendados: `payment_link_created_total`, `webhook_received_total`, `webhook_invalid_signature_total`, `checkout_paid_total`, `checkout_failed_total`, `idempotent_skip_total`.
- Alertas: tasa de `webhook_invalid_signature_total` alta, intents en `INITIATED/PENDING` por encima de umbral temporal, divergencia entre pagos aprobados y ventas creadas.

## Preguntas Abiertas

- [ ] GalioPay firma webhooks con HMAC propio o solo token compartido? Definir validacion exacta para `parseWebhookEvent`.
- [ ] Se necesita soportar evento `refunded` en esta iteracion para reflejar devoluciones en dominio interno?
- [ ] Los campos GalioPay deben guardarse por sucursal en `Configuracion` o en tabla separada de credenciales cifradas?
- [ ] En polling de `checkout/status`, cual es la ventana maxima para sincronizacion activa con proveedor antes de responder solo DB local?
