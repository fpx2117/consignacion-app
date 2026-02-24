"use client";

import * as React from "react";
import { Store, ChevronDown } from "lucide-react";
import { useSucursalStore } from "@/store/useSucursalStore";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
    const { availableSucursales, activeSucursalId, setActiveSucursalId } = useSucursalStore();
    const pathname = usePathname();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    // No mostrar si no hay sucursales cargadas
    if (availableSucursales.length === 0) return null;

    const activeSucursal = availableSucursales.find((s) => s.id === activeSucursalId) || availableSucursales[0];

    return (
        <div className="fixed top-0 left-0 right-0 h-20 z-40 bg-background/80 backdrop-blur-md border-b flex items-center justify-between px-6 md:pr-10 md:pl-[110px] transition-all">
            <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-foreground/80 md:hidden">
                    POS App
                </h1>
            </div>

            <div className="flex items-center gap-4">
                {availableSucursales.length > 1 ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20">
                                <Store className="h-4 w-4" />
                                <span className="text-sm font-bold max-w-[150px] truncate">
                                    {activeSucursal?.nombre}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] rounded-2xl p-2 border-border/50 shadow-xl">
                            <div className="px-2 py-1.5 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70 mb-1">
                                Cambiar de Sucursal
                            </div>
                            {availableSucursales.map((s) => (
                                <DropdownMenuItem
                                    key={s.id}
                                    onClick={() => setActiveSucursalId(s.id)}
                                    className={cn(
                                        "rounded-xl cursor-pointer mb-1",
                                        activeSucursalId === s.id ? "bg-primary text-primary-foreground font-bold" : "hover:bg-muted"
                                    )}
                                >
                                    <Store className="mr-2 h-4 w-4 opacity-70" />
                                    <span>{s.nombre}</span>
                                    {s.esPrincipal && (
                                        <span className="ml-auto text-[8px] uppercase tracking-wider bg-background/20 px-1.5 py-0.5 rounded-sm">
                                            Sede
                                        </span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground border border-border/50">
                        <Store className="h-4 w-4" />
                        <span className="text-sm font-semibold max-w-[150px] truncate">
                            {activeSucursal?.nombre || "Cargando..."}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
