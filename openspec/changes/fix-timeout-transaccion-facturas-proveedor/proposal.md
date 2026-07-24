# Bug: Timeout de transacción de Prisma al procesar facturas con muchos ítems

## Cómo se encontró

Verificando manualmente el cambio `optimizacion-consumo-ram` (Fase 1, tarea 1.3 de `tasks.md`), subí y procesé una factura real (foto JPEG) por el navegador. El OCR/IA funcionó correctamente (Tesseract cargó bajo demanda, OpenRouter devolvió los ítems con `usedVision: true` en 31s), pero el request final devolvió `502`:

```
[FACTURA_PROVEEDOR_PROCESS_ERROR] {
  facturaId: 43,
  mensaje: 'Transaction API error: A commit cannot be executed on an expired transaction.
  The timeout for this transaction was 5000 ms, however 5478 ms passed since the start
  of the transaction. Consider increasing the interactive transaction timeout or doing
  less work in the transaction.'
}
POST /api/facturas-proveedor/43/process 502 in 44s
```

**No está relacionado con el cambio `optimizacion-consumo-ram`** — la transacción de Prisma en `process/route.ts` no fue tocada por esa propuesta. Es un bug preexistente que salió a la luz al probar el flujo end-to-end con una factura real.

## Causa raíz

`src/app/api/facturas-proveedor/[id]/process/route.ts:113-165` — dentro de un único `prisma.$transaction(async (tx) => {...})` (que usa el timeout interactivo default de Prisma, **5000ms**, porque no se pasa ninguna opción `{ timeout }`), el código hace:

1. `tx.facturaProveedor.update(...)` — 1 round-trip.
2. Un `for (const item of resultado.items)` que por cada ítem de la factura llama `await tx.facturaProveedorItem.create({...})` **secuencialmente, uno por uno** (línea 133-155) — **N round-trips**, uno por cada línea detectada en la factura.
3. `tx.facturaProveedor.findUniqueOrThrow(...)` — 1 round-trip más.

Con una factura de varias líneas (facturas de proveedores de vapes/mayorista suelen traer 15-30+ ítems), el total de round-trips secuenciales dentro de la transacción es `N + 2`. Cada round-trip paga latencia de red completa hacia la base — en este caso agravado porque `DATABASE_URL` apunta a Postgres de Railway vía el proxy público (`yamabiko.proxy.rlwy.net`), no a una base colocada en la misma región que el proceso. El acumulado de esos round-trips secuenciales superó los 5000ms del timeout default antes de llegar al `commit`.

`matchearItem()` (llamado dentro del loop, línea 134-137) es CPU pura — no hace ninguna consulta a la base — así que no es la causa de la lentitud; el cuello de botella es exclusivamente la cantidad de round-trips secuenciales a la base dentro de la transacción.

Este riesgo no es exclusivo del entorno local: en producción, con menos latencia de red pero cero optimización de round-trips, una factura con suficientes líneas (proveedores mayoristas, facturas con 30-50+ ítems) puede reproducir el mismo timeout, dejando la factura en estado `ERROR` sin haber persistido ningún ítem (la transacción hace rollback completo).

## Fix

### 1. Batch insert: `createMany` en vez de N `create()` secuenciales

Mover el cálculo de matching (`matchearItem`, puro CPU) **fuera** de la transacción, armando el array completo de ítems a insertar de antemano, y reemplazar el loop de `tx.facturaProveedorItem.create()` por un único `tx.facturaProveedorItem.createMany({ data: itemsData })`. Esto baja el total de round-trips dentro de la transacción de `N + 2` a **una constante de 3** (`update` + `createMany` + `findUniqueOrThrow`), sin importar cuántos ítems tenga la factura.

### 2. Timeout explícito más generoso, como red de seguridad

Además del batching (que es el fix real), se pasa `{ timeout: 15000 }` a `prisma.$transaction(...)` — defensa en profundidad para el caso de una factura con una cantidad de ítems verdaderamente extrema, o una base momentáneamente lenta, sin depender únicamente de que el batching alcance siempre.

### Por qué no otras alternativas

- **Solo subir el timeout, sin batching**: se descarta como único fix — no resuelve el problema de fondo (N round-trips secuenciales), sólo pospone el síntoma a una factura con más ítems todavía.
- **`createManyAndReturn` en vez de `createMany` + `findUniqueOrThrow`**: no aporta nada acá — el código ya vuelve a leer la factura completa con `include: { items: true, proveedor: true }` al final para la respuesta al cliente, así que no hace falta que el insert devuelva las filas.

## Áreas Afectadas

| Área                                                   | Impacto    | Descripción                                                                                                  |
| ------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `src/app/api/facturas-proveedor/[id]/process/route.ts` | Modificado | Matching movido fuera de la transacción; `createMany` en vez de loop de `create()`; timeout explícito de 15s |

## Riesgo

Ninguno nuevo: `createMany` con Postgres no soporta relaciones anidadas ni devuelve las filas creadas (no se necesitaban), pero sí soporta todos los campos escalares/JSON usados acá (`atributosExtra Json?` incluido). El comportamiento observable para el usuario no cambia — misma factura, mismos ítems, mismo resultado final, solo más rápido y sin depender de la cantidad de líneas.

## Verificación

- [x] Reproducido el bug con una factura real de 30k tokens de IA (invoice grande) — timeout confirmado en el log (`502` en 44s, "commit cannot be executed on an expired transaction").
- [x] Reprocesada la misma factura (id 43, estado `ERROR` → reintentable) tras el fix: `POST /api/facturas-proveedor/43/process` devolvió `200` en 29.7s (antes: `502` en 44s), persistiendo los 17 ítems detectados vía `createMany` sin superar el timeout.
- [x] Confirmado el contenido de los ítems creados: cada uno con `matchScore`/`matchMotivo`/`estado` calculados correctamente (`SIN_COINCIDENCIA` en los 17, esperable — la factura de prueba es de perfumes contra un catálogo de vapes, no es un fallo del matching).
- [x] Confirmado el guard de estado sigue funcionando: un segundo intento de reprocesar la misma factura (ya en `REQUIERE_REVISION`) devuelve `409` como corresponde, no un error.
