// Paginación y encabezado ordenable de la tabla de productos.
//
// Extraídos de productos-view.tsx (M08) sin cambios de comportamiento.

import * as React from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { SortConfig, SortKey } from "./productos-view-types";

export function PaginationControls({
  itemsPerPage,
  setItemsPerPage,
  totalItems,
  currentItems,
  isMobile = false,
  serverPage,
  serverTotalPages,
  onServerPrev,
  onServerNext,
}: {
  itemsPerPage: number;
  setItemsPerPage: (v: number) => void;
  totalItems: number;
  currentItems: number;
  isMobile?: boolean;
  serverPage?: number;
  serverTotalPages?: number;
  onServerPrev?: () => void;
  onServerNext?: () => void;
}) {
  const page = serverPage ?? 1;
  const totalPages = serverTotalPages ?? 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-4 border-t border-border/60 bg-muted/20",
        isMobile && "flex-col border rounded-xl bg-card",
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Mostrando {currentItems} de{" "}
          <span className="font-bold text-foreground">{totalItems}</span>
        </span>
      </div>

      <div
        className={cn(
          "flex items-center gap-4",
          isMobile && "w-full justify-between",
        )}
      >
        {!isMobile && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filas:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(v) => setItemsPerPage(Number(v))}
            >
              <SelectTrigger className="h-8 w-[80px] text-xs font-bold">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="9999">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onServerPrev}
            disabled={!onServerPrev || page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm font-bold">{page}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onServerNext}
            disabled={!onServerNext || page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SortableHead({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortConfig;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead
      className={cn(
        "py-4 transition-colors cursor-pointer select-none hover:bg-muted/50 hover:text-foreground",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          className?.includes("text-right") && "justify-end",
          className?.includes("text-center") && "justify-center",
        )}
      >
        <span
          className={cn(
            "font-bold text-xs uppercase tracking-wider",
            isActive ? "text-primary" : "text-muted-foreground/70",
          )}
        >
          {label}
        </span>
        <ArrowUpDown
          className={cn(
            "h-3 w-3 transition-opacity",
            isActive ? "text-primary opacity-100" : "opacity-0",
          )}
        />
      </div>
    </TableHead>
  );
}

