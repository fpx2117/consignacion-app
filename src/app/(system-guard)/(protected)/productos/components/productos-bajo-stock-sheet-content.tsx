import {
  StockDrawerProductList,
  type ProductoStockAlertItem,
} from "./stock-drawer-product-list";

interface ProductosBajoStockSheetContentProps {
  productos: ProductoStockAlertItem[];
  onStockUpdated: () => void;
}

export function ProductosBajoStockSheetContent({
  productos,
  onStockUpdated,
}: ProductosBajoStockSheetContentProps) {
  const count = productos.length;

  return (
    <StockDrawerProductList
      productos={productos}
      title="Productos con Stock Bajo"
      description={`${count} producto${count !== 1 ? "s" : ""} por debajo del minimo`}
      emptyMessage="Stock en niveles saludables"
      variant="low"
      onStockUpdated={onStockUpdated}
    />
  );
}
