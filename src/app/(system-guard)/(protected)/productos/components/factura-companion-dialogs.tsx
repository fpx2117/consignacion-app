// Diálogos que acompañan a la revisión de factura: crear producto, elegir uno
// existente y confirmación masiva.
//
// Extraídos de factura-proveedor-dialog.tsx (M08) sin cambios de comportamiento.

import * as React from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import {
  apiService,
  type FacturaProveedor,
  type FacturaProveedorItem,
} from "@/lib/apiService";
import type { Producto } from "@/lib/types";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreateProductoDialog,
  type CreateProductoInitialValues,
  type ProductoCreado,
} from "./create-producto-dialog";
import { SeleccionarProductoExistenteDialog } from "./seleccionar-producto-existente-dialog";

export type FacturaCompanionDialogsContext = {
  factura: FacturaProveedor | null;
  items: FacturaProveedorItem[] | null;
  productos: Producto[];
  itemParaCrear: FacturaProveedorItem | null;
  itemIdParaMatch: number | null;
  confirmarProveedorOpen: boolean;
  onCreated: (() => void) | undefined;
  initialValuesParaNuevoProducto: (
    item: FacturaProveedorItem,
  ) => CreateProductoInitialValues;
  confirmarTodosSeguros: () => void;
  updateItem: (itemId: number, patch: Partial<FacturaProveedorItem>) => void;
  setItemParaCrear: (item: FacturaProveedorItem | null) => void;
  setItemIdParaMatch: (id: number | null) => void;
  setConfirmarProveedorOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function FacturaCompanionDialogs({ ctx }: { ctx: FacturaCompanionDialogsContext }) {
  const {
    factura,
    items,
    productos,
    itemParaCrear,
    itemIdParaMatch,
    confirmarProveedorOpen,
    onCreated,
    initialValuesParaNuevoProducto,
    confirmarTodosSeguros,
    updateItem,
    setItemParaCrear,
    setItemIdParaMatch,
    setConfirmarProveedorOpen,
  } = ctx;

  return (
    <>
      {itemParaCrear && (
    <CreateProductoDialog
      open={Boolean(itemParaCrear)}
      onOpenChange={(v) => {
        if (!v) setItemParaCrear(null);
      }}
      initialValues={initialValuesParaNuevoProducto(itemParaCrear)}
      submitFn={(payload) =>
        apiService
          .createProductoDesdeFacturaItem(itemParaCrear.id, payload)
          .then((res): ProductoCreado => {
            if (res.tipoCambioAplicado) {
              toast.message(
                `Costo convertido a ARS con cotización $${res.tipoCambioAplicado.toLocaleString("es-AR")}`,
              );
            } else if (res.advertenciaConversion) {
              toast.warning(res.advertenciaConversion);
            }
            return {
              id: res.producto.id,
              nombre: res.producto.nombre,
              sku: null,
              codigoBarra: res.producto.codigoBarra ?? null,
              stockDisponibleUnits: Number(
                (res.producto as { stockDisponibleUnits?: unknown })
                  .stockDisponibleUnits ?? 0,
              ),
            };
          })
      }
      onProductoCreado={() => {
        updateItem(itemParaCrear.id, { estado: "PRODUCTO_CREADO" });
        setItemParaCrear(null);
        onCreated?.();
      }}
    />
  )}

  <SeleccionarProductoExistenteDialog
    open={itemIdParaMatch !== null}
    onOpenChange={(v) => {
      if (!v) setItemIdParaMatch(null);
    }}
    productos={productos}
    productoIdSeleccionado={
      items?.find((i) => i.id === itemIdParaMatch)?.productoId ?? null
    }
    onSelect={(productoId) => {
      if (itemIdParaMatch !== null)
        updateItem(itemIdParaMatch, { productoId });
    }}
  />

  <AlertDialog
    open={confirmarProveedorOpen}
    onOpenChange={setConfirmarProveedorOpen}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Confirmá los datos del proveedor
        </AlertDialogTitle>
        <AlertDialogDescription>
          {factura?.proveedorId
            ? "Este proveedor se asignó automáticamente a partir de lo que detectó la IA. Revisá que sea correcto antes de confirmar los productos — el aprendizaje de futuras facturas (códigos y alias) se guarda contra este proveedor."
            : "No se pudo asignar ningún proveedor para esta factura. Podés confirmar los productos igual, pero no se va a guardar ningún alias para reconocerlos más rápido la próxima vez."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Nombre</span>
          <span className="font-medium text-right truncate">
            {factura?.proveedor?.nombre ??
              factura?.proveedorNombreDetectado ??
              "Sin detectar"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">CUIT</span>
          <span className="font-mono text-right">
            {factura?.proveedor?.cuit ??
              factura?.proveedorCuitDetectado ??
              "Sin detectar"}
          </span>
        </div>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>Revisar antes</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => {
            setConfirmarProveedorOpen(false);
            confirmarTodosSeguros();
          }}
        >
          Es correcto, confirmar todo
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
    </>
  );
}
