// src/lib/validators/pedidos-esperados.ts
// Esquemas de validacion Zod para el modulo de pedidos de reposicion programados
// Patron: igual a src/lib/validators/producto.ts

import { z } from "zod";

export const createPedidoSchema = z.object({
  sucursalId: z.number().int().positive(),
  fechaEsperada: z.string().datetime({ offset: true }),
  observaciones: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        cantidadEsperada: z.number().int().min(1),
      })
    )
    .min(1, "El pedido debe tener al menos un item"),
});

export const confirmarPedidoSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        cantidadRecibida: z.number().int().min(0),
      })
    )
    .min(1),
});

export const postergarPedidoSchema = z.object({
  nuevaFecha: z.string().datetime({ offset: true }),
  motivo: z.string().max(300).optional(),
});

export const updatePedidoSchema = z.object({
  observaciones: z.string().max(500).optional(),
  estado: z.enum(["CANCELADO"]).optional(),
});

export type CreatePedidoInput = z.infer<typeof createPedidoSchema>;
export type ConfirmarPedidoInput = z.infer<typeof confirmarPedidoSchema>;
export type PostergarPedidoInput = z.infer<typeof postergarPedidoSchema>;
export type UpdatePedidoInput = z.infer<typeof updatePedidoSchema>;
