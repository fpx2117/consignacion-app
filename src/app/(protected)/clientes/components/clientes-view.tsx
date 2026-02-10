"use client";

import * as React from "react";
import Link from "next/link";
import type { Cliente } from "@/lib/types";
import { apiService } from "@/lib/apiService";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Plus, Pencil, MessageCircle, Eye, UserX, CheckCircle2, MapPin, Phone } from "lucide-react";
import { CreateClienteDialog } from "./create-cliente-dialog";
import { EditClienteDialog } from "./edit-cliente-dialog";
import { ClienteFilters } from "./filters-clientes";

const getInitials = (name: string) => name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();

export function ClientesView() {
  const [items, setItems] = React.useState<Cliente[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await apiService.getClientes();
      setItems(res.data ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  const toggleStatus = async (cliente: Cliente) => {
    try {
      await apiService.updateCliente(cliente.id, { ...cliente, activo: !cliente.activo });
      load();
    } catch (error) { console.error(error); }
  };

  React.useEffect(() => { void load(); }, []);

  const filteredItems = React.useMemo(() => {
    return items.filter((c) => {
      const matchesSearch = c.nombre.toLowerCase().includes(q.toLowerCase()) || (c.telefono ?? "").includes(q);
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? c.activo : !c.activo;
      return matchesSearch && matchesStatus;
    });
  }, [items, q, statusFilter]);

  // --- SUB-COMPONENTE PARA MÓVILES (Card) ---
  const MobileCard = ({ c }: { c: Cliente }) => (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{getInitials(c.nombre)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-base leading-none">{c.nombre}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {c.direccion || "Venta Mostrador"}
              </p>
            </div>
          </div>
          <Badge className={`rounded-full px-2 text-[9px] font-black tracking-tighter border-none ${c.activo ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"}`}>
            {c.activo ? "ACTIVO" : "INACTIVO"}
          </Badge>
        </div>

        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl">
          <div className="flex items-center gap-2 font-mono text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {c.telefono || "—"}
          </div>
          {c.telefono && (
            <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" className="text-emerald-500 p-2">
              <MessageCircle className="h-5 w-5" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" className="rounded-xl h-10" asChild><Link href={`/clientes/${c.id}`}><Eye className="h-4 w-4" /></Link></Button>
          <EditClienteDialog cliente={c} onUpdated={load} trigger={<Button variant="secondary" className="rounded-xl h-10"><Pencil className="h-4 w-4" /></Button>} />
          <Button 
            variant="secondary" 
            className={`rounded-xl h-10 ${c.activo ? "text-orange-500" : "text-emerald-500"}`}
            onClick={() => toggleStatus(c)}
          >
            {c.activo ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 md:space-y-10 p-4 md:p-10 min-h-screen bg-background text-foreground transition-colors duration-300">
      
      {/* Header: Columna en móvil, Fila en desktop */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">Clientes</h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">Gestión de base de datos.</p>
        </div>
        <CreateClienteDialog
          onCreated={load}
          trigger={
            <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground font-bold rounded-2xl h-14 px-8 shadow-lg shadow-primary/20 transition-transform active:scale-95">
              <Plus className="mr-2 h-5 w-5 stroke-[3]" /> Nuevo Registro
            </Button>
          }
        />
      </div>

      <ClienteFilters q={q} setQ={setQ} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-[2rem]" />)}
        </div>
      ) : (
        <>
          {/* VISTA MÓVIL Y TABLET (Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            {filteredItems.map((c) => <MobileCard key={c.id} c={c} />)}
          </div>

          {/* VISTA DESKTOP (Tabla) */}
          <Card className="hidden lg:block bg-card border-border rounded-[2.5rem] overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="py-6 pl-10 text-[11px] font-bold uppercase tracking-[0.2em]">Información Personal</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.2em]">Contacto Directo</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-[0.2em]">Estado</TableHead>
                  <TableHead className="text-right pr-10 text-[11px] font-bold uppercase tracking-[0.2em]">Gestión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((c) => (
                  <TableRow key={c.id} className="border-border group hover:bg-muted/40 transition-colors">
                    <TableCell className="pl-10 py-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border border-border">
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">{getInitials(c.nombre)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold text-base">{c.nombre}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {c.direccion || "Venta Mostrador"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.telefono ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-muted px-3 py-1.5 rounded-lg font-mono text-sm border border-border">{c.telefono}</span>
                          <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" className="text-emerald-500 hover:scale-110 transition-transform">
                            <MessageCircle className="h-5 w-5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 italic text-sm">Sin teléfono</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-bold text-[10px] border-none ${c.activo ? "text-emerald-500 bg-emerald-500/10" : "text-orange-500 bg-orange-500/10"}`}>
                        {c.activo ? "● ACTIVO" : "○ INACTIVO"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" asChild><Link href={`/clientes/${c.id}`}><Eye className="h-4 w-4" /></Link></Button>
                        <EditClienteDialog cliente={c} onUpdated={load} trigger={<Button size="icon" variant="ghost" className="h-9 w-9 rounded-full"><Pencil className="h-4 w-4" /></Button>} />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className={`h-9 w-9 rounded-full ${c.activo ? "text-orange-500 hover:bg-orange-500/10" : "text-emerald-500 hover:bg-emerald-500/10"}`}
                          onClick={() => toggleStatus(c)}
                        >
                          {c.activo ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Footer adaptable */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4 pb-10">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center sm:text-left">
          {filteredItems.length} Clientes encontrados
        </span>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none rounded-xl h-10 px-6 font-bold text-xs">Anterior</Button>
          <Button variant="outline" className="flex-1 sm:flex-none rounded-xl h-10 px-6 font-bold text-xs">Siguiente</Button>
        </div>
      </div>
    </div>
  );
}