import { z } from "zod";

export const createProductoSchema = z.object({
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
  descuentos: z.array(z.object({
    cantidadMin: z.number().int().min(1),
    porcentaje: z.number().min(0).max(100),
  })).nullish(),
});

// Corregimos el UpdateProductoInput para que acepte NULL explícitamente
export const updateProductoSchema = createProductoSchema.partial().extend({
  activo: z.boolean().optional(),
  codigoBarra: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
  // Sobrescribir para eliminar .default(0) que resetea el stock al editar
  stockDisponibleUnits: z.number().int().min(0).optional(),
  stockMinUnits: z.number().int().min(0).optional(),
});

export type CreateProductoInput = z.infer<typeof createProductoSchema>;
export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;