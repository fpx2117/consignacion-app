"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, Timer, ArrowRight } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AutoCloseMonitor({ horaFin }: { horaFin: string | undefined }) {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
    const [showGracePeriod, setShowGracePeriod] = React.useState(false);

    React.useEffect(() => {
        if (!horaFin) return;

        const interval = setInterval(() => {
            const ahora = new Date();
            const [h, m] = horaFin.split(":").map(Number);
            const limite = new Date();
            limite.setHours(h, m, 0);

            const diffSegundos = Math.floor((limite.getTime() - ahora.getTime()) / 1000);

            // 1. Si el tiempo expiró (Estamos en periodo de gracia o excedidos)
            if (diffSegundos <= 0) {
                // Si pasaron más de 60 segundos del límite sin acción, forzamos el cierre
                if (Math.abs(diffSegundos) >= 60) {
                    router.push("/caja/cerrar?reason=timeout");
                } else {
                    // Mostramos un aviso de "Cierre inminente" (los últimos 60 segundos)
                    setTimeLeft(60 - Math.abs(diffSegundos));
                    setShowGracePeriod(true);
                }
            } else {
                setShowGracePeriod(false);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [horaFin, router]);

    return (
        <AlertDialog open={showGracePeriod}>
            <AlertDialogContent className="border-red-500 bg-red-50 dark:bg-red-950/20 border-2 rounded-[2.5rem] max-w-[400px]">
                <AlertDialogHeader className="items-center text-center space-y-4">
                    <div className="h-20 w-20 rounded-full bg-red-500 flex items-center justify-center animate-pulse shadow-lg shadow-red-500/40">
                        <AlertOctagon className="h-10 w-10 text-white" />
                    </div>
                    <div className="space-y-2">
                        <AlertDialogTitle className="text-2xl font-black text-red-600 dark:text-red-500">
                            ¡CIERRE AUTOMÁTICO!
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-red-700 dark:text-red-400 font-bold text-base leading-tight">
                            Tu tiempo de extensión ha agotado. <br />
                            La terminal se bloqueará en:
                        </AlertDialogDescription>
                    </div>
                </AlertDialogHeader>

                <div className="flex justify-center py-4">
                    <span className="text-6xl font-black tabular-nums text-red-600 tracking-tighter">
                        00:{timeLeft?.toString().padStart(2, '0')}
                    </span>
                </div>

                <AlertDialogFooter>
                    <Button
                        className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-lg gap-2"
                        onClick={() => router.push("/caja/cerrar")}
                    >
                        Realizar Arqueo Ahora <ArrowRight className="h-5 w-5" />
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}