import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Sucursal {
    id: number;
    nombre: string;
    esPrincipal: boolean;
    activa: boolean;
}

interface SucursalState {
    activeSucursalId: number;
    availableSucursales: Sucursal[];
    pedidosVencidosCount: number;
    setActiveSucursalId: (id: number) => void;
    setAvailableSucursales: (sucursales: Sucursal[]) => void;
    setPedidosVencidosCount: (count: number) => void;
}

export const useSucursalStore = create<SucursalState>()(
    persist(
        (set, get) => ({
            activeSucursalId: 1, // Default Sede Principal
            availableSucursales: [],
            pedidosVencidosCount: 0,
            setActiveSucursalId: (id: number) => {
                // Validar que la sucursal exista en las disponibles o sea 0 (Global)
                const exists = id === 0 || get().availableSucursales.find(s => s.id === id);
                if (exists) {
                    set({ activeSucursalId: id });
                }
            },
            setAvailableSucursales: (sucursales: Sucursal[]) => {
                set({ availableSucursales: sucursales });
                // Si la sucursal activa actual no está en la nueva lista, fallback a la primera o la principal
                const currentActiveInfo = sucursales.find(s => s.id === get().activeSucursalId);
                if (!currentActiveInfo && sucursales.length > 0) {
                    const defaultSucursal = sucursales.find(s => s.esPrincipal) || sucursales[0];
                    set({ activeSucursalId: defaultSucursal.id });
                }
            },
            setPedidosVencidosCount: (count: number) => {
                set({ pedidosVencidosCount: count });
            },
        }),
        {
            name: 'sucursal-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
