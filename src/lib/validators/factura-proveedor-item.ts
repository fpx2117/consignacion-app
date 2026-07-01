import { z } from "zod";

export const confirmarItemSchema = z.object({
  productoId: z.number().int().positive(),
});

export type ConfirmarItemInput = z.infer<typeof confirmarItemSchema>;
