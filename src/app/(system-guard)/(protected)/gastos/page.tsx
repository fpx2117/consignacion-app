/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import {
    Plus, Wallet, Calendar, AlertTriangle,
    Trash2, Edit2, Filter, ChevronRight,
    MoreVertical, Receipt, Repeat, Share2,
    ExternalLink, MessageSquare, Copy, Search, User
} from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { useSucursalStore } from "@/store/useSucursalStore";
import type { Gasto, CategoriaGasto } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function GastosPage() {
    const [gastos, setGastos] = React.useState<Gasto[]>([]);
    const [categorias, setCategorias] = React.useState<CategoriaGasto[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filterEstado, setFilterEstado] = React.useState<string>("all");
    const [filterCategoria, setFilterCategoria] = React.useState<string>("all");
    const [modalOpen, setModalOpen] = React.useState(false);
    const [catModalOpen, setCatModalOpen] = React.useState(false);
    const [editingGasto, setEditingGasto] = React.useState<Gasto | null>(null);
    const [sharingGasto, setSharingGasto] = React.useState<Gasto | null>(null);
    const [shareModalOpen, setShareModalOpen] = React.useState(false);

    const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);

    const handleShareClick = (gasto: Gasto) => {
        setSharingGasto(gasto);
        setShareModalOpen(true);
    };

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [gRes, cRes] = await Promise.all([
                apiService.getGastos({
                    estado: filterEstado === "all" ? undefined : filterEstado,
                    categoriaId: filterCategoria === "all" ? undefined : Number(filterCategoria),
                }),
                apiService.getGastosCategorias(),
            ]);
            setGastos(gRes || []);
            setCategorias(cRes || []);
        } catch (error) {
            toast.error("Error al cargar datos de gastos");
        } finally {
            setLoading(false);
        }
    }, [filterEstado, filterCategoria, activeSucursalId]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDelete = async (id: number) => {
        if (!confirm("¿Estás seguro de eliminar este gasto?")) return;
        try {
            await apiService.deleteGasto(id);
            toast.success("Gasto eliminado");
            loadData();
        } catch (error) {
            toast.error("Error al eliminar gasto");
        }
    };

    const totalPagado = gastos
        .filter((g) => g.estado === "PAGADO")
        .reduce((acc, g) => acc + Number(g.monto), 0);

    const totalPendiente = gastos
        .filter((g) => g.estado === "PENDIENTE")
        .reduce((acc, g) => acc + Number(g.monto), 0);

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 md:px-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Wallet className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-[10px] md:text-xs font-black text-primary uppercase tracking-[0.2em]">Finanzas del Negocio</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground tracking-tighter leading-none">
                        Gestión de <span className="text-primary">Gastos</span>
                    </h1>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button variant="outline" onClick={() => setCatModalOpen(true)} className="flex-1 md:flex-none rounded-2xl h-12 md:h-14 font-black text-xs uppercase tracking-widest border-primary/20 hover:bg-primary/5 transition-all">
                        Categorías
                    </Button>
                    <Button onClick={() => { setEditingGasto(null); setModalOpen(true); }} className="flex-[1.5] md:flex-none bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl h-12 md:h-14 font-black text-xs uppercase tracking-widest gap-2 shadow-xl shadow-primary/20 active:scale-95 transition-all">
                        <Plus className="h-4 w-4 stroke-[3px]" /> Nuevo Gasto
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Total Pagado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-700">{formatMoney(totalPagado)}</div>
                        <p className="text-xs text-emerald-600/70 mt-1">Suma de egresos efectivos en el periodo</p>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-orange-500/20 bg-orange-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-orange-600 uppercase tracking-widest">Total Pendiente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-orange-700">{formatMoney(totalPendiente)}</div>
                        <p className="text-xs text-orange-600/70 mt-1">Pagos futuros y vencimientos próximos</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card/50 backdrop-blur-sm p-3 rounded-2xl border border-border/50 shadow-sm mx-2 md:mx-0">
                <div className="flex items-center gap-2 px-3 sm:border-r border-border/50 sm:pr-4 py-1 sm:py-0">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Filtros</span>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2 flex-1">
                    <Select value={filterEstado} onValueChange={setFilterEstado}>
                        <SelectTrigger className="w-full sm:w-[160px] border-transparent bg-muted/30 rounded-xl h-11 text-xs font-black uppercase tracking-widest hover:bg-muted/50 transition-all">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                            <SelectItem value="all" className="font-bold">Todos los Estados</SelectItem>
                            <SelectItem value="PAGADO" className="font-bold text-emerald-600">Pagados</SelectItem>
                            <SelectItem value="PENDIENTE" className="font-bold text-orange-600">Pendientes</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] border-transparent bg-muted/30 rounded-xl h-11 text-xs font-black uppercase tracking-widest hover:bg-muted/50 transition-all">
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                            <SelectItem value="all" className="font-bold">Todas las Categorías</SelectItem>
                            {categorias.map((cat) => (
                                <SelectItem key={cat.id} value={String(cat.id)} className="font-bold">{cat.nombre}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Main List */}
            <div className="space-y-3">
                {loading ? (
                    [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
                ) : gastos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                            <Receipt className="h-10 w-10 opacity-20" />
                        </div>
                        <p className="text-lg font-bold">No hay gastos registrados</p>
                        <p className="text-sm mt-1">Los egresos del negocio aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="grid gap-4 px-2 md:px-0">
                        {gastos.map((g) => (
                            <div
                                key={g.id}
                                className={cn(
                                    "group p-1 rounded-[2rem] transition-all hover:scale-[1.01] active:scale-[0.99]",
                                    g.estado === "PENDIENTE" ? "bg-gradient-to-br from-orange-500/20 to-transparent" : "bg-gradient-to-br from-emerald-500/20 to-transparent"
                                )}
                            >
                                <div className="bg-card border border-white/10 rounded-[1.8rem] p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm group-hover:shadow-xl transition-all">
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className={cn(
                                            "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:rotate-12",
                                            g.estado === "PENDIENTE" ? "bg-orange-500/10 text-orange-500" : "bg-emerald-500/10 text-emerald-500"
                                        )}>
                                            {g.esRecurrente ? <Repeat className="h-7 w-7" /> : <Receipt className="h-7 w-7" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="text-lg md:text-xl font-black tracking-tighter truncate leading-none">{g.motivo}</h3>
                                                {g.cuotaActual && g.cuotaTotal && (
                                                    <Badge variant="outline" className="text-[10px] font-black border-primary/30 text-primary bg-primary/5 rounded-full px-2">
                                                        Cuota {g.cuotaActual}/{g.cuotaTotal}
                                                    </Badge>
                                                )}
                                                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/5 text-primary/70">
                                                    {g.categoria?.nombre}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="h-3 w-3" /> {formatDate(g.fecha)}
                                                </span>
                                                {g.fechaVencimiento && (
                                                    <span className={cn(
                                                        "flex items-center gap-1.5",
                                                        new Date(g.fechaVencimiento) < new Date() && g.estado === "PENDIENTE" ? "text-destructive" : "text-orange-500/70"
                                                    )}>
                                                        <AlertTriangle className="h-3 w-3" /> Vence: {formatDate(g.fechaVencimiento)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5">
                                        <div className="text-left sm:text-right">
                                            <div className="text-2xl md:text-3xl font-black tracking-tighter leading-none mb-1">{formatMoney(Number(g.monto))}</div>
                                            <Badge className={cn(
                                                "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full",
                                                g.estado === "PENDIENTE" ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"
                                            )}>
                                                {g.estado}
                                            </Badge>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="rounded-2xl h-12 w-12 bg-muted/20 hover:bg-primary/10 hover:text-primary transition-all">
                                                    <MoreVertical className="h-5 w-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-[1.5rem] border-none shadow-2xl p-2 w-56">
                                                <DropdownMenuItem onClick={() => handleShareClick(g)} className="gap-3 py-3 rounded-xl font-bold cursor-pointer focus:bg-emerald-500/10 focus:text-emerald-600 transition-colors">
                                                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                        <Share2 className="h-4 w-4 text-emerald-500" />
                                                    </div>
                                                    Compartir Voucher
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setEditingGasto(g); setModalOpen(true); }} className="gap-3 py-3 rounded-xl font-bold cursor-pointer focus:bg-blue-500/10 focus:text-blue-600 transition-colors">
                                                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                        <Edit2 className="h-4 w-4 text-blue-500" />
                                                    </div>
                                                    Editar Gasto
                                                </DropdownMenuItem>
                                                <div className="h-px bg-muted my-1 mx-2" />
                                                <DropdownMenuItem onClick={() => handleDelete(g.id)} className="gap-3 py-3 rounded-xl font-bold cursor-pointer text-destructive focus:bg-destructive/10 transition-colors">
                                                    <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                                                        <Trash2 className="h-4 w-4" />
                                                    </div>
                                                    Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {modalOpen && (
                <GastoModal
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    onSuccess={loadData}
                    categorias={categorias}
                    editingGasto={editingGasto}
                />
            )}

            {shareModalOpen && sharingGasto && (
                <ShareGastoModal
                    open={shareModalOpen}
                    onOpenChange={setShareModalOpen}
                    gasto={sharingGasto}
                />
            )}

            {catModalOpen && (
                <CategoriasModal
                    open={catModalOpen}
                    onOpenChange={setCatModalOpen}
                    categorias={categorias}
                    onSuccess={loadData}
                    activeSucursalId={activeSucursalId}
                />
            )}
        </div>
    );
}

function GastoModal({ open, onOpenChange, onSuccess, categorias, editingGasto }: any) {
    const [formData, setFormData] = React.useState({
        monto: "",
        motivo: "",
        fecha: new Date().toISOString().split("T")[0],
        fechaVencimiento: "",
        estado: "PAGADO",
        esRecurrente: false,
        frecuencia: "UNICO",
        categoriaGastoId: "",
    });
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (editingGasto) {
            setFormData({
                monto: String(editingGasto.monto),
                motivo: editingGasto.motivo,
                fecha: new Date(editingGasto.fecha).toISOString().split("T")[0],
                fechaVencimiento: editingGasto.fechaVencimiento ? new Date(editingGasto.fechaVencimiento).toISOString().split("T")[0] : "",
                estado: editingGasto.estado,
                esRecurrente: editingGasto.esRecurrente,
                frecuencia: editingGasto.frecuencia,
                categoriaGastoId: String(editingGasto.categoriaGastoId),
            });
        }
    }, [editingGasto]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingGasto) {
                await apiService.updateGasto(editingGasto.id, formData);
                toast.success("Gasto actualizado");
            } else {
                await apiService.createGasto(formData);
                toast.success("Gasto registrado");
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error("Error al guardar gasto");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">
                        {editingGasto ? "Editar Gasto" : "Registrar Gasto"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Monto ($)</label>
                            <Input
                                type="text"
                                required
                                value={formData.monto.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/\./g, "");
                                    if (/^\d*$/.test(rawValue)) {
                                        setFormData({ ...formData, monto: rawValue });
                                    }
                                }}
                                placeholder="0"
                                className="rounded-xl bg-muted/30 border-transparent focus:border-primary/30 h-11 font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Fecha</label>
                            <Input
                                type="date" required
                                value={formData.fecha}
                                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                className="rounded-xl bg-muted/30 border-transparent focus:border-primary/30 h-11"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Motivo / Concepto</label>
                        <Input
                            required
                            value={formData.motivo}
                            onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                            placeholder="Ej: Alquiler Local, Pago Proveedor..."
                            className="rounded-xl bg-muted/30 border-transparent focus:border-primary/30 h-11 font-medium"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Categoría</label>
                            <Select value={formData.categoriaGastoId} onValueChange={(v) => setFormData({ ...formData, categoriaGastoId: v })}>
                                <SelectTrigger className="rounded-xl bg-muted/30 border-transparent h-11 font-bold">
                                    <SelectValue placeholder="Elegir..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {categorias.map((c: any) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Estado</label>
                            <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                                <SelectTrigger className="rounded-xl bg-muted/30 border-transparent h-11 font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PAGADO" className="font-bold text-emerald-600">PAGADO</SelectItem>
                                    <SelectItem value="PENDIENTE" className="font-bold text-orange-600">PENDIENTE</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="esRecurrente"
                                checked={formData.esRecurrente}
                                onChange={(e) => setFormData({ ...formData, esRecurrente: e.target.checked })}
                                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                            />
                            <label htmlFor="esRecurrente" className="text-sm font-bold flex items-center gap-1.5 select-none cursor-pointer">
                                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                                Gasto Recurrente
                            </label>
                        </div>

                        {formData.esRecurrente && (
                            <Select value={formData.frecuencia} onValueChange={(v) => setFormData({ ...formData, frecuencia: v })}>
                                <SelectTrigger className="rounded-xl border-dashed h-10 text-xs font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MENSUAL">Mensual</SelectItem>
                                    <SelectItem value="SEMANAL">Semanal</SelectItem>
                                    <SelectItem value="ANUAL">Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formData.esRecurrente ? "Fecha Final de Pago" : "Fecha de Vencimiento (Opcional)"}
                        </label>
                        <Input
                            type="date"
                            value={formData.fechaVencimiento}
                            onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                            className="rounded-xl bg-muted/30 border-transparent h-11"
                        />
                        {formData.esRecurrente && formData.fechaVencimiento && (
                            <p className="text-[10px] font-bold text-primary/70 px-1 italic">
                                * Se generarán automáticamente todas las cuotas hasta esta fecha.
                            </p>
                        )}
                    </div>

                    <div className="pt-4">
                        <Button disabled={loading} type="submit" className="w-full h-12 rounded-2xl font-black text-base shadow-lg shadow-primary/20">
                            {loading ? "Guardando..." : editingGasto ? "Guardar Cambios" : "Confirmar Gasto"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function CategoriasModal({ open, onOpenChange, categorias, onSuccess, activeSucursalId }: any) {
    const [nombre, setNombre] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        setLoading(true);
        try {
            await apiService.createGastoCategoria(nombre);
            toast.success("Categoría creada");
            setNombre("");
            onSuccess();
        } catch (error) {
            toast.error("Error al crear categoría");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("¿Estás seguro de eliminar esta categoría? Si tiene gastos asociados no podrás eliminarla.")) return;
        setLoading(true);
        try {
            await apiService.deleteGastoCategoria(id);
            toast.success("Categoría eliminada");
            onSuccess();
        } catch (error) {
            toast.error(String(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">Categorías de Gasto</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    <form onSubmit={handleAdd} className="flex gap-2">
                        <Input
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Nueva categoría..."
                            className="rounded-xl bg-muted/40 border-transparent h-11 font-bold"
                        />
                        <Button disabled={loading || !nombre.trim()} size="icon" className="h-11 w-11 shrink-0 rounded-xl">
                            <Plus className="h-5 w-5" />
                        </Button>
                    </form>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {categorias.map((c: any) => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-muted/20 border rounded-xl group">
                                <span className="font-bold text-sm tracking-tight">{c.nombre}</span>
                                <Button
                                    disabled={loading}
                                    onClick={() => handleDelete(c.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {categorias.length === 0 && (
                            <p className="text-center py-8 text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                                No hay categorías
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ShareGastoModal({ open, onOpenChange, gasto }: any) {
    const [clients, setClients] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [manualNumber, setManualNumber] = React.useState("");
    const [searchQuery, setSearchQuery] = React.useState("");

    React.useEffect(() => {
        const loadClients = async () => {
            try {
                const data = await apiService.getClientes();
                setClients(data || []);
            } catch (error) {
                console.error("Error loading clients", error);
            } finally {
                setLoading(false);
            }
        };
        if (open) loadClients();
    }, [open]);

    const getLink = async () => {
        const { url } = await apiService.getGastoComprobanteLink(gasto.id);
        return `${window.location.origin}${url}`;
    };

    const handleCopy = async () => {
        try {
            const link = await getLink();
            await navigator.clipboard.writeText(link);
            toast.success("Enlace copiado al portapapeles");
        } catch (error) {
            toast.error("Error al copiar enlace");
        }
    };

    const handleOpen = async () => {
        try {
            const link = await getLink();
            window.open(link, "_blank");
        } catch (error) {
            toast.error("Error al abrir comprobante");
        }
    };

    const handleWhatsApp = async (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, "");
        if (!cleanPhone) {
            toast.error("Número inválido");
            return;
        }

        try {
            const link = await getLink();
            const message = encodeURIComponent(`Hola, te comparto el comprobante de gasto: ${gasto.motivo}\n\nPuedes verlo aquí: ${link}`);
            window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
        } catch (error) {
            toast.error("Error al generar mensaje de WhatsApp");
        }
    };

    const filteredClients = clients.filter(c => {
        const phone = c.telefono || "";
        const hasPhone = phone.trim() !== "" && !phone.toLowerCase().includes("sin número");
        const isNotConsumidor = !c.nombre.toLowerCase().includes("consumidor final");
        const matchesSearch = c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (phone.includes(searchQuery));
        return hasPhone && isNotConsumidor && matchesSearch;
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Premium Gradient Header */}
                <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-8 pb-14 text-primary-foreground relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-2xl" />

                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-4 text-white">
                            <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg shadow-black/10">
                                <Share2 className="h-6 w-6 text-white" />
                            </div>
                            Compartir Comprobante
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-[10px] font-black uppercase tracking-[0.15em] text-white/90">
                            Detalles del Gasto
                        </div>
                        <div className="mt-2 text-xl font-bold text-white tracking-tight">
                            {gasto.motivo}
                            <span className="ml-2 text-white/60 font-medium">({formatMoney(Number(gasto.monto))})</span>
                        </div>
                    </div>
                </div>

                {/* Main Content with Glass-like transition */}
                <div className="p-8 -mt-10 bg-background rounded-t-[3rem] shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.1)] relative z-20 space-y-8">
                    <Tabs defaultValue="manual" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 rounded-2xl h-14 bg-muted/30 p-1.5 mb-2">
                            <TabsTrigger value="manual" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all duration-300">
                                Número Manual
                            </TabsTrigger>
                            <TabsTrigger value="clientes" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all duration-300">
                                Mis Clientes
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="manual" className="pt-4 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/70 ml-1">Para el número:</label>
                                <Input
                                    type="tel"
                                    placeholder="Ej: 5491112345678"
                                    value={manualNumber}
                                    onChange={(e) => setManualNumber(e.target.value)}
                                    className="rounded-2xl bg-muted/30 border-transparent h-16 text-xl font-black tracking-tight focus:border-primary/20 focus:bg-card hover:bg-muted/50 transition-all text-center"
                                />
                            </div>
                            <Button
                                onClick={() => handleWhatsApp(manualNumber)}
                                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl h-16 font-black text-sm tracking-widest uppercase flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/30 active:scale-[0.98] transition-all"
                            >
                                <MessageSquare className="h-5 w-5 fill-current" />
                                Enviar WhatsApp
                            </Button>
                        </TabsContent>

                        <TabsContent value="clientes" className="pt-4 space-y-5">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Buscar por nombre o teléfono..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="rounded-2xl bg-muted/30 border-transparent h-14 pl-12 font-bold focus:border-primary/20 focus:bg-card hover:bg-muted/50 transition-all"
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-[100px]">
                                {loading ? (
                                    [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
                                ) : filteredClients.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                        <Search className="h-10 w-10 mb-2" />
                                        <div className="font-bold text-xs uppercase tracking-widest text-center">Sin resultados</div>
                                    </div>
                                ) : (
                                    filteredClients.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => handleWhatsApp(c.telefono)}
                                            className="w-full flex items-center justify-between p-4 bg-muted/20 border border-transparent rounded-2xl hover:bg-primary/5 hover:border-primary/10 transition-all group relative overflow-hidden active:scale-[0.99]"
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className="h-12 w-12 rounded-xl bg-card border text-primary flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                                    <User className="h-6 w-6" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-black text-base tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">{c.nombre}</div>
                                                    <div className="text-xs text-muted-foreground font-bold opacity-70 italic">{c.telefono}</div>
                                                </div>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                                <MessageSquare className="h-4 w-4" />
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* Quick Action Footer */}
                    <div className="pt-6 border-t border-muted grid grid-cols-2 gap-4">
                        <Button
                            variant="ghost"
                            onClick={handleCopy}
                            className="h-20 flex-col gap-2 rounded-2xl bg-muted/20 hover:bg-primary/5 hover:text-primary transition-all font-black text-[10px] uppercase tracking-[0.15em] active:scale-[0.98]"
                        >
                            <div className="h-8 w-8 rounded-xl bg-card border flex items-center justify-center shadow-sm">
                                <Copy className="h-4 w-4" />
                            </div>
                            Copiar Enlace
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleOpen}
                            className="h-20 flex-col gap-2 rounded-2xl bg-muted/20 hover:bg-blue-500/5 hover:text-blue-600 transition-all font-black text-[10px] uppercase tracking-[0.15em] active:scale-[0.98]"
                        >
                            <div className="h-8 w-8 rounded-xl bg-card border flex items-center justify-center shadow-sm">
                                <ExternalLink className="h-4 w-4" />
                            </div>
                            Abrir Documento
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
