export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse max-w-4xl">
      {/* Header */}
      <div className="h-8 w-40 rounded-lg bg-muted" />

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-t-md bg-muted" />
        ))}
      </div>

      {/* Sección de formulario */}
      <div className="rounded-xl border bg-card p-6 flex flex-col gap-5">
        <div className="h-5 w-40 rounded bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-10 w-full rounded-lg bg-muted" />
          </div>
        ))}
        <div className="flex justify-end">
          <div className="h-9 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Segunda sección */}
      <div className="rounded-xl border bg-card p-6 flex flex-col gap-5">
        <div className="h-5 w-36 rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex flex-col gap-1">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted" />
            </div>
            <div className="h-6 w-12 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
