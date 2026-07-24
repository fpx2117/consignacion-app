import { z } from "zod";

export const consignacionItemSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  unitsEntregadas: z.coerce.number().int().positive(),
  descuento: z.coerce.number().optional(),
});

export const createConsignacionSchema = z.object({
  clienteId: z.number(),
  porcentajeAumento: z.number().min(0).default(0).optional(),
  items: z.array(
    z.object({
      productoId: z.number(),
      unitsEntregadas: z.number().min(1),
      descuento: z.number().optional(),
    }),
  ),
});

export const liquidacionItemSchema = z.object({
  consignacionDetalleId: z.coerce.number().int().positive(),
  unitsVendidas: z.coerce.number().int().nonnegative().default(0),
  unitsDevueltas: z.coerce.number().int().nonnegative().default(0),
  descuento: z.coerce.number().optional(),
});

// 👇 AQUÍ ESTABA EL ERROR: Faltaba consignacionId
export const createLiquidacionSchema = z.object({
  consignacionId: z.number().int().positive(), // <--- Agregado esto
  items: z.array(liquidacionItemSchema).min(1),
});
