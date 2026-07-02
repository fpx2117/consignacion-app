# Propuesta: Manejo de errores y rediseño del visor de imagen de factura

## Intención

Reporte del usuario: al ver una factura en producción, la consola mostraba `Failed to load resource: 404` repetido 5 veces sobre `archivo` (la ruta `/api/facturas-proveedor/[id]/archivo`), además de un error de un script `share-modal.js` ajeno a este proyecto. El usuario también señaló que, independientemente de ese error puntual, el visor de imagen que se agregó en el cambio anterior (`optimizacion-consumo-ram`/visor de factura) está mal planteado en términos de UI/UX.

## Investigación del 404 reportado

Consulté directamente la factura mencionada (id 44) contra la base de datos de producción (el `DATABASE_URL` local apunta al mismo Postgres de Railway):

```json
{ "id": 44, "archivoPath": "d9ce2e0c-....jpg", "archivoMime": "image/jpeg",
  "archivoEliminado": true, "sucursalId": 2, "estado": "CANCELADA" }
```

**No es un bug de almacenamiento.** La factura 44 está `CANCELADA` y `archivoEliminado: true` — el archivo se purgó intencionalmente por `purgarArchivoFacturaSiFinalizada()` (`src/lib/ocr/aplicar-confirmacion.ts:260-291`) cuando la factura llegó a un estado terminal, tal como está diseñado. `factura-detalle-dialog.tsx:142` ya verifica `factura?.archivoEliminado` antes de intentar renderizar cualquier `<img>` — si el usuario abre esta factura desde el diálogo normal de la app, ve el mensaje "Imagen original eliminada...", **sin ningún request a `/archivo`**. El reporte original del usuario (antes del fix anterior) fue justamente sobre esta factura 44, con el `<a target="_blank">` viejo — es muy probable que el 404 actual venga de una pestaña/URL vieja que quedó abierta apuntando directo a `https://.../api/facturas-proveedor/44/archivo`, de antes de que se corrigiera el visor. `share-modal.js` (no existe en este repo) es una extensión del navegador intentando inyectarse en esa página de error JSON en blanco — explica el resto del ruido de consola.

## Gaps reales encontrados (independientes del reporte puntual)

Revisando el componente completo (`factura-detalle-dialog.tsx`) aparecieron 3 problemas concretos que sí vale la pena corregir:

### 1. `<img>` sin manejo de error — bug real

`factura-detalle-dialog.tsx:155-159`: el `<img src={ARCHIVO(factura.id)}>` no tiene `onError`. Si el fetch de la imagen falla por *cualquier* motivo — una condición de carrera (alguien confirma/cancela la factura, purgando el archivo, mientras otro usuario ya tiene el diálogo abierto con `archivoEliminado: false` cargado en memoria), un blip de red, o cualquier 403/404/500 — el usuario ve el ícono de imagen rota nativo del navegador, sin ningún mensaje. Es exactamente el tipo de "esto está muy mal" que reportó el usuario, más allá del caso puntual de la factura 44.

### 2. El visor está apretado dentro de un modal angosto — UX real

El diálogo completo mide `sm:max-w-[720px]` con `max-h-[85vh]` (`factura-detalle-dialog.tsx:100`), y dentro de eso la imagen sólo tiene `max-h-72` (288px, `factura-detalle-dialog.tsx:158`) **apilada arriba** de una tabla de ítems que puede tener 15-20+ filas (la factura de prueba tenía 17). Para el caso de uso real — comparar lo que dice la imagen contra lo que extrajo la IA, línea por línea — 288px de alto es insuficiente para leer una factura fotografiada con el celular, y obliga a abrir el lightbox constantemente para poder leerla, perdiendo la tabla de ítems de vista mientras tanto.

### 3. Copy/estado del mensaje "imagen eliminada" es genérico

`factura-detalle-dialog.tsx:142-146`: el mensaje es siempre el mismo texto fijo, sin indicar cuándo se eliminó ni por qué (confirmación completa vs. cancelación) — información que la propia factura ya tiene (`estado`, `updatedAt`) y que ayudaría al usuario a entender que no es un error, sino el comportamiento esperado.

## Alcance

1. **Fix**: agregar `onError` al `<img>` del visor — al fallar la carga, reemplazar la imagen por el mismo bloque de "imagen no disponible" que ya existe para `archivoEliminado`, en vez del ícono roto nativo.
2. **Rediseño del layout**: ensanchar el diálogo y pasar a un layout de dos columnas en pantallas grandes (imagen a la izquierda con altura real de lectura, tabla de ítems a la derecha) — en vez de apilar imagen chica + tabla larga en un modal angosto. En mobile/pantallas chicas, se mantiene apilado (no hay espacio para dos columnas) pero con más alto para la imagen.
3. **Copy contextual**: el mensaje de "imagen eliminada" distingue si fue por confirmación completa o por cancelación, usando el `estado` ya disponible en la factura.

### Fuera de Alcance

- Tocar la política de purgado de archivos (`aplicar-confirmacion.ts`) — sigue igual, es correcta.
- El endpoint `/api/facturas-proveedor/[id]/archivo` en sí — ya devuelve 404 correctamente para un archivo purgado; no hace falta una página de error más amigable ahí porque es una ruta de API, no pensada para navegación directa del usuario (con el fix del lightbox, ya no se navega ahí directamente desde ningún lugar de la app).
- Agregar zoom/pan avanzado (pellizcar para agrandar, mover la imagen) al lightbox — el `ImageVisor` actual (click para abrir a tamaño grande, Escape/click afuera para cerrar) ya cubre el caso de uso principal; no hay pedido concreto de algo más elaborado.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El layout de dos columnas puede verse raro en anchos intermedios (tablet) | Usar el breakpoint `lg:` (1024px) para el cambio a dos columnas, igual que el resto de dialogs grandes del proyecto — por debajo de eso se apila, igual que hoy |
| `onError` en el `<img>` podría loopear si el fallback también intenta cargar la misma URL | El fallback no vuelve a intentar cargar ninguna imagen — reemplaza el `<img>` por el bloque de texto/ícono, no por otro recurso de red |

## Criterios de Éxito

- [ ] Si el fetch de la imagen falla (404/403/red), el usuario ve un mensaje claro en vez del ícono de imagen rota.
- [ ] En pantallas ≥1024px, la imagen y la tabla de ítems se ven simultáneamente, con la imagen a un tamaño legible.
- [ ] El mensaje de "imagen eliminada" distingue confirmación vs. cancelación.
- [ ] La factura 44 (u otra ya purgada) sigue mostrando el mensaje de "eliminada" sin ningún request a `/archivo`, como ya pasa hoy.
