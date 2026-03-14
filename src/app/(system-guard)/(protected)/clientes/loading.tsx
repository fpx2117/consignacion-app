export default function ClientesLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg bg-muted" />
        <div className="h-9 w-36 rounded-lg bg-muted" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card px-4 py-3 flex flex-col gap-1">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Barra de búsqueda */}
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-xs rounded-lg bg-muted" />
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3 flex gap-6">
          {[140, 160, 110, 90, 80].map((w, i) => (
            <div key={i} className="h-4 rounded bg-muted" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b last:border-0 flex gap-6 items-center">
            <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
