// Columna lateral del diálogo de factura: vista previa y resumen.
//
// Extraída de factura-proveedor-dialog.tsx (M08) sin cambios de comportamiento.
// El JSX está copiado tal cual; las dependencias del padre llegan por `ctx`.

import * as React from "react";
import { CheckCircle2, FileText, Loader2, ScanLine } from "lucide-react";

import { API_ROUTES, type FacturaProveedor } from "@/lib/apiService";

import { Button } from "@/components/ui/button";
import type { FiltroFactura } from "./factura-proveedor-helpers";

export type FacturaResumenLateralContext = {
  factura: FacturaProveedor;
  conteos: Record<FiltroFactura, number>;
  monedaFactura: string;
  totalCalculado: number;
  puedeConvertir: boolean;
  formatearArs: (valor: number) => string;
  convertirAArs: (valor: number | null | undefined) => number | null;
  imagenPreviewError: boolean;
  setImagenPreviewError: React.Dispatch<React.SetStateAction<boolean>>;
  setConfirmarProveedorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  confirmandoTodos: boolean;
  facturaBloqueada: boolean;
};

export function FacturaResumenLateral({ ctx }: { ctx: FacturaResumenLateralContext }) {
  const {
    factura,
    conteos,
    monedaFactura,
    totalCalculado,
    puedeConvertir,
    formatearArs,
    convertirAArs,
    imagenPreviewError,
    setImagenPreviewError,
    setConfirmarProveedorOpen,
    confirmandoTodos,
    facturaBloqueada,
  } = ctx;

  return (

  <div className="flex flex-col gap-4 xl:sticky xl:top-0">
    {/* Vista previa de la factura */}
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Factura escaneada
      </div>
      <div className="flex items-center justify-center bg-muted/30 p-3">
        {factura.archivoEliminado ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            El archivo original ya no está disponible.
          </div>
        ) : imagenPreviewError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            No se pudo cargar la imagen original.
          </div>
        ) : factura.archivoMime?.startsWith("image/") ? (
          <a
            href={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(
              factura.id,
            )}
            target="_blank"
            rel="noreferrer"
            className="block w-full"
            title="Abrir la factura original en tamaño completo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(
                factura.id,
              )}
              alt="Factura escaneada"
              className="mx-auto max-h-[320px] w-full cursor-zoom-in rounded-lg object-contain"
              onError={() => setImagenPreviewError(true)}
            />
          </a>
        ) : factura.archivoMime === "application/pdf" ? (
          <a
            href={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(
              factura.id,
            )}
            target="_blank"
            rel="noreferrer"
            className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg text-sm font-medium text-primary hover:underline"
          >
            <FileText className="h-8 w-8" />
            Abrir PDF original
          </a>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            Sin vista previa disponible.
          </div>
        )}
      </div>
    </div>

    {/* Resumen de la revisión */}
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h3 className="mb-3 text-base font-black italic tracking-tight">
        Resumen de la revisión
      </h3>
      <div className="mb-3 border-b border-border pb-3">
        <p className="truncate font-semibold">
          {factura.proveedor?.nombre ??
            factura.proveedorNombreDetectado ??
            "Proveedor sin asignar"}
        </p>
        {(factura.proveedor?.cuit ??
          factura.proveedorCuitDetectado) && (
          <p className="font-mono text-xs text-muted-foreground">
            CUIT{" "}
            {factura.proveedor?.cuit ??
              factura.proveedorCuitDetectado}
          </p>
        )}
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Detectados</dt>
          <dd className="font-mono font-bold tabular-nums">
            {conteos.todos}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Confirmados</dt>
          <dd className="font-mono font-bold tabular-nums text-[color:var(--status-success-strong)]">
            {conteos.confirmado}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Pendientes</dt>
          <dd className="font-mono font-bold tabular-nums text-[color:var(--status-warning)]">
            {conteos.pendiente}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">
            Sin coincidencia
          </dt>
          <dd className="font-mono font-bold tabular-nums text-[color:var(--status-danger)]">
            {conteos["sin-match"]}
          </dd>
        </div>
      </dl>
      <div className="my-3 space-y-1.5 border-y border-border py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            Total ({monedaFactura})
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {totalCalculado.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        {puedeConvertir && totalCalculado > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Convertido
            </span>
            <span className="font-mono text-base font-extrabold tabular-nums">
              {formatearArs(convertirAArs(totalCalculado)!)}
            </span>
          </div>
        )}
      </div>
      <Button
        type="button"
        className="h-11 w-full rounded-full font-bold shadow-lg shadow-primary/20"
        onClick={() => setConfirmarProveedorOpen(true)}
        disabled={confirmandoTodos || facturaBloqueada}
      >
        {confirmandoTodos ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Confirmar ingreso
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Nada se actualiza hasta confirmar.
      </p>
    </div>

    {/* Barra de confianza */}
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScanLine className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold">Seguridad</p>
          <p className="text-[11px] text-muted-foreground">
            Tu info está protegida
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold">Sin riesgos</p>
          <p className="text-[11px] text-muted-foreground">
            Editá u omití antes
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold">Control total</p>
          <p className="text-[11px] text-muted-foreground">
            Vos tenés la última palabra
          </p>
        </div>
      </div>
    </div>
  </div>
  );
}
