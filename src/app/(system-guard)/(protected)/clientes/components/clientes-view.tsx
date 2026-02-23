"use client";

import * as React from "react";
import Link from "next/link";
import type { Cliente } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { motion, AnimatePresence } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
  MessageCircle,
  Eye,
  UserX,
  CheckCircle2,
  MapPin,
  Phone,
  MoreHorizontal,
} from "lucide-react";
import { CreateClienteDialog } from "./create-cliente-dialog";
import { EditClienteDialog } from "./edit-cliente-dialog";
import { ClienteFilters } from "./filters-clientes";
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

export function ClientesView() {
  const [items, setItems] = React.useState<Cliente[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list"); // Default to list for desktop

  async function load() {
    setLoading(true);
    try {
      const res = await apiService.getClientes();
      setItems(res ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const toggleStatus = async (cliente: Cliente) => {
    try {
      await apiService.updateCliente(cliente.id, {
        ...cliente,
        activo: !cliente.activo,
      });
      load();
    } catch (error) {
      console.error(error);
    }
  };

  React.useEffect(() => {
    void load();
  }, []);

  const filteredItems = React.useMemo(() => {
    return items.filter((c) => {
      const matchesSearch =
        c.nombre.toLowerCase().includes(q.toLowerCase()) ||
        (c.telefono ?? "").includes(q);
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? c.activo
            : !c.activo;
      return matchesSearch && matchesStatus;
    });
  }, [items, q, statusFilter]);

  // --- GRID CARD COMPONENT ---
  const GridCard = ({ c }: { c: Cliente }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group h-full rounded-[2rem] border-border/50 bg-card hover:bg-muted/30 hover:shadow-xl transition-all duration-300 overflow-hidden relative">
        <div className={`absolute top-0 left-0 w-full h-1 ${c.activo ? "bg-emerald-500" : "bg-orange-500"} opacity-50`} />

        <CardContent className="p-6 flex flex-col h-full gap-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border-2 border-background shadow-md">
                <AvatarFallback className={`font-black text-lg ${c.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                  {getInitials(c.nombre)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-lg leading-tight line-clamp-1">{c.nombre}</h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Badge variant="outline" className={`h-5 border-0 px-1.5 ${c.activo ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"}`}>
                    {c.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href={`/clientes/${c.id}`} className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={() => toggleStatus(c)} className="cursor-pointer">
                  {c.activo ? <UserX className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {c.activo ? "Desactivar" : "Activar"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{c.direccion || "Sin dirección registrada"}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="truncate font-mono">{c.telefono || "Sin teléfono"}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-2 pt-2 mt-auto border-t border-border/40">
            <Link href={`/clientes/${c.id}`} className="flex-1">
              <Button variant="default" className="w-full rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-bold shadow-none">
                Ver Perfil
              </Button>
            </Link>

            <div className="flex gap-1">
              {c.telefono && (
                <Button variant="ghost" size="icon" asChild className="rounded-xl text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white">
                  <a href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`} target="_blank">
                    <MessageCircle className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <EditClienteDialog cliente={c} onUpdated={load} trigger={
                <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground bg-muted hover:bg-foreground hover:text-background">
                  <Pencil className="h-4 w-4" />
                </Button>
              } />
            </div>
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
            Base de Clientes
          </h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base max-w-md">
            Administra contactos, estados y operaciones de tus clientes.
          </p>
        </div>
        <CreateClienteDialog
          onCreated={load}
          trigger={
            <Button
              size="lg"
              className="w-full md:w-auto bg-primary text-primary-foreground font-bold rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
            >
              <Plus className="mr-2 h-5 w-5 stroke-[3]" /> Nuevo Cliente
            </Button>
          }
        />
      </div>

      <ClienteFilters
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
              <div className="bg-muted/50 p-6 rounded-full"><UserX className="h-12 w-12 text-muted-foreground" /></div>
              <h3 className="text-xl font-bold">No se encontraron clientes</h3>
              <p className="text-sm">Prueba ajustando los filtros de búsqueda.</p>
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
                    {filteredItems.map((c) => (
                      <GridCard key={c.id} c={c} />
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
                          Cliente
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                          Contacto
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
                      {filteredItems.map((c) => (
                        <TableRow
                          key={c.id}
                          className="border-border hover:bg-muted/30 transition-all cursor-pointer group"
                        >
                          <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-10 w-10 border border-border/50 group-hover:border-primary/30 transition-colors">
                                <AvatarFallback className="bg-background font-bold text-xs text-muted-foreground group-hover:text-primary transition-colors">
                                  {getInitials(c.nombre)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-bold text-sm text-foreground/90 group-hover:text-primary transition-colors">
                                  {c.nombre}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3" />{" "}
                                  {c.direccion || "—"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.telefono ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {c.telefono}
                                </span>
                                <a
                                  href={`https://wa.me/${c.telefono.replace(
                                    /\D/g,
                                    ""
                                  )}`}
                                  target="_blank"
                                  className="text-emerald-500 hover:scale-110 transition-transform opacity-0 group-hover:opacity-100"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs italic">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`h-6 px-2.5 rounded-md font-bold text-[10px] border-0 transition-all ${c.activo
                                ? "bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20"
                                : "bg-orange-500/10 text-orange-600 group-hover:bg-orange-500/20"
                                }`}
                            >
                              {c.activo ? "ACTIVO" : "INACTIVO"}
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
                                <Link href={`/clientes/${c.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <EditClienteDialog
                                cliente={c}
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
                                size="icon" // Adding toggle directly here for quick access
                                variant="ghost"
                                className={`h-8 w-8 rounded-lg hover:shadow-sm hover:bg-background ${c.activo ? "hover:text-amber-500" : "hover:text-emerald-500"}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStatus(c);
                                }}
                              >
                                {c.activo ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
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

      {/* Footer Info */}
      <div className="flex justify-between items-center text-xs text-muted-foreground px-4">
        <span>Mostrando {filteredItems.length} registros</span>
        <div className="flex gap-4">
          {/* Pagination placeholders if needed later */}
        </div>
      </div>
    </div>
  );
}