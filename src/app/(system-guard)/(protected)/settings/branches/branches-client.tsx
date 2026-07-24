"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Store,
  Navigation,
  BriefcaseBusiness,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";

import { apiService } from "@/lib/apiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Sucursal } from "@/store/useSucursalStore";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function BranchesClient() {
  const [branches, setBranches] = useState<Sucursal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Sucursal | null>(null);

  // Form State
  const [nombre, setNombre] = useState("");
  const [activa, setActiva] = useState(true);
  const [incluidaEnDashboardGlobal, setIncluidaEnDashboardGlobal] =
    useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Sucursal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const data = await apiService.getSucursales();
      setBranches(data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar sucursales"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBranches();
  }, []);

  const openNewModal = () => {
    setEditingBranch(null);
    setNombre("");
    setActiva(true);
    setIncluidaEnDashboardGlobal(true);
    setIsModalOpen(true);
  };

  const openEditModal = (branch: Sucursal) => {
    setEditingBranch(branch);
    setNombre(branch.nombre);
    setActiva(branch.activa);
    setIncluidaEnDashboardGlobal(branch.incluidaEnDashboardGlobal ?? true);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!nombre.trim()) return;
    try {
      setSubmitting(true);
      if (editingBranch) {
        await apiService.updateSucursal(editingBranch.id, {
          nombre,
          activa,
          incluidaEnDashboardGlobal,
        });
        toast.success("Sucursal actualizada correctamente.");
      } else {
        await apiService.createSucursal({ nombre, activa });
        toast.success("Nueva sucursal creada con éxito.");
      }
      setIsModalOpen(false);
      fetchBranches();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al guardar"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (branch: Sucursal) => {
    setBranchToDelete(branch);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;
    try {
      setDeleting(true);
      await apiService.deleteSucursal(branchToDelete.id);
      toast.success("Sucursal eliminada correctamente.");
      setIsDeleteModalOpen(false);
      void fetchBranches();
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al eliminar"));
    } finally {
      setDeleting(false);
      setBranchToDelete(null);
    }
  };

  const activeCount = branches.filter((b) => b.activa).length;

  if (loading) {
    return <Skeleton className="h-[400px] w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-6">
      {/* HEADER ACTIONS */}
      <div className="flex items-center justify-between bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Badge
              variant="outline"
              className="gap-1 bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20"
            >
              <Store className="h-3 w-3" />
              {branches.length} Total
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 bg-primary/10 text-primary border-primary/20"
            >
              <Check className="h-3 w-3" />
              {activeCount} Activas
            </Badge>
          </div>
        </div>
        <Button
          onClick={openNewModal}
          className="rounded-full shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Sucursal
        </Button>
      </div>

      {/* BRANCHES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {branches.map((branch) => (
          <Card
            key={branch.id}
            className="group relative overflow-hidden border border-border/50 bg-card/60 hover:bg-card hover:shadow-xl hover:border-border transition-all duration-300 rounded-[2rem] p-6 flex flex-col gap-4"
          >
            {/* Background Accent */}
            <div
              className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${branch.esPrincipal ? "bg-primary" : "bg-[color:var(--status-success-strong)]"}`}
            />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl border ${branch.esPrincipal ? "bg-primary/10 border-primary/20 text-primary" : "bg-[color:var(--status-success-strong)]/10 border-[color:var(--status-success-strong)]/20 text-[color:var(--status-success-strong)]"}`}
                >
                  {branch.esPrincipal ? (
                    <BriefcaseBusiness className="h-6 w-6" />
                  ) : (
                    <Navigation className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {branch.nombre}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    {branch.esPrincipal && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase font-bold tracking-wider"
                      >
                        Sede Principal
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-bold tracking-wider ${branch.activa ? "text-[color:var(--status-success)] border-[color:var(--status-success)]/30" : "text-muted-foreground"}`}
                    >
                      {branch.activa ? "Activa" : "Inactiva"}
                    </Badge>
                    {!branch.incluidaEnDashboardGlobal && (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-border/50"
                      >
                        Fuera del Dashboard Global
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-auto pt-4 flex gap-2">
              <button
                onClick={() => openEditModal(branch)}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-border/50 bg-background/50 hover:bg-muted text-sm font-medium transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              {!branch.esPrincipal && (
                <button
                  onClick={() => confirmDelete(branch)}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-destructive/20 bg-background/50 hover:bg-destructive/10 text-destructive text-sm font-medium transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* MODAL (ALTA/EDICIÓN) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] p-6 border border-border/50 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {editingBranch ? "Editar Sucursal" : "Nueva Sucursal"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80">
              {editingBranch
                ? "Modifica los datos de la sucursal seleccionada."
                : "Registra un nuevo punto de venta para tu negocio."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold tracking-wide text-foreground/80">
                Nombre de la Sucursal
              </label>
              <Input
                placeholder="Ej. Sede Centro, Depósito Norte..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoFocus
                className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-xl"
              />
            </div>

            {!editingBranch?.esPrincipal && (
              <div className="flex flex-col gap-3 p-4 bg-muted/30 border border-border/50 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-semibold text-foreground/80">
                      Estado Operativo
                    </label>
                    <p className="text-[12px] text-muted-foreground">
                      Activa o inactiva esta sucursal en el sistema.
                    </p>
                  </div>
                  <Switch
                    checked={activa}
                    onCheckedChange={setActiva}
                    className="data-[state=checked]:bg-[color:var(--status-success-strong)]"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 p-4 bg-muted/30 border border-border/50 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-semibold text-foreground/80">
                    Incluir en Dashboard Global
                  </label>
                  <p className="text-[12px] text-muted-foreground">
                    Si está apagado, esta sucursal no suma en la vista
                    &quot;Todas las Sucursales&quot; del dashboard (KPIs,
                    tendencia, top productos, gastos). Su vista individual no
                    cambia.
                  </p>
                </div>
                <Switch
                  checked={incluidaEnDashboardGlobal}
                  onCheckedChange={setIncluidaEnDashboardGlobal}
                />
              </div>
            </div>

            {editingBranch?.esPrincipal && (
              <p className="text-xs text-muted-foreground italic bg-muted/50 p-3 rounded-lg border border-border/30">
                La Sede Principal no puede ser desactivada del sistema.
              </p>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              disabled={!nombre.trim() || submitting}
              onClick={handleSave}
              className="rounded-xl shadow-md"
            >
              {submitting ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL (ELIMINAR) */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] p-6 border border-border/50 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold tracking-tight text-destructive">
              ¿Eliminar Sucursal?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80">
              Esta acción intentará eliminar la sucursal{" "}
              <strong>{branchToDelete?.nombre}</strong> del sistema. Solo podrá
              completarse si no hay registros vinculados (ventas, stock, etc).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded-xl shadow-md"
            >
              {deleting ? "Eliminando..." : "Confirmar Eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
