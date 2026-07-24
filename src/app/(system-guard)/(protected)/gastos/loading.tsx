export default function GastosLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 rounded-lg bg-muted" />
        <div className="h-9 w-36 rounded-lg bg-muted" />
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-4 flex flex-col gap-2"
          >
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-8 w-32 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="h-9 w-48 rounded-lg bg-muted" />
        <div className="h-9 w-36 rounded-lg bg-muted" />
      </div>

      {/* Lista de gastos */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-4 flex items-center gap-4"
        >
          <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-5 w-24 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
