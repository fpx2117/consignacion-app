"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Loader2, ArrowLeft, Clock, User, Save, ShieldCheck,
    CalendarDays, Ban, Copy, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/apiService";
import type { HorarioLaboral, Usuario } from "@/lib/types";

const DIAS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type EditableHorario = Pick<HorarioLaboral, "diaSemana" | "horaInicio" | "horaFin" | "activo"> &
    Partial<Pick<HorarioLaboral, "id" | "usuarioId">>;

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export default function HorariosPosPage() {
    const router = useRouter();
    const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);
    const [selectedUser, setSelectedUser] = React.useState<Usuario | null>(null);
    const [horariosTemp, setHorariosTemp] = React.useState<EditableHorario[]>([]);

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [activeDay, setActiveDay] = React.useState(new Date().getDay());

    const loadData = React.useCallback(async () => {
        try {
            const res = await apiService.getUsuariosConHorarios();
            setUsuarios(res || []);
        } catch (error) {
            toast.error(getErrorMessage(error, "Error al cargar el staff"));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { loadData(); }, [loadData]);

    const selectUser = (user: Usuario) => {
        setSelectedUser(user);
        const base = DIAS.map((_, index) => {
            const exist = user.horarios?.find((horario) => horario.diaSemana === index);
            return exist ? { ...exist } : { diaSemana: index, horaInicio: "09:00", horaFin: "18:00", activo: true };
        });
        setHorariosTemp(base);
    };

    const copyToAll = () => {
        const current = horariosTemp[activeDay];
        const newArr = horariosTemp.map((horario) => ({
            ...horario,
            horaInicio: current.horaInicio,
            horaFin: current.horaFin,
            activo: current.activo
        }));
        setHorariosTemp(newArr);
        toast.success("Horario replicado a toda la semana");
    };

    const handleSave = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            await apiService.guardarHorariosStaff(selectedUser.id, horariosTemp);
            toast.success("Horarios actualizados correctamente");
            void loadData();
        } catch (error) {
            toast.error(getErrorMessage(error, "Error al guardar"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-background space-y-4">
                <Loader2 className="animate-spin h-8 w-8 text-[color:var(--primary)]" />
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Cargando staff...</p>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-background text-foreground pb-20 selection:bg-[color:var(--primary)]/20">

            {/* HEADER FIJO */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 p-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full shrink-0 border-border/50 h-10 w-10 hover:bg-muted/50">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight leading-none flex items-center gap-2">
                                <Clock className="h-5 w-5 text-[color:var(--primary)] hidden sm:block" />
                                Control de Horarios
                            </h1>
                            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">Configuración POS</p>
                        </div>
                    </div>
                    {selectedUser && (
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-[color:var(--primary)] hover:bg-[color:var(--primary)] text-[color:var(--ui-fx-white)] font-bold shadow-sm px-6 h-10 transition-all">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            <span className="hidden sm:inline">Guardar Cambios</span>
                            <span className="sm:hidden">Guardar</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-4 md:p-8">

                {/* DISEÑO A DOS COLUMNAS EN PC (Grid) */}
                <div className="grid lg:grid-cols-12 gap-8">

                    {/* COLUMNA IZQUIERDA: LISTA DE USUARIOS */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 px-2">
                            <Users className="h-4 w-4" /> Staff Disponible
                        </div>

                        {/* En móvil es horizontal, en PC es vertical */}
                        <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar lg:flex-col lg:overflow-visible">
                            {usuarios.length === 0 ? (
                                <div className="p-6 text-center border border-dashed border-border/50 rounded-2xl text-muted-foreground text-sm">
                                    No hay empleados registrados.
                                </div>
                            ) : (
                                usuarios.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => selectUser(u)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-2xl border transition-all shrink-0 min-w-[180px] lg:min-w-full text-left",
                                            selectedUser?.id === u.id
                                                ? "bg-[color:var(--primary)]/10 border-[color:var(--primary)]/30 text-[color:var(--primary)] dark:text-[color:var(--primary)]"
                                                : "bg-card border-border/40 hover:bg-muted/50 text-foreground"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-10 w-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                                            selectedUser?.id === u.id ? "bg-[color:var(--primary)] text-[color:var(--ui-fx-white)] shadow-md shadow-violet-500/20" : "bg-muted text-muted-foreground"
                                        )}>
                                            {u.nombre.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-sm truncate">{u.nombre}</p>
                                            <p className="text-[10px] uppercase font-bold opacity-60 truncate">{u.rol}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: CALENDARIO */}
                    <div className="lg:col-span-8">
                        {selectedUser ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

                                <Card className="border-border/40 shadow-sm rounded-3xl overflow-hidden bg-card">

                                    {/* HEADER DEL PLANIFICADOR */}
                                    <div className="p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/5">
                                        <div>
                                            <h2 className="text-lg font-bold flex items-center gap-2">
                                                <CalendarDays className="h-5 w-5 text-[color:var(--primary)]" />
                                                Planificador Semanal
                                            </h2>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Editando horario de <b>{selectedUser.nombre}</b>
                                            </p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={copyToAll} className="h-9 rounded-xl border-border/50 hover:bg-muted/50">
                                            <Copy className="h-4 w-4 mr-2 text-[color:var(--primary)]" />
                                            Replicar a toda la semana
                                        </Button>
                                    </div>

                                    {/* SELECTOR DE DÍAS */}
                                    <div className="p-6 pb-2">
                                        <div className="grid grid-cols-7 gap-2">
                                            {DIAS.map((dia, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveDay(idx)}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border transition-all",
                                                        activeDay === idx
                                                            ? "bg-foreground text-background border-foreground shadow-md scale-105"
                                                            : horariosTemp[idx]?.activo
                                                                ? "bg-background border-border/50 hover:border-foreground/30"
                                                                : "bg-muted/30 border-transparent opacity-50"
                                                    )}
                                                >
                                                    <span className="text-[11px] md:text-xs font-bold uppercase">{dia}</span>
                                                    {horariosTemp[idx]?.activo ? (
                                                        <div className={cn("h-1.5 w-1.5 rounded-full", activeDay === idx ? "bg-background" : "bg-[color:var(--status-success-strong)]")} />
                                                    ) : (
                                                        <Ban className="h-3 w-3 opacity-50" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* DETALLE DEL DÍA (CONTROLES DE TIEMPO) */}
                                    <div className="p-6 md:p-8 mt-2">
                                        <div className="bg-muted/30 rounded-[2rem] border border-border/40 p-6 flex flex-col md:flex-row md:items-center justify-between gap-8">

                                            {/* Switch de activación */}
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-black">{DIAS_LARGOS[activeDay]}</h3>
                                                <div className="flex items-center gap-3">
                                                    <Switch
                                                        checked={horariosTemp[activeDay]?.activo}
                                                        onCheckedChange={(val) => {
                                                            const newArr = [...horariosTemp];
                                                            newArr[activeDay].activo = val;
                                                            setHorariosTemp(newArr);
                                                        }}
                                                        className="data-[state=checked]:bg-[color:var(--status-success-strong)]"
                                                    />
                                                    <span className="text-sm font-medium text-muted-foreground">
                                                        {horariosTemp[activeDay]?.activo ? "Turno Habilitado" : "Acceso Restringido"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Inputs de Horario */}
                                            {horariosTemp[activeDay]?.activo && (
                                                <div className="flex items-center gap-3 bg-background p-3 rounded-2xl border border-border/50 shadow-sm w-full md:w-auto">
                                                    <div className="flex-1 text-center px-4">
                                                        <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Apertura</span>
                                                        <input
                                                            type="time"
                                                            value={horariosTemp[activeDay].horaInicio}
                                                            onChange={(e) => {
                                                                const newArr = [...horariosTemp];
                                                                newArr[activeDay].horaInicio = e.target.value;
                                                                setHorariosTemp(newArr);
                                                            }}
                                                            className="bg-transparent text-lg font-bold outline-none cursor-pointer w-[90px] text-center focus:text-[color:var(--primary)] transition-colors"
                                                        />
                                                    </div>
                                                    <div className="h-10 w-[1px] bg-border" />
                                                    <div className="flex-1 text-center px-4">
                                                        <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Cierre</span>
                                                        <input
                                                            type="time"
                                                            value={horariosTemp[activeDay].horaFin}
                                                            onChange={(e) => {
                                                                const newArr = [...horariosTemp];
                                                                newArr[activeDay].horaFin = e.target.value;
                                                                setHorariosTemp(newArr);
                                                            }}
                                                            className="bg-transparent text-lg font-bold outline-none cursor-pointer w-[90px] text-center focus:text-[color:var(--primary)] transition-colors"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                {/* NOTA DE SEGURIDAD */}
                                <div className="bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 rounded-2xl p-4 flex gap-4 items-start shadow-sm">
                                    <ShieldCheck className="h-5 w-5 text-[color:var(--primary)] shrink-0 mt-0.5" />
                                    <p className="text-sm text-[color:var(--primary)] dark:text-[color:var(--primary)] font-medium leading-relaxed">
                                        <b>Nota de Seguridad:</b> Si {selectedUser.nombre} intenta abrir una sesión de caja fuera del rango establecido para este día, el sistema bloqueará la operación automáticamente.
                                    </p>
                                </div>

                            </div>
                        ) : (
                            /* ESTADO VACÍO (Sin empleado seleccionado) */
                            <div className="h-full min-h-[400px] border-2 border-dashed border-border/40 rounded-3xl flex flex-col items-center justify-center text-muted-foreground bg-card/10">
                                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <User className="h-8 w-8 opacity-40" />
                                </div>
                                <h3 className="font-bold text-lg text-foreground">Ningún empleado seleccionado</h3>
                                <p className="text-sm mt-1 max-w-xs text-center">
                                    Selecciona un miembro del staff de la lista para gestionar sus permisos de caja.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
