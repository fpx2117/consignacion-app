// src/types/pedidos-esperados.ts
// Tipos para el modulo de pedidos de reposicion programados

export type EstadoPedidoEsperado =
  | "PROGRAMADO"
  | "VENCIDO"
  | "PARCIAL"
  | "CONFIRMADO"
  | "POSTERGADO"
  | "CANCELADO";

export type EstadoItemPedido =
  | "PENDIENTE"
  | "CONFIRMADO"
  | "PARCIAL"
  | "CANCELADO";

export interface PedidoEsperadoItemProducto {
  id: number;
  nombre: string;
  sku: string | null;
  imagenUrl?: string | null;
  stockDisponibleUnits: number;
}

export interface PedidoEsperadoItem {
  id: number;
  pedidoId: number;
  productoId: number;
  cantidadEsperada: number;
  cantidadRecibida: number;
  estado: EstadoItemPedido;
  producto: PedidoEsperadoItemProducto;
}

export interface PedidoEsperado {
  id: number;
  sucursalId: number;
  fechaEsperada: string; // ISO 8601
  observaciones: string | null;
  estado: EstadoPedidoEsperado;
  creadoPor: number;
  createdAt: string;
  updatedAt: string;
  items: PedidoEsperadoItem[];
}

export interface CreatePedidoEsperadoRequest {
  sucursalId: number;
  fechaEsperada: string; // ISO 8601
  observaciones?: string;
  items: {
    productoId: number;
    cantidadEsperada: number;
  }[];
}

export interface ConfirmarPedidoRequest {
  items: {
    itemId: number;
    cantidadRecibida: number;
  }[];
}

export interface PostergarPedidoRequest {
  nuevaFecha: string; // ISO 8601
  motivo?: string;
}

export interface UpdatePedidoRequest {
  observaciones?: string;
  estado?: "CANCELADO";
}

export interface ConfirmarPedidoResponse {
  pedido: {
    id: number;
    estado: EstadoPedidoEsperado;
    updatedAt: string;
  };
  movimientos: {
    id: number;
    productoId: number;
    tipo: string;
    motivo: string;
    cantidad: number;
    stockPrevio: number;
    stockPosterior: number;
  }[];
}
