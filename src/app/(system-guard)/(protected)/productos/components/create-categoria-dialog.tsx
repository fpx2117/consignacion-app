"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { CATEGORY_PALETTE, type CategoryColorKey } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import { Loader2, Check, Plus, Pencil, Trash2, Tag, ChevronDown, ChevronRight, AlertTriangle, Layers } from "lucide-react";
import type { DescuentoNivel } from "@/lib/types";
import { DiscountTiersInline } from "./discount-tiers-inline";
import { ManageSubcategoriasDialog } from "./manage-subcategorias-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

export function CreateCategoriaDialog({ onCreated, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [categorias, setCategorias] = React.useState<any[]>([]);

  // Modos: 'list' | 'create' | 'edit'
  const [mode, setMode] = React.useState<"list" | "create" | "edit">("list");

  // States para Create/Edit
  const [currentId, setCurrentId] = React.useState<number | null>(null);
  const [nombre, setNombre] = React.useState("");
  const [color, setColor] = React.useState("sky");
  const [saving, setSaving] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [categoryToDelete, setCategoryToDelete] = React.useState<number | null>(null);

  // Subcategorías management
  const [subOpen, setSubOpen] = React.useState(false);
  const [selectedCatForSub, setSelectedCatForSub] = React.useState<{ id: number, nombre: string } | null>(null);

  React.useEffect(() => {
    if (open) {
      loadCategorias();
      setMode("list");
      resetForm();
    }
  }, [open]);

  async function loadCategorias() {
    setLoading(true);
    try {
      const data = await apiService.getCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setNombre("");
    setColor("sky");
    setCurrentId(null);
  }

  async function handleSave() {
    if (!nombre.trim()) return toast.error("El nombre es obligatorio");

    setSaving(true);
    try {
      if (mode === "edit" && currentId) {
        await apiService.updateCategoria(currentId, {
          nombre: nombre.trim(),
          color: color,
        });
        toast.success("Categoría actualizada");
      } else {
        await apiService.createCategoria({
          nombre: nombre.trim(),
          color: color,
        });
        toast.success("Categoría creada con éxito");
      }
      await loadCategorias();
      setMode("list");
      onCreated?.();
    } catch (error: any) {
      toast.error("Error al guardar la categoría");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiService.deleteCategoria(id);
      toast.success("Categoría eliminada");
      await loadCategorias();
      onCreated?.();
    } catch (error) {
      toast.error("Error al eliminar categoría");
    } finally {
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  }

  const activeColor = CATEGORY_PALETTE.find((c) => c.key === color) || CATEGORY_PALETTE[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="rounded-2xl border-border font-black uppercase text-[10px] tracking-widest h-12 px-6">
            Administrar Categorías
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="rounded-[2.5rem] bg-background border-border p-0 max-w-[500px] overflow-hidden">
        <div className="p-6 pb-2 border-b border-[color:var(--ui-fx-white)]/5 bg-card/5">
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-xl font-bold italic tracking-tight flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              {mode === "list" ? "Administrar Categorías" : mode === "create" ? "Nueva Categoría" : "Editar Categoría"}
            </DialogTitle>
            {mode !== "list" && (
              <Button variant="ghost" size="sm" onClick={() => setMode("list")} className="text-xs text-muted-foreground/80 hover:text-[color:var(--ui-fx-white)]">
                Volver
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium mb-4">
            {mode === "list"
              ? "Gestiona las categorías de esta sucursal."
              : "Asigna un nombre y color por defecto."}
          </p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {mode === "list" && (
            <div className="space-y-4">
              <Button
                onClick={() => { resetForm(); setMode("create"); }}
                className="w-full h-12 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 flex gap-2"
              >
                <Plus className="w-4 h-4" />
                Nueva Categoría
              </Button>

              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : categorias.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-sm">
                  No hay categorías en esta sucursal.
                </div>
              ) : (
                <div className="space-y-2">
                  {categorias.map(cat => {
                    const colorData = CATEGORY_PALETTE.find((c) => c.key === (cat.color || "sky")) || CATEGORY_PALETTE[0];
                    return (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/30 hover:bg-card transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full shadow-sm", colorData.dot)} />
                          <span className="font-semibold text-sm">{cat.nombre}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gestionar Subcategorías"
                            className="w-8 h-8 text-muted-foreground/80 hover:text-primary hover:bg-primary/10"
                            onClick={() => {
                              setSelectedCatForSub({ id: cat.id, nombre: cat.nombre });
                              setSubOpen(true);
                            }}
                          >
                            <Layers className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground/80 hover:text-[color:var(--ui-fx-white)]"
                            onClick={() => {
                              setCurrentId(cat.id);
                              setNombre(cat.nombre);
                              setColor(cat.color || "sky");
                              setMode("edit");
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10"
                            onClick={() => {
                              setCategoryToDelete(cat.id);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mode !== "list" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">
                  Nombre
                </Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Accesorios..."
                    autoFocus
                    className="pl-9 h-12 bg-card/50 border-border rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">
                  Color Identificador
                </Label>
                <div className="grid grid-cols-6 gap-2 p-3 rounded-xl bg-card/50 border border-border">
                  {CATEGORY_PALETTE.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setColor(c.key)}
                      className={cn(
                        "relative h-9 w-full rounded-lg transition-all duration-200 flex items-center justify-center",
                        "hover:scale-110 hover:shadow-lg active:scale-95",
                        color === c.key
                          ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110"
                          : "opacity-70 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {color === c.key && (
                        <Check className="h-4 w-4 text-[color:var(--ui-fx-white)] drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={() => setMode("list")}
                  className="flex-1 rounded-xl h-12"
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !nombre}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground font-bold h-12"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {mode === "create" ? "Crear Categoría" : "Guardar Cambios"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => {
        setDeleteConfirmOpen(open);
        if (!open) setCategoryToDelete(null);
      }}>
        <AlertDialogContent className="bg-background border-border rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[color:var(--ui-fx-white)]">¿Seguro que deseas eliminar esta categoría?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80">
              Los productos asociados quedarán "Sin Categoría". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-[color:var(--ui-fx-white)] border-border hover:bg-card hover:text-[color:var(--ui-fx-white)] rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] rounded-xl"
              onClick={() => {
                if (categoryToDelete !== null) {
                  handleDelete(categoryToDelete);
                }
              }}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {
        selectedCatForSub && (
          <ManageSubcategoriasDialog
            categoriaId={selectedCatForSub.id}
            categoriaNombre={selectedCatForSub.nombre}
            open={subOpen}
            onOpenChange={setSubOpen}
          />
        )
      }
    </Dialog >
  );
}