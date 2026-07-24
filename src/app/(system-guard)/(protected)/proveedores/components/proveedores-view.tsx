"use client";

import * as React from "react";
import Link from "next/link";
import type { Proveedor } from "@/lib/apiService";
import { apiService } from "@/lib/apiService";
import { motion, AnimatePresence } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Plus,
  Pencil,
  Eye,
  Truck,
  CheckCircle2,
  Hash,
  Coins,
  MoreHorizontal,
  UserX,
  FileText,
} from "lucide-react";
import { CreateProveedorDialog } from "./create-proveedor-dialog";
import { EditProveedorDialog } from "./edit-proveedor-dialog";
import { ProveedorFilters } from "./filters-proveedores";
import { FacturasList } from "./facturas-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function ProveedoresView() {
  const [items, setItems] = React.useState<Proveedor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");

  async function load() {
    setLoading(true);
    try {
      const res = await apiService.getProveedores();
      setItems(res ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  const toggleStatus = async (proveedor: Proveedor) => {
    try {
      await apiService.updateProveedor(proveedor.id, {
        activo: !proveedor.activo,
      });
      load();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredItems = React.useMemo(() => {
    return items.filter((p) => {
      const matchesSearch =
        p.nombre.toLowerCase().includes(q.toLowerCase()) ||
        (p.cuit ?? "").includes(q);
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? p.activo
            : !p.activo;
      return matchesSearch && matchesStatus;
    });
  }, [items, q, statusFilter]);

  // --- GRID CARD COMPONENT ---
  const GridCard = ({ p }: { p: Proveedor }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group h-full rounded-[2rem] border-border/50 bg-card hover:bg-muted/30 hover:shadow-xl transition-all duration-300 overflow-hidden relative">
        <div
          className={`absolute top-0 left-0 w-full h-1 ${p.activo ? "bg-[color:var(--status-success-strong)]" : "bg-[color:var(--status-warning)]"} opacity-50`}
        />

        <CardContent className="p-6 flex flex-col h-full gap-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border-2 border-background shadow-md">
                <AvatarFallback
                  className={`font-black text-lg ${p.activo ? "bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)]" : "bg-[color:var(--status-warning)] text-[color:var(--status-warning)]"}`}
                >
                  {getInitials(p.nombre)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-lg leading-tight line-clamp-1">
                  {p.nombre}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className={`h-5 border-0 px-1.5 ${p.activo ? "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]" : "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"}`}
                  >
                    {p.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mr-2 rounded-full"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href={`/proveedores/${p.id}`} className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <Eye className="mr-2 h-4 w-4" /> Ver Facturas
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={() => toggleStatus(p)}
                  className="cursor-pointer"
                >
                  {p.activo ? (
                    <UserX className="mr-2 h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {p.activo ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-muted-foreground">
                <Hash className="h-4 w-4 shrink-0" />
                <span className="truncate font-mono">
                  {p.cuit || "Sin CUIT"}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-muted-foreground">
                <Coins className="h-4 w-4 shrink-0" />
                <span className="truncate">Moneda: {p.monedaPreferida}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-2 pt-2 mt-auto border-t border-border/40">
            <Link href={`/proveedores/${p.id}`} className="flex-1">
              <Button
                variant="default"
                className="w-full rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold shadow-none"
              >
                Ver Facturas
              </Button>
            </Link>

            <EditProveedorDialog
              proveedor={p}
              onUpdated={load}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-muted-foreground bg-muted hover:bg-foreground hover:text-background"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8 min-h-screen bg-transparent transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-2 border-b border-border/40">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-foreground/90">
            Proveedores
          </h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base max-w-md">
            Administra tus proveedores y las facturas cargadas.
          </p>
        </div>
        <CreateProveedorDialog
          onCreated={load}
          trigger={
            <Button
              size="lg"
              className="w-full md:w-auto bg-primary text-primary-foreground font-bold rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
            >
              <Plus className="mr-2 h-5 w-5 stroke-[3]" /> Nuevo Proveedor
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="proveedores" className="w-full">
        <TabsList className="h-11 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger
            value="proveedores"
            className="rounded-xl px-5 gap-2 data-[state=active]:shadow-sm"
          >
            <Truck className="h-4 w-4" /> Proveedores
          </TabsTrigger>
          <TabsTrigger
            value="facturas"
            className="rounded-xl px-5 gap-2 data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" /> Facturas
          </TabsTrigger>
        </TabsList>

        {/* TAB PROVEEDORES */}
        <TabsContent value="proveedores" className="mt-6 space-y-6">
          <ProveedorFilters
            q={q}
            setQ={setQ}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-[2rem]" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {filteredItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50"
                >
                  <div className="bg-muted/50 p-6 rounded-full">
                    <Truck className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">
                    No se encontraron proveedores
                  </h3>
                  <p className="text-sm">
                    Crea tu primer proveedor o ajusta los filtros.
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* GRID VIEW */}
                  {viewMode === "grid" && (
                    <motion.div
                      key="grid"
                      layout
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6"
                    >
                      <AnimatePresence>
                        {filteredItems.map((p) => (
                          <GridCard key={p.id} p={p} />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* LIST VIEW (TABLE) */}
                  {viewMode === "list" && (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-sm"
                    >
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="py-5 pl-8 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                              Proveedor
                            </TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                              CUIT
                            </TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                              Moneda
                            </TableHead>
                            <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                              Estado
                            </TableHead>
                            <TableHead className="text-right pr-8 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                              Acciones
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((p) => (
                            <TableRow
                              key={p.id}
                              className="border-border hover:bg-muted/30 transition-all cursor-pointer group"
                            >
                              <TableCell className="pl-8 py-4">
                                <div className="flex items-center gap-4">
                                  <Avatar className="h-10 w-10 border border-border/50 group-hover:border-primary/30 transition-colors">
                                    <AvatarFallback className="bg-background font-bold text-xs text-muted-foreground group-hover:text-primary transition-colors">
                                      {getInitials(p.nombre)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-bold text-sm text-foreground/90 group-hover:text-primary transition-colors">
                                      {p.nombre}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {p.cuit || "—"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {p.monedaPreferida}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`h-6 px-2.5 rounded-md font-bold text-[10px] border-0 transition-all ${
                                    p.activo
                                      ? "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] group-hover:bg-[color:var(--status-success-strong)]/20"
                                      : "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] group-hover:bg-[color:var(--status-warning)]/20"
                                  }`}
                                >
                                  {p.activo ? "ACTIVO" : "INACTIVO"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-8">
                                <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm"
                                    asChild
                                  >
                                    <Link href={`/proveedores/${p.id}`}>
                                      <Eye className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                  <EditProveedorDialog
                                    proveedor={p}
                                    onUpdated={load}
                                    trigger={
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    }
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={`h-8 w-8 rounded-lg hover:shadow-sm hover:bg-background ${p.activo ? "hover:text-[color:var(--status-warning)]" : "hover:text-[color:var(--status-success-strong)]"}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStatus(p);
                                    }}
                                  >
                                    {p.activo ? (
                                      <UserX className="h-4 w-4" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          )}

          <div className="flex justify-between items-center text-xs text-muted-foreground px-4">
            <span>Mostrando {filteredItems.length} proveedores</span>
          </div>
        </TabsContent>

        {/* TAB FACTURAS */}
        <TabsContent value="facturas" className="mt-6">
          <FacturasList proveedores={items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
