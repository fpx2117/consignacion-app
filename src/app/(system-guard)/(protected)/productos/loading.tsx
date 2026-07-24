export default function ProductosLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-lg bg-muted" />
          <div className="h-9 w-32 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card px-4 py-3 flex flex-col gap-1"
          >
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-6 w-14 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="h-9 w-64 rounded-lg bg-muted" />
        <div className="h-9 w-36 rounded-lg bg-muted" />
        <div className="h-9 w-36 rounded-lg bg-muted" />
        <div className="ml-auto h-9 w-24 rounded-lg bg-muted" />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Header tabla */}
        <div className="border-b bg-muted/30 px-4 py-3 flex gap-6">
          {[80, 120, 90, 80, 70, 80].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-muted"
              style={{ width: w }}
            />
          ))}
        </div>
        {/* Filas */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-3 border-b last:border-0 flex gap-6 items-center"
          >
            <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted ml-auto" />
          </div>
        ))}
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-8 rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
