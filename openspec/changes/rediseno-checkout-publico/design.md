# Diseño: Rediseño de Proceso de Checkout Publico

## Enfoque Tecnico

El checkout publico se rediseña a un flujo en dos fases para evitar ventas fantasma:

1. **Fase de intencion de pago**: se valida carrito y se crea una intencion persistida (sin crear `Venta`).
2. **Fase de confirmacion asincronica**: el webhook confirmado e idempotente crea la `Venta`, descuenta stock y registra `Pago`.

Con este enfoque, la base solo registra venta efectiva cuando el pago fue aprobado, manteniendo integridad contable y operativa.

## Decisiones de Arquitectura

### Decision: Introducir entidad de intencion de checkout

**Eleccion**: agregar un modelo `CheckoutIntent` para persistir estado del checkout publico antes del pago.

**Alternativas consideradas**:
- Seguir creando `Venta` en estado pendiente.
- No persistir nada y confiar solo en `external_reference`.

**Justificacion**: separar intencion de venta real evita contaminar libros con operaciones no cobradas y habilita idempotencia robusta de webhook.

### Decision: Crear `Venta` solo en webhook aprobado

**Eleccion**: mover creacion de `Venta`, `VentaDetalle`, `Pago` y `Envio` al webhook cuando MP confirme `approved`.

**Alternativas consideradas**:
- Crear `Venta` al inicio y luego actualizar estado.
- Confirmar por return URL en frontend.

**Justificacion**: el unico origen de verdad de pago es la notificacion del proveedor; la return URL no garantiza cobro final.

### Decision: Idempotencia por pago externo

**Eleccion**: registrar `mpPaymentId` unico y estados terminales en `CheckoutIntent` para procesar cada pago una sola vez.

**Alternativas consideradas**:
- Solo lock en memoria.
- Reintentos sin llave unica.

**Justificacion**: los webhooks se reintentan por naturaleza; se requiere deduplicacion en base de datos.

### Decision: Validar stock al momento de confirmar pago

**Eleccion**: no reservar stock en la creacion de intencion; validar y descontar atomico al aprobar pago.

**Alternativas consideradas**:
- Reserva de stock con TTL.

**Justificacion**: minimiza complejidad y evita bloqueos largos; se documenta manejo de excepcion por falta de stock post-pago.

## Flujo de Datos

```text
Cliente Web
  -> POST /api/public/checkout
       -> valida config/sucursal/items/precios
       -> crea CheckoutIntent(status=INITIATED)
       -> crea Preference MP (external_reference con intentId)
       -> responde init_point

Mercado Pago
  -> POST /api/webhooks/mercadopago
       -> valida firma
       -> obtiene payment detail
       -> resuelve CheckoutIntent por intentId/external_reference
       -> si approved y no procesado:
            - transaccion serializable
            - valida y descuenta stock atomico
            - crea Venta + VentaDetalle + Pago + Envio
            - marca CheckoutIntent=PAID + processedAt
       -> si rejected/cancelled:
            - marca CheckoutIntent=FAILED
```

## Cambios en Archivos

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modificar | Agregar modelo `CheckoutIntent` y enums de estado/proveedor. Indices unicos para idempotencia (`externalReference`, `mpPaymentId`). |
| `src/app/api/public/checkout/route.ts` | Modificar | Dejar de crear `Venta`. Crear `CheckoutIntent`, persistir snapshot de carrito/envio y generar preference con referencia estable. |
| `src/app/api/webhooks/mercadopago/route.ts` | Modificar | Agregar rama para checkout publico: verificar evento, resolver intencion, aplicar idempotencia y crear venta atomicamente. |
| `src/lib/mercadopago.ts` (opcional) | Crear/Modificar | Encapsular consulta de detalle de pago y parseo de `external_reference`. |
| `src/app/api/public/checkout/status/route.ts` | Crear | Endpoint para polling de estado de checkout por token publico del intento (sin exponer IDs internos). |

## Interfaces / Contratos

```ts
// Nuevo contrato persistido
type CheckoutIntentStatus =
  | "INITIATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

interface CheckoutIntentPayload {
  sucursalId: number;
  clienteSnapshot: {
    nombre: string;
    email: string;
    documento?: string;
    telefono?: string;
    direccion?: string;
    provincia?: string;
    localidad?: string;
    codigoPostal?: string;
  };
  items: Array<{
    productoId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  envio?: {
    metodoEnvio: string;
    costo: number;
    direccionEnvio?: Record<string, string>;
  };
  totals: {
    subtotal: number;
    interes: number;
    envio: number;
    total: number;
  };
}
```

`POST /api/public/checkout` respuesta:

```json
{
  "data": {
    "init_point": "https://...",
    "preference_id": "...",
    "checkout_token": "public-token"
  }
}
```

`GET /api/public/checkout/status?token=...` respuesta:

```json
{
  "data": {
    "status": "PENDING | PAID | FAILED",
    "ventaId": 123,
    "reason": "stock_insuficiente"
  }
}
```

## Estrategia de Pruebas

| Capa | Que Probar | Enfoque |
|------|------------|---------|
| Unitaria | Parseo y validacion de `external_reference`; transiciones de `CheckoutIntent` | Tests puros de funciones de dominio (idempotencia y maquina de estados) |
| Integracion | `POST /public/checkout` no crea `Venta`; webhook `approved` crea `Venta` una sola vez | Tests API con DB de test y mocks de MP |
| Integracion | Reintento de webhook con mismo `mpPaymentId` | Verificar deduplicacion por unique + respuesta idempotente |
| Integracion | Pago aprobado con stock insuficiente | Intent `FAILED`, sin `Venta`, motivo registrado |
| E2E | Compra completa desde tienda publica hasta estado final | Flujo browser + simulacion de webhook |

## Migracion / Despliegue

Despliegue en dos fases con feature flag `PUBLIC_CHECKOUT_V2`:

1. Migrar esquema con `CheckoutIntent` y columnas/indices necesarios.
2. Activar escritura dual opcional en entorno de prueba (crear intent + flujo actual solo observabilidad).
3. Activar V2 en produccion: `POST /public/checkout` deja de crear `Venta`.
4. Monitorear metricas: intents creados, pagos aprobados, ventas creadas, fallos por stock, idempotencia.
5. Retirar logica legacy y limpiar ventas pendientes historicas si existieran.

### Rollback seguro (Fase 1)

- Si solo se aplico la migracion y el flag sigue `PUBLIC_CHECKOUT_V2=false`, el rollback operativo recomendado es mantener la tabla sin uso y revertir codigo aplicativo.
- Evitar `prisma migrate reset` en ambientes con datos; usar rollback por deploy de codigo previo + flag desactivado.
- Si se requiere revertir estrictamente el esquema, ejecutar script SQL manual controlado:

```sql
ALTER TABLE "CheckoutIntent" DROP CONSTRAINT IF EXISTS "CheckoutIntent_ventaId_fkey";
DROP TABLE IF EXISTS "CheckoutIntent";
DROP TYPE IF EXISTS "CheckoutIntentProvider";
DROP TYPE IF EXISTS "CheckoutIntentStatus";
```

- Validar despues del rollback: `npx prisma migrate status` y smoke test del checkout legacy.

## Preguntas Abiertas

- [ ] Se acepta politica de no reserva de stock (con posible fallo post-pago) o se requiere reserva temporal?
- [ ] Ante pago aprobado sin stock, el sistema debe iniciar devolucion automatica o pasar a cola operativa/manual?
- [ ] Cuanto tiempo de expiracion debe tener `CheckoutIntent` sin pago (ej. 30 min, 2 h, 24 h)?
