import { z } from "zod";

export const liquidacionItemSchema = z.object({
  consignacionDetalleId: z.number().int().positive(),
  unitsVendidas: z.number().int().min(0).default(0),
  unitsDevueltas: z.number().int().min(0).default(0),
});

export const createLiquidacionBodySchema = z.object({
  items: z.array(liquidacionItemSchema).min(1),
});
