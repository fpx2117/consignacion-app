import { z } from "zod";

export const createClienteSchema = z.object({
  nombre: z.string().min(2),
  telefono: z.string().min(6).optional(),
  direccion: z.string().min(3).optional(),
});

export const updateClienteSchema = createClienteSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, "Debe enviar al menos un campo.");

export const createPagoSchema = z.object({
  monto: z.coerce.number().positive(),
  metodo: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "OTRO"]),
});
