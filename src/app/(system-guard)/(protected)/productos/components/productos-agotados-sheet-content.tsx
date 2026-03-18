import { StockDrawerProductList, type ProductoStockAlertItem } from "./stock-drawer-product-list";

interface ProductosAgotadosSheetContentProps {
  productos: ProductoStockAlertItem[];
  onStockUpdated: () => void;
}

export function ProductosAgotadosSheetContent({
  productos,
  onStockUpdated,
}: ProductosAgotadosSheetContentProps) {
  const count = productos.length;

  return (
    <StockDrawerProductList
      productos={productos}
      title="Productos Agotados"
      description={`${count} producto${count !== 1 ? "s" : ""} sin stock disponible`}
      emptyMessage="Sin productos agotados"
      variant="out"
      onStockUpdated={onStockUpdated}
    />
  );
}
