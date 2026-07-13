"use client";

import * as React from "react";
import type { CreateProductoInput } from "@/lib/types";
import {
  ProductoWizardDialog,
  type ProductoCreado,
  type CreateProductoInitialValues,
} from "./producto-wizard-dialog";

export type { ProductoCreado, CreateProductoInitialValues };

export function CreateProductoDialog({
  trigger,
  onCreated,
  onProductoCreado,
  initialValues,
  submitFn,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  onCreated?: () => void;
  onProductoCreado?: (producto: ProductoCreado) => void;
  /** Prellenado opcional (ej: desde un item de factura OCR). El usuario puede editar todo antes de crear. */
  initialValues?: CreateProductoInitialValues;
  /** Override del submit por defecto (apiService.createProducto). Lo usa el flujo de OCR para pegarle al
   * endpoint que además suma stock/costo/alias asociados a un item de factura, en vez del alta genérica. */
  submitFn?: (payload: CreateProductoInput) => Promise<ProductoCreado>;
  /** Control externo del dialog (para abrirlo programáticamente, ej. desde la pantalla de revisión de OCR). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ProductoWizardDialog
      mode="create"
      trigger={trigger}
      onCreated={onCreated}
      onProductoCreado={onProductoCreado}
      initialValues={initialValues}
      submitFn={submitFn}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
