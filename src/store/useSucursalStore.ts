import { create } from "zustand";
import { postAppMessage } from "@/lib/broadcast-channel";
import type { PlanLimits } from "@/lib/subscriptions/require-subscription";

export interface Sucursal {
  id: number;
  nombre: string;
  esPrincipal: boolean;
  activa: boolean;
}

export interface HydratePayload {
  activeSucursalId: number;
  availableSucursales: Sucursal[];
  planLimits: PlanLimits | null;
}

interface SucursalState {
  activeSucursalId: number;
  availableSucursales: Sucursal[];
  isHydrated: boolean;
  planLimits: PlanLimits | null;
  pedidosVencidosCount: number;

  hydrate: (data: HydratePayload) => void;
  switchSucursal: (id: number) => Promise<void>;
  setPedidosVencidosCount: (count: number) => void;
}

export const useSucursalStore = create<SucursalState>()((set) => ({
  activeSucursalId: 1,
  availableSucursales: [],
  isHydrated: false,
  planLimits: null,
  pedidosVencidosCount: 0,

  hydrate: (data: HydratePayload) => {
    set({
      activeSucursalId: data.activeSucursalId,
      availableSucursales: data.availableSucursales,
      planLimits: data.planLimits,
      isHydrated: true,
    });
    // Migración: limpiar localStorage legacy en la primera hidratación
    if (typeof window !== "undefined") {
      localStorage.removeItem("sucursal-storage");
      localStorage.removeItem("subscription_limits");
      localStorage.removeItem("usarControlDeCaja");
    }
  },

  switchSucursal: async (id: number) => {
    const res = await fetch("/api/sucursal/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sucursalId: id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `Error al cambiar sucursal (${res.status})`);
    }

    set({ activeSucursalId: id });
    postAppMessage({ type: "sucursal-changed", sucursalId: id });
  },

  setPedidosVencidosCount: (count: number) => {
    set({ pedidosVencidosCount: count });
  },
}));
