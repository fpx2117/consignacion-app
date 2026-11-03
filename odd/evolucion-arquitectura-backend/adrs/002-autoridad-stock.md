# ADR 002 — Autoridad y cutover de stock

## Contexto

`StockSucursal` y `Producto` reciben escrituras, mientras una migración instala
un trigger que proyecta el agregado global.

## Opciones

- Mantener dual-write.
- Usar inmediatamente el trigger actual.
- Hacer `StockSucursal` canónico mediante un cutover compatible y probado.

## Decisión

`StockSucursal` será canónico. El trigger actual no se aprobará hasta reproducir
su comportamiento concurrente. Cada despliegue y rollback deberá respetar una
matriz explícita entre versión de aplicación y estado del mecanismo de proyección.

La versión puente consultará dentro de cada transacción de stock una capacidad
persistida en PostgreSQL (`APP_DUAL_WRITE` o `DB_PROJECTION`) y bloqueará esa fila
con `FOR SHARE` antes de escribir. La migración de activación tomará el lock
incompatible sobre esa misma fila. Así, una transacción no podrá observar un modo
y completar la escritura bajo otro.

## Matriz de compatibilidad

| Aplicación | Trigger ausente + `APP_DUAL_WRITE` | Trigger activo + `DB_PROJECTION` |
| --- | --- | --- |
| `L0` legacy: dual-write incondicional | Permitido | **Prohibido**: duplica o pisa la proyección |
| `B1` puente: obedece la capacidad | Permitido: escribe ambas representaciones | Permitido: escribe sólo `StockSucursal` |
| `C2` canónica: sólo `StockSucursal` | **Prohibido**: deja `Producto` obsoleto | Permitido |

Cualquier combinación entre trigger y capacidad que no coincida debe fallar
cerrada y bloquear nuevas mutaciones de stock. No se permite activar el trigger
mientras exista una instancia `L0`, ni desplegar `C2` antes de confirmar
`DB_PROJECTION`.

## Cutover ejecutable

1. En una copia aislada, confirmar si la migración
   `20260322000000_trigger_sync_producto_stock` está aplicada y ejecutar las
   reproducciones concurrentes. El trigger existente es evidencia a evaluar, no
   una precondición asumida.
2. Inventariar todos los escritores y lectores; ningún flujo queda fuera de la
   matriz.
3. Agregar de forma aditiva la capacidad con valor `APP_DUAL_WRITE`. Si el trigger
   ya estuviera activo junto a writers `L0`, no alcanza con detener el rollout:
   se activa inmediatamente un **fence total de escrituras**. Se bloquean en el
   ingress todas las mutaciones, se detienen instancias, cron y workers, y los
   webhooks reciben una respuesta temporal reintentable; luego se espera hasta
   que no quede ninguna transacción del rol de aplicación en PostgreSQL. `L0` no
   consulta la capacidad, por lo que el lock de esa fila no puede frenarlo.
   Manteniendo el fence, una migración compensatoria toma locks en orden fijo
   `StockSucursal -> Producto`, desactiva la proyección, recalcula ambos campos
   globales, establece `APP_DUAL_WRITE` y confirma la transacción. Sólo después de
   verificar trigger, capacidad y reconciliación se reanudan writers `L0` o se
   continúa con `B1`. Si la compensación falla, su transacción revierte y el
   fence permanece activo; no se reabre tráfico en un estado ambiguo.
4. Desplegar `B1` en modo dual-write y comprobar que no quedan instancias `L0`.
5. Abrir una pausa breve de escrituras de stock. Comparar cada campo global de
   `Producto` con `SUM(StockSucursal)` y reparar toda diferencia antes de seguir.
6. En una única transacción PostgreSQL: bloquear la capacidad y las tablas
   afectadas, instalar el mecanismo de proyección concurrentemente validado y
   cambiar la capacidad a `DB_PROJECTION`.
7. Verificar estado del trigger, valor de capacidad, igualdad completa entre la
   proyección y la suma por sucursal, y una entrada, salida y restitución de
   prueba. Recién entonces reanudar escrituras.
8. Mantener `B1` durante la ventana de observación. `C2` se despliega sólo después
   de aprobar esa evidencia; la rama dual-write no se retira en el mismo cambio.

## Rollback ejecutable

Mientras `B1` esté desplegada, pausar escrituras y ejecutar una migración
compensatoria transaccional que desactive la proyección, cambie la capacidad a
`APP_DUAL_WRITE` y recalcule `Producto` desde `StockSucursal`; verificar la
igualdad y recién entonces reanudar. Para volver desde `C2`, primero se restaura
`B1` con `DB_PROJECTION`, y sólo después se ejecuta el rollback anterior. Volver a
`L0` exige que el trigger ya esté ausente y la capacidad esté en dual-write.

La migración aplicada nunca se edita. Cada transición deja evidencia de versión
de aplicación, capacidad, definición del trigger y consulta de reconciliación.
La recuperación desde trigger-activo/`L0` se prueba con una transacción legacy en
vuelo para demostrar que el drain y los locks impiden escrituras tardías.

## Motivo

Una única autoridad evita divergencia, pero activarla sin coordinar escritores
legacy puede duplicar ajustes.

## Consecuencias

- Se inventariarán todos los escritores antes del cutover.
- No se combinará trigger activo con aplicaciones que hagan dual-write.
- El rollback usará migraciones compensatorias aditivas y un par compatible de
  aplicación/esquema.
- Las salidas y restituciones se probarán bajo concurrencia real.
- La pausa de escrituras prima sobre un rollout supuestamente “sin downtime”:
  evita un estado intermedio conocido como incompatible.
