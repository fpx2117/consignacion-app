// Formulario de datos generales de la factura de proveedor.
//
// Extraído de factura-proveedor-dialog.tsx (M08) sin cambios de comportamiento.

import * as React from "react";
import {
  Building2,
  Calendar,
  CircleDollarSign,
  Hash,
  ScanLine,
  User,
} from "lucide-react";

import {
  type FacturaProveedor,
  type FacturaProveedorItem,
  type Proveedor,
  type UpdateFacturaProveedorInput,
} from "@/lib/apiService";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DATO_FIELD_CLASS } from "./factura-proveedor-helpers";

export type FacturaDatosGeneralesContext = {
  factura: FacturaProveedor;
  proveedores: Proveedor[];
  itemsValidos: FacturaProveedorItem[];
  cantidadTotalUnidades: number;
  totalCalculado: number;
  monedaFactura: string;
  facturaEnMonedaExtranjera: boolean;
  puedeConvertir: boolean;
  cotizacionDolar: number | null;
  facturaBloqueada: boolean;
  formatearArs: (valor: number) => string;
  convertirAArs: (valor: number | null | undefined) => number | null;
  updateFacturaLocal: (patch: Partial<FacturaProveedor>) => void;
  guardarCampoFactura: (patch: UpdateFacturaProveedorInput) => Promise<void>;
  cambiarMonedaFactura: (nuevaMoneda: string) => Promise<void>;
};

export function FacturaDatosGenerales({ ctx }: { ctx: FacturaDatosGeneralesContext }) {
  const {
    factura,
    proveedores,
    itemsValidos,
    cantidadTotalUnidades,
    totalCalculado,
    monedaFactura,
    facturaEnMonedaExtranjera,
    puedeConvertir,
    cotizacionDolar,
    facturaBloqueada,
    formatearArs,
    convertirAArs,
    updateFacturaLocal,
    guardarCampoFactura,
    cambiarMonedaFactura,
  } = ctx;

  return (
  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-base font-black italic tracking-tight">
        Datos generales
      </h3>
      <span className="text-xs text-muted-foreground">
        Editá lo que necesites
      </span>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Proveedor
        </Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select
            value={
              factura.proveedorId
                ? String(factura.proveedorId)
                : "none"
            }
            onValueChange={(v) =>
              guardarCampoFactura({
                proveedorId: v === "none" ? null : Number(v),
              })
            }
            disabled={facturaBloqueada}
          >
            <SelectTrigger
              className={cn(DATO_FIELD_CLASS, "w-full pl-9")}
            >
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              sideOffset={4}
            >
              <SelectItem value="none">Sin asignar</SelectItem>
              {proveedores.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Nombre detectado
        </Label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={factura.proveedorNombreDetectado ?? ""}
            onChange={(e) =>
              updateFacturaLocal({
                proveedorNombreDetectado: e.target.value,
              })
            }
            onBlur={(e) =>
              guardarCampoFactura({
                proveedorNombreDetectado:
                  e.target.value || null,
              })
            }
            disabled={facturaBloqueada}
            placeholder="No detectado"
            className={cn(DATO_FIELD_CLASS, "pl-9")}
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          CUIT
        </Label>
        <div className="relative">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={factura.proveedorCuitDetectado ?? ""}
            onChange={(e) =>
              updateFacturaLocal({
                proveedorCuitDetectado: e.target.value,
              })
            }
            onBlur={(e) =>
              guardarCampoFactura({
                proveedorCuitDetectado: e.target.value || null,
              })
            }
            disabled={facturaBloqueada}
            placeholder="No detectado"
            className={cn(DATO_FIELD_CLASS, "pl-9 font-mono")}
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          N° de factura
        </Label>
        <div className="relative">
          <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={factura.numeroFactura ?? ""}
            onChange={(e) =>
              updateFacturaLocal({
                numeroFactura: e.target.value,
              })
            }
            onBlur={(e) =>
              guardarCampoFactura({
                numeroFactura: e.target.value || null,
              })
            }
            disabled={facturaBloqueada}
            placeholder="—"
            className={cn(DATO_FIELD_CLASS, "pl-9 font-mono")}
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Fecha
        </Label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={
              factura.fecha ? factura.fecha.slice(0, 10) : ""
            }
            onChange={(e) =>
              updateFacturaLocal({
                fecha: e.target.value || null,
              })
            }
            onBlur={(e) =>
              guardarCampoFactura({
                fecha: e.target.value || null,
              })
            }
            disabled={facturaBloqueada}
            className={cn(DATO_FIELD_CLASS, "pl-9")}
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Moneda
        </Label>
        <div className="relative">
          <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Select
            value={monedaFactura}
            onValueChange={cambiarMonedaFactura}
            disabled={facturaBloqueada}
          >
            <SelectTrigger
              className={cn(DATO_FIELD_CLASS, "w-full pl-9")}
            >
              <SelectValue placeholder="ARS" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              sideOffset={4}
            >
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              {monedaFactura !== "ARS" &&
                monedaFactura !== "USD" && (
                  <SelectItem value={monedaFactura}>
                    {monedaFactura}
                  </SelectItem>
                )}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Productos
          <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
            calc.
          </span>
        </Label>
        <div
          className={cn(
            DATO_FIELD_CLASS,
            "flex items-center px-3 font-semibold tabular-nums text-foreground",
          )}
        >
          {itemsValidos.length}{" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            líneas
          </span>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Total ({monedaFactura})
          <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
            calc.
          </span>
        </Label>
        <div
          className={cn(
            DATO_FIELD_CLASS,
            "flex items-center px-3 font-semibold tabular-nums text-foreground",
          )}
          title="Se calcula automáticamente: cantidad × costo unitario de cada línea"
        >
          {totalCalculado.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
      <span>
        Unidades totales:{" "}
        <b className="text-foreground tabular-nums">
          {cantidadTotalUnidades}
        </b>
      </span>
      {facturaEnMonedaExtranjera && (
        <span>
          {puedeConvertir && totalCalculado > 0 ? (
            <>
              Total convertido:{" "}
              <b className="text-primary tabular-nums">
                {formatearArs(convertirAArs(totalCalculado)!)}{" "}
                ARS
              </b>
              {cotizacionDolar
                ? ` (dólar $${cotizacionDolar.toLocaleString("es-AR")})`
                : ""}
            </>
          ) : (
            "El costo se convierte a ARS al confirmar."
          )}
        </span>
      )}
    </div>
  </div>
  );
}
