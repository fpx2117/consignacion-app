# Diseño: Fix carga de facturas en mobile + demora del botón

Ambos cambios son dentro de `src/app/(system-guard)/(protected)/productos/components/factura-proveedor-dialog.tsx`. No hay cambios de API ni de schema.

## Fix 1 — Guard contra el autocierre del Dialog al volver del selector de archivos

### Mecanismo

Un ref booleano que se activa justo antes de abrir el selector nativo (`fileInputRef.current?.click()`) y se desactiva cuando el control vuelve a la página — usando el evento `focus` de `window`, que dispara de forma confiable en mobile cuando la app recupera el foco después de cualquier UI nativa (cámara, selector de archivos, tanto si el usuario elige un archivo como si cancela).

```tsx
const selectorArchivoAbiertoRef = React.useRef(false);

function abrirSelectorArchivo() {
  if (trabajando || sinCupo) return;
  selectorArchivoAbiertoRef.current = true;
  fileInputRef.current?.click();
}

React.useEffect(() => {
  function onWindowFocus() {
    if (!selectorArchivoAbiertoRef.current) return;
    // Pequeño delay: Radix evalúa "interacción afuera" en el mismo tick en que
    // la página recupera el foco: hay que seguir bloqueando el cierre un
    // instante más allá de este evento, no exactamente en él.
    window.setTimeout(() => { selectorArchivoAbiertoRef.current = false; }, 300);
  }
  window.addEventListener("focus", onWindowFocus);
  return () => window.removeEventListener("focus", onWindowFocus);
}, []);
```

`handleFileInput` (línea 157-159) y un nuevo handler para el evento nativo `cancel` del `<input type="file">` (soportado en navegadores modernos, dispara cuando el usuario cierra el selector sin elegir nada) también limpian el ref de inmediato, sin esperar el `focus` de `window` — son la señal más directa de que la interacción con el selector terminó:

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept={ACCEPT_FACTURA}
  onChange={(e) => { selectorArchivoAbiertoRef.current = false; handleFileInput(e); }}
  onCancel={() => { selectorArchivoAbiertoRef.current = false; }}
  disabled={trabajando}
  className="hidden"
/>
```

El `setTimeout` de 300ms en el listener de `focus` queda como red de seguridad para navegadores donde `cancel` no dispara — nunca deja el guard activo más que ese margen corto, así que el cierre normal del diálogo (click afuera real, Escape, botón Cancelar) no queda bloqueado por mucho tiempo en ningún escenario.

### Aplicar el guard en `DialogContent`

Diff conceptual sobre las props ya existentes (línea 354-355):

```tsx
<DialogContent
  className="..."
  onInteractOutside={(e) => {
    if (nestedDialogOpen || selectorArchivoAbiertoRef.current) e.preventDefault();
  }}
  onEscapeKeyDown={(e) => { if (nestedDialogOpen) e.preventDefault(); }}
>
```

Sólo se agrega la condición al `onInteractOutside` ya existente — reusa el mismo mecanismo que ya protege contra el cierre en cascada de los diálogos anidados (`nestedDialogOpen`), extendiéndolo al caso del selector de archivos nativo. `onEscapeKeyDown` no necesita el guard: Escape es una acción explícita del usuario que sí debe poder cerrar el diálogo aunque el selector de archivos esté "recién cerrado" en el margen de 300ms.

### Reemplazar los dos lugares que llaman `fileInputRef.current?.click()`

Las líneas 394 y 398 (click y Enter/Space sobre la zona de carga) pasan a llamar `abrirSelectorArchivo()` en vez de `fileInputRef.current?.click()` directo — la única diferencia es que ahora también arma el ref antes de abrir el selector.

## Fix 2 — Mostrar el botón disparador de forma optimista

Diff conceptual sobre la línea 338:

```tsx
// ANTES: oculta el botón mientras se resuelve el cupo (usage === null) y
// cuando se confirma que el plan no tiene la feature.
if (!usage?.hasFeature) return null;

// DESPUÉS: sólo oculta cuando se CONFIRMÓ que el plan no tiene la feature.
// Mientras `usage` está resolviendo (null), se muestra optimistamente —
// la mayoría de los planes la tienen habilitada, así que el botón aparece
// de inmediato en el caso común, en vez de esperar la red.
if (usage != null && !usage.hasFeature) return null;
```

No hace falta ningún otro cambio: el resto del componente (incluida la lógica de `sinCupo`, que sigue chequeando `usage != null` antes de deshabilitar la zona de carga por cupo agotado, línea 150) ya maneja `usage === null` correctamente en todos los demás usos.

### Trade-off aceptado

Para la minoría de usuarios en un plan sin la feature de OCR, el botón va a aparecer brevemente (mientras `usage` es `null`) y después desaparecer cuando la consulta confirma `hasFeature: false`. Es el trade-off inverso al que evitaba la implementación original — se prioriza no demorar el botón para la mayoría de los usuarios (planes con la feature), a costa de un flash raro y breve para la minoría sin acceso.

## Compatibilidad hacia atrás

1. **Desktop**: sin cambio de comportamiento — el guard del Fix 1 sólo se activa cuando se llama `abrirSelectorArchivo()`, y en desktop el selector de archivos no dispara la misma condición de "interacción afuera" que en mobile (igual, el guard no hace nada si Radix no intenta cerrar el diálogo).
2. **Cierre normal del diálogo** (Cancelar, click afuera real, Escape): sin cambios — el guard sólo bloquea el cierre automático inmediatamente después de abrir el selector de archivos, con un margen de 300ms.
3. **Diálogos anidados** (crear/editar producto): el guard existente (`nestedDialogOpen`) no se toca.

## Roadmap de Implementación

Una sola fase, ambos fixes son independientes entre sí.

1. Fix 1: ref `selectorArchivoAbiertoRef` + función `abrirSelectorArchivo()` + listener de `window.focus` + handlers `onChange`/`onCancel` en el input + guard en `onInteractOutside`.
2. Fix 2: cambiar la condición de la línea 338.

**Listo cuando**: en mobile (real o emulado), elegir una foto desde el selector nativo no cierra el diálogo; el botón "Cargar por factura" aparece sin demora perceptible al cargar la pantalla.
