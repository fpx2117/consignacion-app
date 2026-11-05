// Encabezado de la vista de productos: título y acciones.
//
// Extraído de productos-view.tsx (M21) sin cambios de comportamiento.

import * as React from "react";
import Link from "next/link";
import { ExternalLink, MoreVertical, Package, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DownloadInventoryButton } from "@/components/reports/download-inventory-button";

import HistoryReportDialog from "./historial-report-dialog";
import { FacturaProveedorDialog } from "./factura-proveedor-dialog";
import { CreateProductoDialog } from "./create-producto-dialog";

export function ProductosHeader({
  catalogoHref,
  reload,
}: {
  catalogoHref: string;
  reload: () => void;
}) {
  return (
  <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
    <div className="space-y-1.5">
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
        <Package className="h-8 w-8 md:h-10 md:w-10 text-primary" />
        Inventario
      </h1>
      <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
        Gestiona tu catálogo, controla existencias y supervisá la
        rentabilidad en tiempo real.
      </p>
    </div>

    {/* â”€â”€ BOTONES HEADER â”€â”€ */}
    <div className="flex items-center gap-3 w-full sm:w-auto">
      {/* DESKTOP: todos los botones visibles */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Grupo secundario */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50">
          <HistoryReportDialog />
          <DownloadInventoryButton />
          <FacturaProveedorDialog onCreated={reload} />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-lg font-bold text-sm hover:bg-background hover:text-primary transition-all"
          >
            <Link
              href={catalogoHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Catálogo
            </Link>
          </Button>
        </div>
        {/* CTA principal */}
        <CreateProductoDialog
          onCreated={reload}
          onCategoriasChanged={reload}
          trigger={
            <Button
              size="lg"
              className="h-10 px-5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4 mr-2 stroke-[3px]" />
              Nuevo Producto
            </Button>
          }
        />
      </div>

      {/* MOBILE: CTA principal izquierda, ⋯ derecha */}
      <div className="flex sm:hidden items-center justify-between w-full">
        {/* CTA principal siempre visible */}
        <CreateProductoDialog
          onCreated={reload}
          onCategoriasChanged={reload}
          trigger={
            <Button
              size="default"
              className="h-10 px-4 rounded-xl font-bold shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" />
              Nuevo
            </Button>
          }
        />
        {/* Dropdown ⋯ — siempre al extremo derecho */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-border/60"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            className="w-56 rounded-xl border-border/60 shadow-xl p-1.5 space-y-0.5"
          >
            {/* Auditoría — [&_span]:!inline fuerza el texto aunque tenga hidden sm:inline */}
            <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none [&_span]:!inline">
              <HistoryReportDialog />
            </div>
            {/* Ver PDF */}
            <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none">
              <DownloadInventoryButton />
            </div>
            <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none">
              <FacturaProveedorDialog onCreated={reload} />
            </div>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              asChild
              className="rounded-lg font-semibold cursor-pointer h-10"
            >
              <Link
                href={catalogoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5"
              >
                <ExternalLink className="h-4 w-4 text-primary" />
                Ver Catálogo público
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
  );
}
