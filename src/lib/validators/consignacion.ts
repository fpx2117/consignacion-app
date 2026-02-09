import { z } from "zod";

export const consignacionItemSchema = z.object({
  productoId: z.coerce.number().int().positive(),
  unitsEntregadas: z.coerce.number().int().positive(),
});

export const createConsignacionSchema = z.object({
  clienteId: z.number(),
  // Agregamos esto:
  porcentajeAumento: z.number().min(0).default(0).optional(), 
  items: z.array(z.object({
    productoId: z.number(),
    unitsEntregadas: z.number().min(1),
  })),
});

export const liquidacionItemSchema = z.object({
  consignacionDetalleId: z.coerce.number().int().positive(),
  unitsVendidas: z.coerce.number().int().nonnegative().default(0),
  unitsDevueltas: z.coerce.number().int().nonnegative().default(0),
});

export const createLiquidacionSchema = z.object({
  items: z.array(liquidacionItemSchema).min(1),
});
