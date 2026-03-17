"use client";

import * as React from "react";
import {
    Plus,
    Calendar,
    Repeat,
    Trash2,
    ExternalLink,
    MessageSquare,
    Copy,
    Search,
    User,
    GitFork,
    Share2,
} from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { useTimezone } from "@/hooks/useTimezone";
import { useSucursalStore } from "@/store/useSucursalStore";
import type { Gasto, CategoriaGasto } from "@/lib/types";
import { formatMoney } from "@/lib/utils-format";
import { formatDateInputAR, formatTimeInputAR } from "@/lib/utils-date";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { GastosHeader } from "./components/gastos-header";
import { GastosSummaryCards } from "./components/gastos-summary-cards";
import { GastosFilters } from "./components/gastos-filters";
import { GastosList } from "./components/gastos-list";

export default function GastosPage() {
    const { tz } = useTimezone();
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
        } catch {
            toast.error("Error al cargar datos de gastos");
        } finally {
            setLoading(false);
        }
    }, [filterEstado, filterCategoria]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDelete = async (id: number) => {
        if (!confirm("¿Estás seguro de eliminar este gasto?")) return;
        try {
            await apiService.deleteGasto(id);
            toast.success("Gasto eliminado");
            loadData();
        } catch {
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
            <GastosHeader
                onOpenCategories={() => setCatModalOpen(true)}
                onOpenNew={() => {
                    setEditingGasto(null);
                    setModalOpen(true);
                }}
            />

            <GastosSummaryCards totalPagado={totalPagado} totalPendiente={totalPendiente} />

            <GastosFilters
                filterEstado={filterEstado}
                filterCategoria={filterCategoria}
                categorias={categorias}
                onEstadoChange={setFilterEstado}
                onCategoriaChange={setFilterCategoria}
            />

            <GastosList
                gastos={gastos}
                loading={loading}
                activeSucursalId={activeSucursalId}
                onShare={(gasto) => handleShareClick(gasto as Gasto)}
                onEdit={(gasto) => {
                    setEditingGasto(gasto as Gasto);
                    setModalOpen(true);
                }}
                onDelete={handleDelete}
            />

            {/* Modals */}
            {modalOpen && (
                <GastoModal
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                    onSuccess={loadData}
                    categorias={categorias}
                    editingGasto={editingGasto}
                    activeSucursalId={activeSucursalId}
                    tz={tz}
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

interface GastoModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSuccess: () => void;
    categorias: import("@/lib/types").CategoriaGasto[];
    editingGasto: import("@/lib/types").Gasto | null;
    activeSucursalId: number;
    tz: string;
}
function GastoModal({ open, onOpenChange, onSuccess, categorias, editingGasto, activeSucursalId, tz }: GastoModalProps) {
    const [formData, setFormData] = React.useState({
        monto: "",
        motivo: "",
        fecha: formatDateInputAR(new Date(), tz),
        hora: formatTimeInputAR(new Date(), tz),
        fechaVencimiento: "",
        horaVencimiento: "23:59",
        estado: "PAGADO",
        esRecurrente: false,
        frecuencia: "UNICO",
        categoriaGastoId: "",
    });
    const [loading, setLoading] = React.useState(false);

    // Compartir entre sucursales
    const [sucursales, setSucursales] = React.useState<{ id: number; nombre: string; activa: boolean }[]>([]);
    const [esCompartido, setEsCompartido] = React.useState(false);
    const [selectedSucursales, setSelectedSucursales] = React.useState<number[]>([]);

    React.useEffect(() => {
        if (editingGasto) {
            setFormData({
                monto: String(editingGasto.monto),
                motivo: editingGasto.motivo,
                fecha: formatDateInputAR(editingGasto.fecha, tz),
                hora: formatTimeInputAR(editingGasto.fecha, tz),
                fechaVencimiento: editingGasto.fechaVencimiento ? formatDateInputAR(editingGasto.fechaVencimiento, tz) : "",
                horaVencimiento: editingGasto.fechaVencimiento ? formatTimeInputAR(editingGasto.fechaVencimiento, tz) : "23:59",
                estado: editingGasto.estado,
                esRecurrente: editingGasto.esRecurrente,
                frecuencia: editingGasto.frecuencia,
                categoriaGastoId: String(editingGasto.categoriaGastoId),
            });
            setEsCompartido(!!editingGasto.esCompartido);
            if (editingGasto.esCompartido && (editingGasto.sucursalesCompartidas?.length ?? 0) > 0) {
                setSelectedSucursales((editingGasto.sucursalesCompartidas ?? []).map((s) => s.sucursalId));
            } else if (activeSucursalId) {
                setSelectedSucursales([activeSucursalId]);
            }
        }
    }, [editingGasto, activeSucursalId, tz]);

    React.useEffect(() => {
        if (open && !editingGasto) {
            setFormData({
                monto: "",
                motivo: "",
                fecha: formatDateInputAR(new Date(), tz),
                hora: formatTimeInputAR(new Date(), tz),
                fechaVencimiento: "",
                horaVencimiento: "23:59",
                estado: "PAGADO",
                esRecurrente: false,
                frecuencia: "UNICO",
                categoriaGastoId: "",
            });
            setEsCompartido(false);
        }
    }, [open, editingGasto, tz]);

    // Cargar sucursales al abrir el modal (tanto crear como editar)
    React.useEffect(() => {
        if (open) {
            apiService.getSucursales().then((data) => {
                setSucursales(data || []);
                // Pre-seleccionar la sucursal activa solo al crear
                if (!editingGasto && activeSucursalId) {
                    setSelectedSucursales([activeSucursalId]);
                }
            }).catch(() => {});
        }
    }, [open, editingGasto, activeSucursalId]);

    const toggleSucursal = (id: number) => {
        setSelectedSucursales((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const montoProporcional = esCompartido && selectedSucursales.length > 1 && formData.monto
        ? Number(formData.monto) / selectedSucursales.length
        : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: typeof formData & { sucursalesCompartir?: number[] } = { ...formData };

            if (esCompartido && selectedSucursales.length > 1) {
                payload.sucursalesCompartir = selectedSucursales;
            } else if (!esCompartido && editingGasto?.esCompartido) {
                // Si se quitó el compartir, enviar array vacío para desactivarlo
                payload.sucursalesCompartir = [];
            }

            if (editingGasto) {
                await apiService.updateGasto(editingGasto.id, payload);
                toast.success("Gasto actualizado");
            } else {
                await apiService.createGasto(payload);
                toast.success(esCompartido && selectedSucursales.length > 1
                    ? `Gasto compartido entre ${selectedSucursales.length} sucursales`
                    : "Gasto registrado"
                );
            }
            onSuccess();
            onOpenChange(false);
        } catch {
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Hora</label>
                            <Input
                                type="time" required
                                value={formData.hora}
                                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
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
                                    {categorias.map((c) => (
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
                                    <SelectItem value="PAGADO" className="font-bold text-[color:var(--status-success-strong)]">PAGADO</SelectItem>
                                    <SelectItem value="PENDIENTE" className="font-bold text-[color:var(--status-warning)]">PENDIENTE</SelectItem>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {formData.esRecurrente ? "Fecha Final de Pago" : "Fecha de Vencimiento (Opcional)"}
                            </label>
                            <Input
                                type="date"
                                value={formData.fechaVencimiento}
                                onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                                className="rounded-xl bg-muted/30 border-transparent h-11"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Hora de Vencimiento</label>
                            <Input
                                type="time"
                                value={formData.horaVencimiento}
                                onChange={(e) => setFormData({ ...formData, horaVencimiento: e.target.value })}
                                className="rounded-xl bg-muted/30 border-transparent h-11"
                                disabled={!formData.fechaVencimiento}
                            />
                        </div>
                    </div>
                    {formData.esRecurrente && formData.fechaVencimiento && (
                        <p className="text-[10px] font-bold text-primary/70 px-1 italic">
                            * Se generarán automáticamente todas las cuotas hasta esta fecha.
                        </p>
                    )}

                    {/* Dividir entre sucursales */}
                    {sucursales.length > 1 && (
                        <div className="space-y-3 pt-2 border-t border-border/40">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="esCompartido"
                                    checked={esCompartido}
                                    onChange={(e) => {
                                        setEsCompartido(e.target.checked);
                                        if (e.target.checked && activeSucursalId && !selectedSucursales.includes(activeSucursalId)) {
                                            setSelectedSucursales([activeSucursalId]);
                                        }
                                    }}
                                    className="rounded border-border text-[color:var(--primary)] focus:ring-[color:var(--primary)] h-4 w-4"
                                />
                                <label htmlFor="esCompartido" className="text-sm font-bold flex items-center gap-1.5 select-none cursor-pointer text-[color:var(--primary)]">
                                    <GitFork className="h-3.5 w-3.5" />
                                    Dividir entre sucursales
                                </label>
                            </div>

                            {esCompartido && (
                                <div className="rounded-2xl bg-[color:var(--primary)]/5 border border-[color:var(--primary)]/20 p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--primary)]/70">Seleccionar sucursales</p>
                                    <div className="space-y-2">
                                        {sucursales.map((s) => (
                                            <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSucursales.includes(s.id)}
                                                    onChange={() => toggleSucursal(s.id)}
                                                    disabled={s.id === activeSucursalId} // La sucursal creadora siempre incluida
                                                    className="rounded border-border text-[color:var(--primary)] focus:ring-[color:var(--primary)] h-4 w-4"
                                                />
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    s.id === activeSucursalId ? "text-[color:var(--primary)]" : "text-foreground"
                                                )}>
                                                    {s.nombre}
                                                    {s.id === activeSucursalId && (
                                                        <span className="ml-1.5 text-[9px] font-black uppercase tracking-widest text-[color:var(--primary)]/70">(esta sucursal)</span>
                                                    )}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    {montoProporcional !== null && (
                                        <div className="flex items-center justify-between pt-2 border-t border-[color:var(--primary)]/20">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--primary)]/70">Cada sucursal pagará:</span>
                                            <span className="text-lg font-black text-[color:var(--primary)]">{formatMoney(montoProporcional)}</span>
                                        </div>
                                    )}
                                    {esCompartido && selectedSucursales.length < 2 && (
                                        <p className="text-[10px] font-bold text-[color:var(--status-warning)]/80 italic">
                                            * Seleccioná al menos 2 sucursales para dividir el gasto.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4">
                        <Button
                            disabled={loading || (esCompartido && selectedSucursales.length < 2)}
                            type="submit"
                            className="w-full h-12 rounded-2xl font-black text-base shadow-lg shadow-primary/20"
                        >
                            {loading ? "Guardando..." : editingGasto ? "Guardar Cambios" : "Confirmar Gasto"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

interface CategoriasModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    categorias: CategoriaGasto[];
    onSuccess: () => void;
    activeSucursalId: number;
}
function CategoriasModal({ open, onOpenChange, categorias, onSuccess }: CategoriasModalProps) {
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
        } catch {
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
                        {categorias.map((c) => (
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

interface ShareGastoModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    gasto: Gasto;
}
function ShareGastoModal({ open, onOpenChange, gasto }: ShareGastoModalProps) {
    const [clients, setClients] = React.useState<{ id: number; nombre: string; telefono?: string | null }[]>([]);
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
        } catch {
            toast.error("Error al copiar enlace");
        }
    };

    const handleOpen = async () => {
        try {
            const link = await getLink();
            window.open(link, "_blank");
        } catch {
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
        } catch {
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
                    <div className="absolute top-0 right-0 w-32 h-32 bg-card/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-card/5 rounded-full -ml-12 -mb-12 blur-2xl" />

                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-4 text-[color:var(--ui-fx-white)]">
                            <div className="h-12 w-12 rounded-2xl bg-card/20 backdrop-blur-md flex items-center justify-center shadow-lg shadow-black/10">
                                <Share2 className="h-6 w-6 text-[color:var(--ui-fx-white)]" />
                            </div>
                            Compartir Comprobante
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card/10 backdrop-blur-sm border border-[color:var(--ui-fx-white)]/10 text-[10px] font-black uppercase tracking-[0.15em] text-[color:var(--ui-fx-white)]/90">
                            Detalles del Gasto
                        </div>
                        <div className="mt-2 text-xl font-bold text-[color:var(--ui-fx-white)] tracking-tight">
                            {gasto.motivo}
                            <span className="ml-2 text-[color:var(--ui-fx-white)]/60 font-medium">({formatMoney(Number(gasto.monto))})</span>
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
                                className="w-full bg-[color:var(--brand-whatsapp)] hover:brightness-95 text-[color:var(--ui-fx-white)] rounded-2xl h-16 font-black text-sm tracking-widest uppercase flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/30 active:scale-[0.98] transition-all"
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
                                            onClick={() => handleWhatsApp(c.telefono ?? "")}
                                            className="w-full flex items-center justify-between p-4 bg-muted/20 border border-transparent rounded-2xl hover:bg-primary/5 hover:border-primary/10 transition-all group relative overflow-hidden active:scale-[0.99]"
                                        >
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className="h-12 w-12 rounded-xl bg-card border text-primary flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-primary group-hover:text-[color:var(--ui-fx-white)] transition-all duration-300">
                                                    <User className="h-6 w-6" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-black text-base tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">{c.nombre}</div>
                                                    <div className="text-xs text-muted-foreground font-bold opacity-70 italic">{c.telefono}</div>
                                                </div>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
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
                            className="h-20 flex-col gap-2 rounded-2xl bg-muted/20 hover:bg-[color:var(--theme-ocean-primary)]/5 hover:text-[color:var(--theme-ocean-primary)] transition-all font-black text-[10px] uppercase tracking-[0.15em] active:scale-[0.98]"
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
