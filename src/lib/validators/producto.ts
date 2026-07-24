import { z } from "zod";

const descuentoFields = {
  tipoDescuento: z
    .enum(["porcentaje", "monto"])
    .optional()
    .default("porcentaje"),
  descuentoPorcentaje: z.number().min(1).max(99).nullable().optional(),
  descuentoMonto: z.number().min(0.01).nullable().optional(),
  descuentoActivo: z.boolean().optional().default(false),
  descuentoDesde: z.string().datetime({ offset: true }).nullable().optional(),
  descuentoHasta: z.string().datetime({ offset: true }).nullable().optional(),
};

const fechasRefine = (data: {
  descuentoDesde?: string | null;
  descuentoHasta?: string | null;
}) => {
  if (data.descuentoDesde && data.descuentoHasta) {
    return new Date(data.descuentoHasta) > new Date(data.descuentoDesde);
  }
  return true;
};

// Schema base sin .refine() — se puede usar con .partial()
const createProductoBaseSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().nullish(),
  codigoBarra: z.string().nullish(),
  sku: z.string().nullish(),
  precioVenta: z.number().positive(),
  precioCosto: z.number().min(0),
  iva: z.number().default(21.0),
  stockDisponibleUnits: z.number().int().min(0).default(0),
  stockMinUnits: z.number().int().min(0).default(0),
  packSizeUnits: z.number().int().positive().nullish(),
  fechaVencimiento: z.string().nullish(),
  categoriaId: z.number().int().nullish(),
  imagenUrl: z.string().nullish(),
  // Atributos libres (lote, vencimiento, talle, color, etc.) — mismo formato
  // que FacturaProveedorItem.atributosExtra. Genérico entre rubros, sin
  // validación de claves específicas.
  atributosExtra: z.record(z.string(), z.string()).nullish(),
  ...descuentoFields,
});

export const createProductoSchema = createProductoBaseSchema.refine(
  fechasRefine,
  {
    message: "La fecha de fin debe ser posterior a la fecha de inicio",
    path: ["descuentoHasta"],
  },
);

// Corregimos el UpdateProductoInput para que acepte NULL explícitamente
export const updateProductoSchema = createProductoBaseSchema
  .partial()
  .extend({
    activo: z.boolean().optional(),
    codigoBarra: z.string().nullable().optional(),
    sku: z.string().nullable().optional(),
    fechaVencimiento: z.string().nullable().optional(),
    // Sobrescribir para eliminar .default(0) que resetea el stock al editar
    stockDisponibleUnits: z.number().int().min(0).optional(),
    stockMinUnits: z.number().int().min(0).optional(),
  })
  .refine(fechasRefine, {
    message: "La fecha de fin debe ser posterior a la fecha de inicio",
    path: ["descuentoHasta"],
  });

export type CreateProductoInput = z.infer<typeof createProductoSchema>;
export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;
