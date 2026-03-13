# Propuesta: Integracion de pagos proveedor-agnostica (GalioPay inicial)

## Intencion

Incorporar una API de pagos operativa para el sistema de consignacion que permita crear links de pago, consultar estado de cobros y administrar el ciclo de vida de transacciones sin acoplar la aplicacion a un unico proveedor. El primer proveedor sera GalioPay, pero el diseno debe permitir sumar otros proveedores sin reescribir los flujos de negocio existentes.

## Alcance

### Dentro del alcance
- Definir una capa de proveedor de pagos en backend para unificar operaciones: crear link, consultar estado, normalizar estados y registrar eventos.
- Integrar GalioPay como primer proveedor usando credenciales de servidor (`Client ID` + `API Key`) sin exponer secretos al frontend.
- Extender el flujo de checkout publico existente para soportar `paymentProvider` configurable y crear links de pago con proveedor seleccionado.
- Incorporar consulta de estado para operacion interna y para checkout publico (polling/control de estado por token o referencia).
- Incorporar recepcion de webhooks de proveedor para actualizar `CheckoutIntent` de forma idempotente y auditable.
- Definir persistencia minima para trazabilidad operativa (IDs externos, estado remoto, errores y timestamps de sincronizacion).

### Fuera del alcance
- Migrar o reemplazar completamente Mercado Pago y PayPal existentes en esta primera iteracion.
- Implementar billeteras, cuotas avanzadas, antifraude o conciliacion contable avanzada.
- Crear una UI nueva completa de administracion de pagos; solo ajustes puntuales necesarios para operar el flujo.
- Soporte mobile nativo dedicado (SDK) mas alla de usar links de pago en web/movil via URLs.

## Enfoque

Se propone un enfoque por abstraccion de proveedor en servidor:

1. Mantener `CheckoutIntent` como entidad central de orquestacion y extenderla para interoperar con multiples proveedores.
2. Crear un contrato comun en `src/lib` (adapter/facade) con operaciones estandar (`createPaymentLink`, `getPaymentStatus`, `parseWebhookEvent`).
3. Implementar el adapter de GalioPay sobre ese contrato, mapeando estados remotos a estados internos (`INITIATED`, `PENDING`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`).
4. Reusar rutas existentes de checkout/status, agregando seleccion de proveedor y validaciones para no romper compatibilidad con flujos actuales.
5. Gestionar secretos solo en backend con variables de entorno y validacion de configuracion; nunca exponer `API Key` en respuestas ni clientes publicos.
6. Procesar webhooks con verificacion de autenticidad (firma/token segun proveedor), idempotencia y bloqueo transaccional para evitar doble procesamiento.

## Areas afectadas

| Area | Impacto | Descripcion |
|------|---------|-------------|
| `prisma/schema.prisma` | Modificado | Extensiones en `CheckoutIntent` y enum `CheckoutIntentProvider` para soportar `GALIOPAY` y metadata operativa de proveedor. |
| `prisma/migrations/` | Nuevo | Migracion para cambios de schema vinculados a provider multi-pasarela. |
| `src/lib/paymentConfig.ts` | Modificado | Alta de configuracion validada para GalioPay (`clientId`, `apiKey`, endpoints y/o webhook secret). |
| `src/lib/` (nuevo modulo `payments/`) | Nuevo | Contrato proveedor-agnostico + adapter GalioPay + mapeo de estados/errores. |
| `src/app/api/public/checkout/route.ts` | Modificado | Creacion de checkout link via adapter segun proveedor seleccionado/configurado. |
| `src/app/api/public/checkout/status/route.ts` | Modificado | Consulta/normalizacion de estado de pago compatible con multiples proveedores. |
| `src/app/api/webhooks/` (nuevo `galiopay/route.ts`) | Nuevo | Recepcion y procesamiento de eventos de GalioPay con validacion e idempotencia. |
| `src/lib/apiService.ts` | Modificado | Ajustes de endpoints/tipos para mantener contrato cliente con estado de checkout. |
| `src/app/api/settings/general/route.ts` | Modificado | Politica segura para guardar/enmascarar credenciales operativas de tienda/proveedor. |

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|--------------|------------|
| Doble impacto de webhook o reintentos del proveedor | Media | Idempotencia por `externalReference` + `paymentId` y transacciones serializables en actualizacion de estado. |
| Desalineacion de estados entre proveedor y dominio interno | Media | Tabla/mapeo explicito de estados y fallback controlado a `PENDING` con trazabilidad de causa. |
| Exposicion accidental de secretos en logs o respuestas | Baja | Sanitizar logs, enmascarar credenciales en APIs de configuracion y validar que solo backend use `API Key`. |
| Acoplamiento accidental a GalioPay pese al objetivo multi-proveedor | Media | Definir contrato abstracto previo y exigir que rutas consuman interfaz comun, no SDK directo. |
| Impacto en flujo publico existente de checkout | Media | Mantener compatibilidad retro, tests de regresion sobre flujo Mercado Pago actual y rollout gradual por feature flag. |

## Plan de Reversion (Rollback)

1. Desactivar GalioPay via feature flag/config y forzar proveedor previo por defecto en checkout.
2. Mantener rutas y modelo existentes funcionando con Mercado Pago mientras se omite procesamiento GalioPay.
3. Deshabilitar webhook GalioPay (ruta y configuracion externa) para detener cambios de estado entrantes.
4. Si el cambio de schema afecta estabilidad, revertir migracion asociada segun procedimiento Prisma y restaurar backup previo.

## Dependencias

- Credenciales activas de GalioPay (`Client ID` + `API Key`) para ambiente de prueba y produccion.
- Documentacion y contrato de API/webhooks de GalioPay (payloads, firma, estados y codigos de error).
- Variables de entorno y secretos del despliegue (backend) actualizados con politicas de seguridad.
- Endpoint publico HTTPS para recepcion de webhooks en entornos donde se valide firma/origen.

## Criterios de exito

- [ ] El sistema puede crear links de pago con GalioPay desde backend sin exponer secretos al cliente.
- [ ] El estado de un checkout se puede consultar de forma consistente por API interna/publica con contrato estable.
- [ ] Los webhooks de GalioPay actualizan `CheckoutIntent` de forma idempotente y sin generar ventas/pagos duplicados.
- [ ] El flujo existente con proveedor actual no se rompe (compatibilidad retro validada).
- [ ] La integracion deja base lista para agregar un segundo proveedor con cambios acotados al modulo `payments/`.
