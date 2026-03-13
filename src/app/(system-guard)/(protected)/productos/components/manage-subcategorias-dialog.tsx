/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Pencil, Trash2, Tag, ChevronLeft, BadgePercent } from "lucide-react";
import { DiscountTiersInline } from "./discount-tiers-inline";
import type { DescuentoNivel } from "@/lib/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
    categoriaId: number;
    categoriaNombre: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated?: () => void;
}

export function ManageSubcategoriasDialog({ categoriaId, categoriaNombre, open, onOpenChange, onUpdated }: Props) {
    const [loading, setLoading] = React.useState(false);
    const [subcategorias, setSubcategorias] = React.useState<any[]>([]);
    const [mode, setMode] = React.useState<"list" | "create" | "edit">("list");

    const [currentId, setCurrentId] = React.useState<number | null>(null);
    const [nombre, setNombre] = React.useState("");
    const [descuentos, setDescuentos] = React.useState<DescuentoNivel[]>([]);
    const [saving, setSaving] = React.useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
    const [subToDelete, setSubToDelete] = React.useState<number | null>(null);

    React.useEffect(() => {
        if (open && categoriaId) {
            loadSubcategorias();
            setMode("list");
        }
    }, [open, categoriaId]);

    async function loadSubcategorias() {
        setLoading(true);
        try {
            const data = await apiService.getSubcategorias(categoriaId);
            setSubcategorias(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Error al cargar subcategorías");
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setNombre("");
        setDescuentos([]);
        setCurrentId(null);
    }

    async function handleSave() {
        if (!nombre.trim()) return toast.error("El nombre es obligatorio");

        setSaving(true);
        try {
            if (mode === "edit" && currentId) {
                await apiService.updateSubcategoria(currentId, {
                    nombre: nombre.trim(),
                    descuentos: descuentos.length > 0 ? descuentos : null
                });
                toast.success("Subcategoría actualizada");
            } else {
                await apiService.createSubcategoria({
                    nombre: nombre.trim(),
                    categoriaId,
                    descuentos: descuentos.length > 0 ? descuentos : null
                });
                toast.success("Subcategoría creada");
            }
            await loadSubcategorias();
            setMode("list");
            onUpdated?.();
        } catch (error) {
            toast.error("Error al guardar subcategoría");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: number) {
        try {
            await apiService.deleteSubcategoria(id);
            toast.success("Subcategoría eliminada");
            await loadSubcategorias();
            onUpdated?.();
        } catch {
            toast.error("Error al eliminar subcategoría");
        } finally {
            setDeleteConfirmOpen(false);
            setSubToDelete(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] bg-background border-border p-0 max-w-[450px] overflow-hidden">
                <div className="p-6 pb-2 border-b border-[color:var(--ui-fx-white)]/5 bg-card/5">
                    <div className="flex items-center gap-3 mb-2">
                        {mode !== "list" && (
                            <Button variant="ghost" size="icon" onClick={() => setMode("list")} className="w-8 h-8 rounded-full text-muted-foreground/80">
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        )}
                        <DialogTitle className="text-lg font-bold italic tracking-tight flex items-center gap-2">
                            <Tag className="w-4 h-4 text-primary" />
                            {mode === "list" ? `Subcategorías: ${categoriaNombre}` : mode === "create" ? "Nueva Subcategoría" : "Editar Subcategoría"}
                        </DialogTitle>
                    </div>
                </div>

                <div className="p-6 max-h-[50vh] overflow-y-auto">
                    {mode === "list" && (
                        <div className="space-y-4">
                            <Button
                                onClick={() => { resetForm(); setMode("create"); }}
                                className="w-full h-11 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 flex gap-2 font-bold"
                            >
                                <Plus className="w-4 h-4" />
                                Nueva Subcategoría
                            </Button>

                            {loading ? (
                                <div className="flex items-center justify-center p-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : subcategorias.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground text-sm italic">
                                    No hay subcategorías para esta categoría.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {subcategorias.map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card/30 hover:bg-card transition-colors">
                                            <span className="font-medium text-sm text-foreground/90">{sub.nombre}</span>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 text-muted-foreground/80 hover:text-[color:var(--ui-fx-white)]"
                                                    onClick={() => {
                                                        setCurrentId(sub.id);
                                                        setNombre(sub.nombre);
                                                        setDescuentos(Array.isArray(sub.descuentos) ? sub.descuentos : []);
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
                                                        setSubToDelete(sub.id);
                                                        setDeleteConfirmOpen(true);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {mode !== "list" && (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">
                                    Nombre de Subcategoría
                                </Label>
                                <Input
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    placeholder="Ej: Gaseosas, Accesorios..."
                                    autoFocus
                                    className="h-11 bg-card/50 border-border rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">
                                    Descuentos por Marca (Opcional)
                                </Label>
                                <div className="p-4 rounded-xl border border-border bg-card/30">
                                    <DiscountTiersInline descuentos={descuentos} onChange={setDescuentos} />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-border">
                                <Button
                                    variant="ghost"
                                    onClick={() => setMode("list")}
                                    className="flex-1 rounded-xl h-11"
                                    disabled={saving}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || !nombre.trim()}
                                    className="flex-1 rounded-xl bg-primary text-primary-foreground font-bold h-11"
                                >
                                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    {mode === "create" ? "Crear" : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent className="bg-background border-border rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[color:var(--ui-fx-white)]">¿Eliminar subcategoría?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground/80">
                            Los productos asociados perderán esta etiqueta pero mantendrán su categoría principal.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent text-[color:var(--ui-fx-white)] border-border hover:bg-card rounded-xl">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] rounded-xl"
                            onClick={() => subToDelete && handleDelete(subToDelete)}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
