"use client";

import * as React from "react";
import Link from "next/link";
import type { Cliente } from "@/lib/types";
import { apiService } from "@/lib/apiService";

import { Card } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { 
  Plus, Pencil, Phone, MapPin, 
  MessageCircle, Eye, UserX, CheckCircle2, UserCircle 
} from "lucide-react";

import { CreateClienteDialog } from "./create-cliente-dialog";
import { EditClienteDialog } from "./edit-cliente-dialog";
import { ClienteFilters } from "./filters-clientes";

const getInitials = (name: string) => {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
};

export function ClientesView() {
  const [items, setItems] = React.useState<Cliente[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 6;

  async function load() {
    setLoading(true);
    try {
      const res = await apiService.getClientes();
      setItems(res.data ?? []);
    } catch (e: any) {
      console.error("Error cargando clientes:", e);
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
      console.error("Error al cambiar estado:", error);
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
        statusFilter === "all" ? true :
        statusFilter === "active" ? c.activo : !c.activo;

      return matchesSearch && matchesStatus;
    });
  }, [items, q, statusFilter]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  // --- COMPONENTE MOBILE CARD (Adaptado) ---
  const ClienteMobileCard = ({ c }: { c: Cliente }) => (
    <Card className="p-5 border-border bg-card text-card-foreground rounded-3xl shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="flex gap-4">
          <Avatar className="h-12 w-12 border border-border shadow-inner bg-muted">
            <AvatarFallback className="text-primary font-bold">{getInitials(c.nombre)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-bold text-lg leading-tight">{c.nombre}</h3>
            <Badge className={`mt-1 text-[10px] font-black uppercase border-none ${
              c.activo 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "bg-muted text-muted-foreground"
            }`} variant="outline">
              {c.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" asChild>
            <Link href={`/clientes/${c.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
          <EditClienteDialog cliente={c} onUpdated={load} trigger={
            <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full">
              <Pencil className="h-4 w-4" />
            </Button>
          }/>
        </div>
      </div>

      <div className="space-y-3">
        {c.telefono && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 opacity-70" />
              <span className="text-sm font-mono">{c.telefono}</span>
            </div>
            <Button size="sm" variant="ghost" className="text-emerald-600 dark:text-emerald-400 font-bold gap-2 hover:bg-emerald-500/10 h-8" asChild>
              <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground/70 text-xs pl-1">
          <MapPin className="h-3.5 w-3.5" />
          <span>{c.direccion || "Sin dirección"}</span>
        </div>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button 
            variant="secondary"
            className={`w-full h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all ${
              c.activo 
              ? "text-orange-600 dark:text-orange-500 hover:bg-orange-500/10" 
              : "text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/10"
            }`}
          >
            {c.activo ? <><UserX className="mr-2 h-4 w-4" /> Desactivar</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Reactivar</>}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar estado del cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción afectará la disponibilidad de <strong>{c.nombre}</strong> en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Volver</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => toggleStatus(c)}
              className={`rounded-xl ${c.activo ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8 pb-24 min-h-screen bg-background text-foreground"> 
      
      {/* Header */}
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-black tracking-tighter italic uppercase">Directorio</h1>
        <p className="text-muted-foreground text-sm font-medium -mt-3">Gestioná tus contactos de forma eficiente.</p>
        <CreateClienteDialog
          onCreated={load}
          trigger={
            <Button size="lg" className="w-full sm:w-auto h-12 rounded-2xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-5 w-5 stroke-[3]" /> Nuevo Cliente
            </Button>
          }
        />
      </div>

      {/* Filtros */}
      <ClienteFilters 
        q={q} 
        setQ={setQ} 
        statusFilter={statusFilter} 
        setStatusFilter={setStatusFilter}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48 w-full rounded-3xl" />)}
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-[2.5rem] bg-muted/20 text-center">
          <UserCircle className="h-16 w-16 text-muted mb-4" />
          <h3 className="text-lg font-bold text-muted-foreground">Sin coincidencias</h3>
          <Button variant="link" onClick={() => {setQ(""); setStatusFilter("all"); setCurrentPage(1);}}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <>
          {/* Vista Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
            {paginatedItems.map((c) => <ClienteMobileCard key={c.id} c={c} />)}
          </div>

          {/* Vista Desktop */}
          <Card className="hidden lg:block overflow-hidden border-border bg-card shadow-xl rounded-[2rem]">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="py-6 pl-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Cliente</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Contacto</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Ubicación</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-muted-foreground">Estado</TableHead>
                  <TableHead className="text-right pr-8 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((c) => (
                  <TableRow key={c.id} className="group border-border hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarFallback className="bg-muted text-primary font-bold">{getInitials(c.nombre)}</AvatarFallback>
                        </Avatar>
                        <span className="font-bold">{c.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">{c.telefono || "—"}</span>
                        {c.telefono && (
                          <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" className="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm italic">{c.direccion || "No registrada"}</TableCell>
                    <TableCell>
                      <Badge className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase border-none ${c.activo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`} variant="outline">
                        {c.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary" className="h-8 w-8 rounded-lg" asChild>
                          <Link href={`/clientes/${c.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <EditClienteDialog cliente={c} onUpdated={load} trigger={
                          <Button size="icon" variant="secondary" className="h-8 w-8 rounded-lg"><Pencil className="h-4 w-4" /></Button>
                        }/>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="secondary" className={`h-8 w-8 rounded-lg ${c.activo ? "text-orange-500" : "text-emerald-500"}`}>
                              {c.activo ? <UserX className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2rem]">
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Volver</AlertDialogCancel>
                              <AlertDialogAction onClick={() => toggleStatus(c)} className={c.activo ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"}>Confirmar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Footer Info */}
          <div className="flex flex-col items-center gap-2 pt-4">
             <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
               Página {currentPage} de {totalPages} • {filteredItems.length} Clientes totales
             </p>
          </div>
        </>
      )}
    </div>
  );
}