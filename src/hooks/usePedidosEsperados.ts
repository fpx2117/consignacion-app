// @ts-nocheck
"use client";

import * as React from "react";
import type {
  PedidoEsperado,
  CreatePedidoEsperadoRequest,
  ConfirmarPedidoRequest,
  PostergarPedidoRequest,
  UpdatePedidoRequest,
} from "@/types/pedidos-esperados";

interface FetchFiltros {
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

interface UsePedidosEsperadosReturn {
  pedidos: PedidoEsperado[];
  loading: boolean;
  error: string | null;
  fetchPedidos: (filtros?: FetchFiltros) => Promise<void>;
  crearPedido: (input: CreatePedidoEsperadoRequest) => Promise<PedidoEsperado>;
  confirmarPedido: (id: number, input: ConfirmarPedidoRequest) => Promise<void>;
  postergarPedido: (id: number, input: PostergarPedidoRequest) => Promise<void>;
  cancelarPedido: (id: number) => Promise<void>;
}

export function usePedidosEsperados(): UsePedidosEsperadosReturn {
  const [pedidos, setPedidos] = React.useState<PedidoEsperado[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPedidos = React.useCallback(async (filtros: FetchFiltros = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtros.estado && filtros.estado !== "all") {
        if (filtros.estado === "pendientes") {
          params.append("estado", "PROGRAMADO");
          params.append("estado", "VENCIDO");
        } else {
          params.append("estado", filtros.estado);
        }
      }
      if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
      if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);

      const res = await fetch(`/api/pedidos-esperados?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar pedidos");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setPedidos(arr);
    } catch (err: any) {
      setError(err.message || "Error desconocido");
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const crearPedido = React.useCallback(async (input: CreatePedidoEsperadoRequest): Promise<PedidoEsperado> => {
    const res = await fetch("/api/pedidos-esperados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al crear pedido");
    }
    const data = await res.json();
    return data?.data ?? data;
  }, []);

  const confirmarPedido = React.useCallback(
    async (id: number, input: ConfirmarPedidoRequest): Promise<void> => {
      const res = await fetch(`/api/pedidos-esperados/${id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al confirmar pedido");
      }
    },
    []
  );

  const postergarPedido = React.useCallback(
    async (id: number, input: PostergarPedidoRequest): Promise<void> => {
      const res = await fetch(`/api/pedidos-esperados/${id}/postergar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al postergar pedido");
      }
    },
    []
  );

  const cancelarPedido = React.useCallback(async (id: number): Promise<void> => {
    const res = await fetch(`/api/pedidos-esperados/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "CANCELADO" } satisfies UpdatePedidoRequest),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al cancelar pedido");
    }
  }, []);

  return {
    pedidos,
    loading,
    error,
    fetchPedidos,
    crearPedido,
    confirmarPedido,
    postergarPedido,
    cancelarPedido,
  };
}
