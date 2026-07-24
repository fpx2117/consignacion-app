"use client";

import * as React from "react";
import { useSucursalStore } from "@/store/useSucursalStore";
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
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const sucursalHeaders = React.useMemo(
    (): Record<string, string> =>
      Number.isFinite(activeSucursalId) && activeSucursalId >= 0
        ? { "x-sucursal-id": String(activeSucursalId) }
        : {},
    [activeSucursalId],
  );
  const [pedidos, setPedidos] = React.useState<PedidoEsperado[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPedidos = React.useCallback(
    async (filtros: FetchFiltros = {}) => {
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

        const res = await fetch(`/api/pedidos-esperados?${params.toString()}`, {
          headers: sucursalHeaders,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Error al cargar pedidos");
        const data = await res.json();
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setPedidos(arr);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error desconocido";
        setError(message);
        setPedidos([]);
      } finally {
        setLoading(false);
      }
    },
    [sucursalHeaders],
  );

  const crearPedido = React.useCallback(
    async (input: CreatePedidoEsperadoRequest): Promise<PedidoEsperado> => {
      const res = await fetch("/api/pedidos-esperados", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sucursalHeaders },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({}) as Record<string, unknown>);
        throw new Error(
          typeof body.error === "string" ? body.error : "Error al crear pedido",
        );
      }
      const data = (await res.json()) as
        { data?: PedidoEsperado } | PedidoEsperado;
      return (
        (data as { data?: PedidoEsperado }).data ?? (data as PedidoEsperado)
      );
    },
    [sucursalHeaders],
  );

  const confirmarPedido = React.useCallback(
    async (id: number, input: ConfirmarPedidoRequest): Promise<void> => {
      const res = await fetch(`/api/pedidos-esperados/${id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sucursalHeaders },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({}) as Record<string, unknown>);
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Error al confirmar pedido",
        );
      }
    },
    [sucursalHeaders],
  );

  const postergarPedido = React.useCallback(
    async (id: number, input: PostergarPedidoRequest): Promise<void> => {
      const res = await fetch(`/api/pedidos-esperados/${id}/postergar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sucursalHeaders },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({}) as Record<string, unknown>);
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Error al postergar pedido",
        );
      }
    },
    [sucursalHeaders],
  );

  const cancelarPedido = React.useCallback(
    async (id: number): Promise<void> => {
      const res = await fetch(`/api/pedidos-esperados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sucursalHeaders },
        body: JSON.stringify({
          estado: "CANCELADO",
        } satisfies UpdatePedidoRequest),
      });
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({}) as Record<string, unknown>);
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Error al cancelar pedido",
        );
      }
    },
    [sucursalHeaders],
  );

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
