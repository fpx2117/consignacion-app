/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Pencil, Trash2, Tag, ChevronLeft } from "lucide-react";
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
        setCurrentId(null);
    }

    async function handleSave() {
        if (!nombre.trim()) return toast.error("El nombre es obligatorio");

        setSaving(true);
        try {
            if (mode === "edit" && currentId) {
                await apiService.updateSubcategoria(currentId, { nombre: nombre.trim() });
                toast.success("Subcategoría actualizada");
            } else {
                await apiService.createSubcategoria({
                    nombre: nombre.trim(),
                    categoriaId
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
            <DialogContent className="rounded-[2.5rem] bg-zinc-950 border-zinc-800 p-0 max-w-[450px] overflow-hidden">
                <div className="p-6 pb-2 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3 mb-2">
                        {mode !== "list" && (
                            <Button variant="ghost" size="icon" onClick={() => setMode("list")} className="w-8 h-8 rounded-full text-zinc-400">
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
                                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                                </div>
                            ) : subcategorias.length === 0 ? (
                                <div className="text-center p-8 text-zinc-500 text-sm italic">
                                    No hay subcategorías para esta categoría.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {subcategorias.map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-900 transition-colors">
                                            <span className="font-medium text-sm text-zinc-200">{sub.nombre}</span>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 text-zinc-400 hover:text-white"
                                                    onClick={() => {
                                                        setCurrentId(sub.id);
                                                        setNombre(sub.nombre);
                                                        setMode("edit");
                                                    }}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
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
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">
                                    Nombre de Subcategoría
                                </Label>
                                <Input
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    placeholder="Ej: Gaseosas, Accesorios..."
                                    autoFocus
                                    className="h-11 bg-zinc-900/50 border-zinc-800 rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base"
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-zinc-800">
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
                <AlertDialogContent className="bg-zinc-950 border-zinc-800 rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">¿Eliminar subcategoría?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Los productos asociados perderán esta etiqueta pero mantendrán su categoría principal.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent text-white border-zinc-800 hover:bg-zinc-900 rounded-xl">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
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
