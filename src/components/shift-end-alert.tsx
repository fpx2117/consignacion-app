"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Timer, Loader2, Clock, ChevronRight, XCircle, AlertOctagon } from "lucide-react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/apiService";
import { toast } from "sonner";

interface ShiftEndAlertProps {
    horaFin: string | undefined; // Formato "HH:mm"
    onExtender?: (nuevaHora: string) => void;
}

export function ShiftEndAlert({ horaFin, onExtender }: ShiftEndAlertProps) {
    const router = useRouter();
    const [showModal, setShowModal] = React.useState(false);
    const [isExpired, setIsExpired] = React.useState(false);
    const [loadingMins, setLoadingMins] = React.useState<number | null>(null);

    // Monitor de tiempo: Compara hora actual con horaFin y maneja el autocierre
    React.useEffect(() => {
        if (!horaFin) return;

        const checkTime = () => {
            const ahora = new Date();
            const [h, m] = horaFin.split(":").map(Number);

            const tiempoLimite = new Date();
            tiempoLimite.setHours(h, m, 0);

            const diffMilis = tiempoLimite.getTime() - ahora.getTime();
            const minsParaFin = diffMilis / 60000;

            // 1. LÓGICA DE AUTOCIERRE (Si pasan más de 2 min del límite)
            if (minsParaFin <= -2) {
                toast.error("Sesión expirada. Redirigiendo a cierre de caja...");
                router.push("/caja/cerrar?reason=auto");
                return;
            }

            // 2. LÓGICA DE EXPIRACIÓN (Cartel Rojo)
            if (minsParaFin <= 0) {
                setIsExpired(true);
                setShowModal(true);
            }
            // 3. LÓGICA DE ADVERTENCIA (5 min antes - Cartel Violeta)
            else if (minsParaFin <= 5) {
                setIsExpired(false);
                setShowModal(true);
            }
            // 4. TIEMPO VÁLIDO (Post-extensión)
            else {
                setShowModal(false);
            }
        };

        const interval = setInterval(checkTime, 10000); // Revisar cada 10 seg
        checkTime();

        return () => clearInterval(interval);
    }, [horaFin, router]);

    const handleExtender = async (minutos: number) => {
        if (!horaFin) return;
        setLoadingMins(minutos);

        try {
            // Notificar al servidor con los minutos elegidos
            await apiService.extenderTurno(minutos);

            // Calcular nueva hora basada en la anterior
            const [h, m] = horaFin.split(":").map(Number);
            const date = new Date();
            date.setHours(h, m + minutos, 0);
            const nuevaHora = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            // Avisar al padre (page.tsx)
            if (onExtender) onExtender(nuevaHora);

            setShowModal(false);
            toast.success(`Turno extendido +${minutos === 60 ? '1 hora' : minutos + ' minutos'}`);
        } catch (error: any) {
            toast.error("Error al registrar la extensión");
        } finally {
            setLoadingMins(null);
        }
    };

    return (
        <AlertDialog open={showModal}>
            <AlertDialogContent className={cn(
                "rounded-[2.5rem] border-2 shadow-2xl max-w-[440px] p-8 backdrop-blur-xl transition-colors duration-500",
                isExpired ? "border-red-500/20 bg-background/95" : "border-violet-500/20 bg-background/95"
            )}>
                <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
                    <div className={cn(
                        "h-20 w-20 rounded-3xl flex items-center justify-center shadow-lg transition-all duration-500",
                        isExpired
                            ? "bg-red-500/10 text-red-600 animate-pulse shadow-red-500/10"
                            : "bg-violet-500/10 text-violet-600 animate-bounce shadow-violet-500/10"
                    )}>
                        {isExpired ? <AlertOctagon className="h-10 w-10" /> : <Timer className="h-10 w-10" />}
                    </div>

                    <div className="space-y-2">
                        <AlertDialogTitle className={cn(
                            "text-3xl font-black tracking-tight",
                            isExpired ? "text-red-600" : "text-foreground"
                        )}>
                            {isExpired ? "Turno Expirado" : "Fin de Jornada"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground font-medium text-base">
                            {isExpired
                                ? `Tu horario límite era a las ${horaFin}. Debes extender o cerrar la caja ahora mismo.`
                                : `Tu turno finaliza pronto (${horaFin}). ¿Deseas solicitar más tiempo?`
                            }
                        </AlertDialogDescription>
                    </div>
                </AlertDialogHeader>

                {/* OPCIONES DE EXTENSIÓN */}
                <div className="grid grid-cols-1 gap-3 mt-8">
                    <ExtensionButton
                        mins={15}
                        loading={loadingMins === 15}
                        onClick={() => handleExtender(15)}
                    />
                    <ExtensionButton
                        mins={30}
                        loading={loadingMins === 30}
                        onClick={() => handleExtender(30)}
                    />
                    <ExtensionButton
                        mins={60}
                        loading={loadingMins === 60}
                        onClick={() => handleExtender(60)}
                    />

                    <Separator className="my-2 opacity-50" />

                    <Button
                        variant="ghost"
                        onClick={() => router.push("/caja/cerrar")}
                        className="h-14 rounded-2xl font-bold text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <XCircle className="h-5 w-5 mr-2" />
                        No extender, cerrar ahora
                    </Button>

                    {!isExpired && (
                        <Button
                            variant="link"
                            onClick={() => setShowModal(false)}
                            className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-50 hover:opacity-100"
                        >
                            Ignorar por ahora
                        </Button>
                    )}
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Subcomponente para los botones de opción de tiempo
 */
function ExtensionButton({ mins, loading, onClick }: { mins: number, loading: boolean, onClick: () => void }) {
    return (
        <Button
            variant="outline"
            onClick={onClick}
            disabled={loading}
            className="h-16 rounded-2xl border-2 border-border/40 hover:border-violet-500 hover:bg-violet-500/5 flex justify-between px-6 group transition-all active:scale-[0.98]"
        >
            <div className="flex items-center gap-4">
                {loading ? (
                    <Loader2 className="animate-spin h-5 w-5 text-violet-600" />
                ) : (
                    <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 group-hover:bg-violet-500 group-hover:text-white transition-colors shadow-inner">
                        <Clock className="h-5 w-5" />
                    </div>
                )}
                <span className="font-black text-lg text-foreground">
                    +{mins === 60 ? '1 Hora' : `${mins} Minutos`}
                </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
        </Button>
    );
}