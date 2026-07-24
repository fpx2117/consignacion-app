# Propuesta: Fix carga de facturas en mobile (diálogo se cierra solo) + demora del botón

## Intención

Reporte del usuario: en mobile, al cargar una factura por foto, el diálogo de escaneo se cierra solo justo después de subir la imagen (antes de poder terminar el flujo). Además, el botón que abre ese diálogo ("Cargar por factura") tarda en aparecer al entrar a la pantalla.

Investigué el componente (`src/app/(system-guard)/(protected)/productos/components/factura-proveedor-dialog.tsx`) y encontré la causa concreta de los dos síntomas — ninguno es aleatorio, ambos tienen una explicación puntual en el código.

## Causa 1 — El Dialog de Radix se autocierra al volver del selector de archivos nativo (mobile)

El input de archivo está oculto (`className="hidden"`, línea 373-380) y se dispara programáticamente con `fileInputRef.current?.click()` (línea 394) al tocar la zona de carga. En mobile, ese `click()` abre el selector nativo del sistema operativo (cámara / galería de fotos) — una superposición fuera del árbol DOM de la página.

Es un problema documentado de Radix UI (`DismissableLayer`, la capa que usan `Dialog`/`Popover`/etc. para detectar "click afuera" y cerrarse): cuando el foco vuelve a la página después de que el selector nativo de archivos se cierra, algunos navegadores mobile (Chrome/Safari Android e iOS) disparan un evento de puntero/foco que Radix interpreta como una interacción "fuera" del diálogo, y lo cierra automáticamente — **antes** de que el usuario llegue a ver la vista previa o tocar "Analizar factura". Esto coincide exactamente con "se cierra solo una vez que subo la imagen".

Este proyecto ya tiene un workaround para un problema _relacionado_ (diálogos anidados, ver `nestedDialogOpen` línea 114-119 y `onInteractOutside`/`onEscapeKeyDown` en `DialogContent`, línea 354-355) — pero ese guard sólo cubre los diálogos anidados de Radix (crear/editar producto), no la interacción con el `<input type="file">` nativo, que es un caso distinto (no hay ningún componente Radix involucrado del lado del selector de archivos).

## Causa 2 — El botón disparador tarda porque el componente entero no renderiza nada hasta resolver una consulta de red

`factura-proveedor-dialog.tsx:338`: `if (!usage?.hasFeature) return null;` — el componente completo (incluido el botón "Cargar por factura", o el `trigger` que le pase el padre) no renderiza **nada** hasta que se resuelve `apiService.getFacturaProveedorUsage()` (el `useEffect` de la línea 127-129). Mientras `usage` es `null` (estado inicial), `!usage?.hasFeature` es `true`, así que el componente devuelve `null`.

El comentario original (línea 335-337) explica la intención: evitar que el botón "aparezca y desaparezca" en planes sin la feature de OCR. Es una decisión consciente, pero el costo es que **todos** los usuarios (incluida la enorme mayoría con la feature habilitada) ven el botón aparecer con demora — más notorio en mobile por la latencia de red típicamente mayor. Es exactamente lo que reportó el usuario.

## Alcance

1. **Fix Causa 1**: agregar un guard (ref + listener de `window.focus`) que ignore el cierre por "interacción afuera" del Dialog mientras el selector nativo de archivos está o pudo haber estado abierto, sin afectar el cierre normal por click afuera / Escape / botón Cancelar en el resto de los casos.
2. **Fix Causa 2**: mostrar el botón disparador de forma optimista mientras se resuelve el cupo (asumiendo que la feature está habilitada, que es el caso común), ocultándolo sólo si la consulta confirma que el plan no la incluye — a costa de un posible flash breve (aparece y desaparece) sólo para la minoría de usuarios en planes restringidos, que es el trade-off que la implementación original evitaba a costa de la demora para todos.

### Fuera de Alcance

- Cualquier cambio al flujo de análisis de la factura en sí (subida, OCR, IA) — no está roto, el problema es puramente de la capa de UI del diálogo.
- Migrar `usage` a un cache compartido/contexto global (evitaría la consulta repetida cada vez que se monta el componente) — es una optimización más grande, no necesaria para resolver la demora percibida; se deja como posible mejora futura si se repite el mismo patrón en otros lados.

## Riesgos

| Riesgo                                                                                                                                                                                                           | Mitigación                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El guard contra el cierre del Dialog podría "atascarse" en `true` si el usuario cancela el selector de archivos sin disparar `onChange` (algunos navegadores viejos no emiten `cancel` en `<input type="file">`) | Se limpia el guard tanto en el evento `change` como en el evento `cancel` del input, y además con un timeout de seguridad corto (ver `design.md`) — nunca queda bloqueado el cierre normal del diálogo por mucho tiempo |
| El fix de la Causa 2 hace que usuarios en planes sin la feature vean el botón un instante antes de que desaparezca                                                                                               | Aceptado explícitamente — es el trade-off que ya identificó el comentario original; se prioriza la experiencia de la mayoría (planes con la feature)                                                                    |

## Criterios de Éxito

- [ ] En un navegador mobile (o emulación de mobile en Chrome DevTools), tocar la zona de carga, elegir una foto desde la galería, y confirmar que el diálogo sigue abierto con la foto seleccionada lista para "Analizar factura".
- [ ] Cancelar el selector de archivos nativo (sin elegir nada) tampoco cierra el diálogo.
- [ ] El cierre normal del diálogo (botón Cancelar, click afuera, Escape) sigue funcionando igual que antes.
- [ ] El botón "Cargar por factura" aparece inmediatamente al cargar la pantalla en un plan con la feature habilitada, sin esperar la respuesta de `getFacturaProveedorUsage()`.
