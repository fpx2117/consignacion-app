// Tipos compartidos de la vista de productos.
//
// Extraídos de productos-view.tsx (M08) para que los componentes separados no
// dependan del archivo principal.

import type { Producto } from "@/lib/types";

export type SortKey =
  | "nombre"
  | "precioVenta"
  | "stockDisponibleUnits"
  | "categoria"
  | `attr:${string}`;

export type SortDirection = "asc" | "desc";

export type ProductoViewItem = Producto & {
  subcategoria?: {
    nombre?: string | null;
  } | null;
};

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

// Clave sintética para "Vencimiento" en el picker de columnas — no es un
// atributo de rubro, es Producto.fechaVencimiento, pero comparte el mismo
// mecanismo de columnasAtributosProducto para que el usuario la pueda
// ocultar/mostrar igual que Marca/Sabor/Puffs.
export const COLUMNA_VENCIMIENTO = "vencimiento";
