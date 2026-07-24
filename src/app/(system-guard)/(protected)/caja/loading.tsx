export default function CajaLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 rounded-lg bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-muted" />
          <div className="h-9 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Estado de caja */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col gap-2">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          <div className="h-10 w-10 rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-7 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Movimientos recientes */}
      <div className="rounded-xl border bg-card p-5">
        <div className="h-5 w-40 rounded bg-muted mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 py-3 border-b last:border-0"
          >
            <div className="h-8 w-8 rounded-lg bg-muted flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-muted mb-1" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="h-5 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
