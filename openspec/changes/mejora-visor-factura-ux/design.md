# Diseño: Manejo de errores y rediseño del visor de imagen de factura

Todos los cambios son dentro de un único archivo: `src/app/(system-guard)/(protected)/proveedores/components/factura-detalle-dialog.tsx`. No hay cambios de API ni de schema.

## 1. `onError` en el `<img>` del visor

Estado nuevo para distinguir "todavía no se intentó cargar" de "falló la carga":

```tsx
const [imagenConError, setImagenConError] = React.useState(false);

// Reset al cambiar de factura (reabrir el dialog con otro facturaId)
React.useEffect(() => {
  setImagenConError(false);
}, [facturaId]);
```

Diff conceptual sobre el bloque de imagen (línea 149-163 actual):

```tsx
{factura.archivoMime?.startsWith("image/") ? (
  imagenConError ? (
    <ImagenNoDisponibleMensaje texto="No se pudo cargar la imagen original." />
  ) : (
    <button type="button" onClick={() => setVisorAbierto(true)} className="group relative block w-full">
      <img
        src={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(factura.id)}
        alt="Factura original"
        className="..."
        onError={() => setImagenConError(true)}
      />
      {/* ...overlay de zoom sin cambios... */}
    </button>
  )
) : ...}
```

`ImagenNoDisponibleMensaje` es el mismo bloque visual que ya existe para `archivoEliminado` (ícono `ImageOff` + texto), extraído a un pequeño componente local para reusarlo en los dos casos (eliminada vs. error de carga) sin duplicar el JSX — mismo criterio de "no premature abstraction" pero acá sí hay dos usos reales, no hipotéticos.

El lightbox (`ImageVisor`) no necesita el mismo manejo — sólo se abre haciendo click en la imagen que ya cargó bien, así que si esa imagen cargó, la del lightbox (misma URL) también va a cargar.

## 2. Layout de dos columnas en pantallas grandes

### Ancho del diálogo

`DialogContent` pasa de `sm:max-w-[720px]` a `sm:max-w-[720px] lg:max-w-[1040px]` — se mantiene angosto en mobile/tablet (sin cambio de comportamiento ahí), se ensancha sólo en desktop.

### Estructura del body

Reemplazar el apilado actual (imagen arriba del todo, tabla abajo, ambos dentro de un único `<div className="p-6 overflow-y-auto">`) por:

```tsx
<div className="flex-1 min-h-0 overflow-hidden lg:flex">
  {/* Columna imagen — sólo si hay algo que mostrar */}
  {(factura?.archivoEliminado ||
    factura?.archivoMime?.startsWith("image/") ||
    factura?.archivoMime === "application/pdf") && (
    <div className="lg:w-[340px] lg:shrink-0 lg:border-r lg:border-border/50 p-6 lg:overflow-y-auto">
      {/* ...bloque de imagen/PDF/eliminada, con altura lg:max-h-none lg:h-full en vez de max-h-72... */}
    </div>
  )}

  {/* Columna tabla de ítems */}
  <div className="flex-1 min-h-0 overflow-y-auto p-6">
    {/* ...loading / empty state / tabla, sin cambios de contenido... */}
  </div>
</div>
```

En `lg:`, la imagen usa `lg:h-full lg:max-h-none object-contain` (ocupa toda la altura disponible de su columna, ~85vh menos header) en vez del `max-h-72` fijo — mucho más legible sin tener que abrir el lightbox. Por debajo de `lg:`, se mantiene el comportamiento actual (apilado, `max-h-72`) — sin regresión en mobile.

## 3. Copy contextual del mensaje "eliminada"

```tsx
function mensajeArchivoEliminado(estado: EstadoFacturaProveedor): string {
  if (estado === "CANCELADA") {
    return "La factura fue cancelada y la imagen original se eliminó para ahorrar espacio.";
  }
  if (estado === "CONFIRMADA") {
    return "La factura fue confirmada por completo y la imagen original se eliminó para ahorrar espacio.";
  }
  return "Imagen original eliminada para ahorrar espacio.";
}
```

Se importa `EstadoFacturaProveedor` como tipo desde `@/lib/apiService` (ya expone el enum como union de strings, no hace falta el enum de Prisma en el cliente).

## Compatibilidad hacia atrás

- Facturas sin imagen eliminada, en mobile/tablet: layout idéntico al actual.
- Facturas con imagen eliminada: mismo bloque visual, sólo cambia el texto según el estado.
- El endpoint `/archivo` y la política de purgado: sin cambios.

## Roadmap de Implementación

Todo en una sola fase — es un cambio acotado a un componente.

1. `onError` + estado `imagenConError` + componente local `ImagenNoDisponibleMensaje`.
2. Layout de dos columnas (`lg:flex`) + ensanchar `DialogContent`.
3. Copy contextual según `estado`.

**Listo cuando**: una imagen que falla al cargar muestra el mensaje de error en vez del ícono roto; en desktop (≥1024px) se ve la imagen a tamaño legible junto a la tabla de ítems sin necesidad de abrir el lightbox; el mensaje de "eliminada" menciona si fue por confirmación o cancelación.
