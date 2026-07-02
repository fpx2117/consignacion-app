# Tareas: Fix carga de facturas en mobile + demora del botón

Todo en `src/app/(system-guard)/(protected)/productos/components/factura-proveedor-dialog.tsx`, una sola fase.

## Fix 1 — Dialog se cierra solo al volver del selector de archivos (mobile)

- [x] 1.1 Agregar `selectorArchivoAbiertoRef` + función `abrirSelectorArchivo()` que lo activa antes de `fileInputRef.current?.click()`
- [x] 1.2 Reemplazar las dos llamadas directas a `fileInputRef.current?.click()` (click y teclado Enter/Space sobre la zona de carga) por `abrirSelectorArchivo()`
- [x] 1.3 Enganchar el evento nativo `cancel` del `<input type="file">` que limpia el ref de inmediato — vía `addEventListener` imperativo en un `useEffect` (el tipado de React no expone `onCancel` en JSX para inputs)
- [x] 1.4 `handleFileInput` limpia el ref antes de procesar el archivo elegido
- [x] 1.5 Agregar `useEffect` con listener de `window.addEventListener("focus", ...)` que limpia el ref con un delay de 300ms (red de seguridad)
- [x] 1.6 Extender `onInteractOutside` de `DialogContent` para también prevenir el cierre cuando `selectorArchivoAbiertoRef.current` es `true`
- [x] 1.7 Verificado con Playwright (viewport 1280px, no reproduce la condición de foco real de un OS mobile, pero valida la regresión del happy path): tras `set_input_files`, el diálogo sigue abierto con la vista previa del archivo lista para "Analizar factura"
- [ ] 1.8 Pendiente de verificar en un dispositivo mobile real o emulador con selector de archivos nativo real (Chrome DevTools device toolbar no dispara el mismo evento de foco que un teléfono real) — la condición exacta reportada no se puede reproducir 100% en headless
- [x] 1.9 Verificado: el cierre normal con el botón "Cancelar" sigue funcionando

## Fix 2 — Demora en aparecer el botón disparador

- [x] 2.1 Cambiar la condición de ocultamiento (línea ~338) de `if (!usage?.hasFeature) return null;` a `if (usage != null && !usage.hasFeature) return null;`
- [x] 2.2 Verificado con Playwright: el botón "Cargar por factura" ya está presente en el DOM a los ~300ms de cargar `/productos`, sin esperar la respuesta de `getFacturaProveedorUsage()`
- [ ] 2.3 Pendiente: verificar con un usuario/plan real sin la feature de OCR que el botón desaparece correctamente una vez que se confirma `hasFeature: false` (no había a mano un plan así para probar)
