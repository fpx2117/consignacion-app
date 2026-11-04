# ADR 002 — La suscripción pertenece a la instalación, no al usuario

## Contexto

`Subscription.userId` es `@unique` y su clave foránea es `ON DELETE RESTRICT`.
Eso convierte al usuario que pagó en una **dependencia dura** del estado de
facturación:

- No se puede eliminar a ese usuario. El `DELETE` falla por violación de FK y el
  handler devuelve un 500 genérico ("Error al eliminar usuario"), sin explicar
  la causa.
- Si cambia el dueño del negocio, no hay forma de transferir la facturación sin
  editar la base a mano.

Al mismo tiempo, el código **ya trata la suscripción como instalación**:
`getActivePlanLimits()` (`src/lib/subscriptions/require-subscription.ts:49`) hace
`findFirst` de cualquier suscripción activa, sin filtrar por usuario, con el
comentario explícito "Suscripción es a nivel programa". Y
`/api/subscriptions/current` tiene un fallback equivalente para que los admins
secundarios no queden sin plan.

O sea: el modelo de datos dice "del usuario" y el código dice "de la
instalación". Esa contradicción es el problema a resolver.

## Opciones

- **A.** Hacer `Subscription.userId` nullable con `ON DELETE SET NULL`.
- **B.** Anclar la suscripción a `Sucursal` (la principal) y dejar `userId` como
  contacto opcional.
- **C.** Mantener `userId` obligatorio y **reasignarlo** a otro administrador
  activo cuando el contacto se elimina.

## Decisión

Se adopta **C**, con la regla escrita:

> La suscripción pertenece a la instalación. `userId` identifica al **contacto de
> facturación**, no al dueño. Si ese usuario se elimina, la suscripción se
> reasigna a otro administrador activo en la misma transacción. Nunca se borra
> ni se pierde el estado de facturación.

Implementación: `deleteUserAndProtectLastAdmin`
(`src/app/api/settings/users/user-update.ts`) reasigna dentro de la transacción
antes del `delete`. El nuevo contacto es el administrador activo de menor `id`
que **no tenga ya una suscripción propia** (la columna `userId` es única, así que
un candidato con suscripción provocaría una violación de unicidad).

## Motivo

- **No requiere migración ni tocar datos.** El riesgo de A y B es alto y el
  beneficio no lo justifica.
- **A obligaría a tocar siete puntos de facturación.** Siete lugares
  dereferencian `sub.user.nombre` para armar notificaciones:
  `cron/check-subscriptions` (2), `cron/check-vencimientos` (4),
  `webhooks/mercadopago` (1) y `webhooks/paypal` (1). Cada uno pasaría a
  necesitar un fallback, y un `null` sin manejar rompe el aviso de vencimiento
  justo cuando más importa.
- **B es la solución "de manual" pero desproporcionada.** Anclar a `Sucursal`
  cambia el modelo, la migración y todas las lecturas, para resolver un caso que
  ocurre una vez por año.
- **C preserva la invariante fuerte:** toda suscripción tiene siempre un contacto
  válido. No aparecen `null` en la facturación.

## Consecuencias

- Eliminar al contacto de facturación deja de fallar. La suscripción sobrevive y
  apunta al administrador activo de menor `id` (determinista).
- Si el usuario a eliminar es el **único** administrador activo, la operación se
  rechaza igual que antes: `canRemoveUser` exige más de un admin. No hay caso en
  que quede una suscripción sin contacto.
- Los webhooks y crons no cambian: `subscription.user` sigue siendo no nulo.
- La reasignación es silenciosa para el usuario. Si en el futuro se quiere
  trazabilidad, se agrega al `AuditLog` del borrado.

## Lo que este ADR NO resuelve

- **Transferir la facturación a otro usuario de forma explícita.** Hoy solo
  ocurre como efecto de eliminar al contacto. Una pantalla de "cambiar contacto
  de facturación" es alcance de producto, no de esta corrección.
- **Suscripciones múltiples por instalación.** `userId @unique` lo impide por
  usuario, pero nada impide dos suscripciones de dos usuarios distintos en la
  misma base. `getActivePlanLimits` tomaría la más nueva. Es un riesgo latente
  que no se aborda acá.

## Cuándo se reabre

Si aparece la necesidad de facturar a una entidad que no sea un usuario (por
ejemplo una razón social con varios contactos), se reabre y se evalúa la opción
B con una migración planificada.
