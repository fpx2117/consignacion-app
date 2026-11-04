// Pantalla de carga de factura del diálogo de facturas de proveedor.
//
// Extraída de factura-proveedor-dialog.tsx (M08) sin cambios de comportamiento:
// es presentación pura, recibe estado y callbacks por props y no usa hooks
// propios. El contenedor decide cuándo mostrarla.

import * as React from "react";
import { Check, FileText, Loader2, X } from "lucide-react";

import type { FacturaProveedorUsage } from "@/lib/apiService";
import { ACCEPT_FACTURA, TIPS_FOTO } from "./factura-proveedor-helpers";

export type FacturaUploadPaneProps = {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInput: React.ChangeEventHandler<HTMLInputElement>;
  handleDrop: React.DragEventHandler<HTMLDivElement>;
  abrirSelectorArchivo: () => void;
  setDragActive: React.Dispatch<React.SetStateAction<boolean>>;
  trabajoEnCurso: boolean;
  subiendo: boolean;
  selectedFile: File | null;
  usage: FacturaProveedorUsage | null;
  sinCupo: boolean;
  dragActive: boolean;
};

export function FacturaUploadPane({
  fileInputRef,
  handleFileInput,
  handleDrop,
  abrirSelectorArchivo,
  setDragActive,
  trabajoEnCurso,
  subiendo,
  selectedFile,
  usage,
  sinCupo,
  dragActive,
}: FacturaUploadPaneProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_FACTURA}
        onChange={handleFileInput}
        disabled={trabajoEnCurso}
        className="hidden"
      />

      {usage && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Escaneos usados este mes
          </span>
          <span className="font-semibold tabular-nums">
            {usage.used} / {usage.limit === -1 ? "∞" : usage.limit}
          </span>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => abrirSelectorArchivo()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrirSelectorArchivo();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!trabajoEnCurso && !sinCupo) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          if (sinCupo) {
            e.preventDefault();
            return;
          }
          handleDrop(e);
        }}
        aria-disabled={sinCupo}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none ${
          sinCupo
            ? "opacity-50 cursor-not-allowed border-border"
            : "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
        } ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-muted/40"
        }`}
      >
        <div className="relative mx-auto mb-5 flex h-32 w-28 items-center justify-center">
          {/* Marco de escáner */}
          <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 rounded-tl-md border-l-2 border-t-2 border-primary" />
          <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 rounded-tr-md border-r-2 border-t-2 border-primary" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 rounded-bl-md border-b-2 border-l-2 border-primary" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 rounded-br-md border-b-2 border-r-2 border-primary" />
          {/* Documento simulado */}
          <div className="flex h-24 w-16 flex-col gap-1.5 rounded-md bg-muted/60 p-2">
            <span className="h-1.5 w-3/4 rounded-full bg-primary/70" />
            <span className="h-1 w-full rounded-full bg-foreground/20" />
            <span className="h-1 w-5/6 rounded-full bg-foreground/20" />
            <span className="h-1 w-full rounded-full bg-foreground/20" />
            <span className="h-1 w-2/3 rounded-full bg-foreground/20" />
            <span className="mt-auto h-1.5 w-1/2 rounded-full bg-primary/70" />
          </div>
          {/* Check de éxito */}
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--status-success-strong)] text-white shadow">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        </div>

        {trabajoEnCurso ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {subiendo
              ? "Subiendo factura..."
              : "Procesando con IA, puede tardar unos segundos..."}
          </div>
        ) : selectedFile ? (
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span
              className="max-w-[280px] truncate"
              title={selectedFile.name}
            >
              {selectedFile.name}
            </span>
          </div>
        ) : (
          <>
            <p className="text-sm font-bold text-foreground">
              Tocá para subir o arrastrá un archivo
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Foto (JPG, PNG, WEBP · 5 MB) o PDF · 10 MB
            </p>
          </>
        )}

        <div className="mx-auto mt-5 grid max-w-md grid-cols-1 gap-x-6 gap-y-1.5 text-left text-xs sm:grid-cols-2">
          {TIPS_FOTO.map((tip) => (
            <div key={tip.texto} className="flex items-center gap-1.5">
              {tip.ok ? (
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[color:var(--status-success-strong)]"
                  strokeWidth={3}
                />
              ) : (
                <X
                  className="h-3.5 w-3.5 shrink-0 text-destructive"
                  strokeWidth={3}
                />
              )}
              <span
                className={
                  tip.ok
                    ? "text-[color:var(--status-success-strong)]"
                    : "text-destructive"
                }
              >
                {tip.texto}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
