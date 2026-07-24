"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Proveedor } from "@/lib/apiService";
import { apiService } from "@/lib/apiService";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Hash, Coins, Pencil, Truck } from "lucide-react";
import { EditProveedorDialog } from "../components/edit-proveedor-dialog";
import { FacturasList } from "../components/facturas-list";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function ProveedorDetallePage() {
  const params = useParams();
  const proveedorId = Number(params?.id);

  const [proveedor, setProveedor] = React.useState<Proveedor | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!Number.isInteger(proveedorId)) return;
    setLoading(true);
    try {
      const res = await apiService.getProveedores();
      setProveedor((res ?? []).find((p) => p.id === proveedorId) ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [proveedorId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8 min-h-screen bg-transparent">
      {/* Volver */}
      <Link href="/proveedores">
        <Button
          variant="ghost"
          className="gap-2 rounded-xl text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Proveedores
        </Button>
      </Link>

      {/* Header proveedor */}
      {loading ? (
        <Skeleton className="h-32 w-full rounded-[2rem]" />
      ) : !proveedor ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
          <div className="bg-muted/50 p-6 rounded-full">
            <Truck className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">Proveedor no encontrado</h3>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-border/50 bg-card p-6 md:p-8 shadow-sm"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-2 border-background shadow-md">
                  <AvatarFallback
                    className={`font-black text-2xl ${proveedor.activo ? "bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)]" : "bg-[color:var(--status-warning)] text-[color:var(--status-warning)]"}`}
                  >
                    {getInitials(proveedor.nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tighter leading-none">
                    {proveedor.nombre}
                  </h1>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <Badge
                      variant="outline"
                      className={`h-6 px-2.5 rounded-md font-bold text-[10px] border-0 ${proveedor.activo ? "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]" : "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"}`}
                    >
                      {proveedor.activo ? "ACTIVO" : "INACTIVO"}
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 font-medium text-muted-foreground font-mono">
                      <Hash className="h-3.5 w-3.5" />{" "}
                      {proveedor.cuit || "Sin CUIT"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 font-medium text-muted-foreground">
                      <Coins className="h-3.5 w-3.5" />{" "}
                      {proveedor.monedaPreferida}
                    </span>
                  </div>
                </div>
              </div>

              <EditProveedorDialog
                proveedor={proveedor}
                onUpdated={load}
                trigger={
                  <Button className="rounded-xl h-11 gap-2 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                }
              />
            </div>
          </motion.div>

          {/* Facturas del proveedor */}
          <div className="space-y-4">
            <h2 className="text-xl font-black tracking-tight uppercase italic text-foreground/80">
              Facturas
            </h2>
            <FacturasList proveedorId={proveedor.id} />
          </div>
        </>
      )}
    </div>
  );
}
