import type { LucideIcon } from "lucide-react";
import type { DescuentoNivel, MetodoPago, Producto } from "@/lib/types";

export type ProductoConStock = Producto & {
  stockDisponibleUnits?: number;
  subcategoriaId?: number | null;
  subcategoria?: {
    nombre?: string;
    descuentos?: DescuentoNivel[] | null;
  } | null;
};

export type CartItem = {
  producto: ProductoConStock;
  quantity: number;
};

export type MetodoPagoOption = {
  value: MetodoPago;
  label: string;
  icon: LucideIcon;
};

export type DiscountTuple = {
  best: DescuentoNivel | null;
  next: DescuentoNivel | null;
};
