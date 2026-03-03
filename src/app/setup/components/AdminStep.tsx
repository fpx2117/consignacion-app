/* eslint-disable */
// @ts-nocheck
"use client";

import { motion } from "framer-motion";
import { UserCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminStepProps {
    data: { nombre: string; email: string; password: string; confirmPassword: string };
    onChange: (data: any) => void;
    onNext: () => void;
}

export function AdminStep({ data, onChange, onNext }: AdminStepProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && data.nombre && data.email && data.password && data.password === data.confirmPassword) {
            onNext();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl mx-auto space-y-10"
        >
            <div className="space-y-4 text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6"
                >
                    <UserCog className="w-8 h-8 text-indigo-500" />
                </motion.div>
                <h2 className="text-3xl font-black tracking-tight">Tu Perfil de Administrador</h2>
                <p className="text-muted-foreground text-lg">La llave maestra para controlar todo el ecosistema.</p>
            </div>

            <div className="space-y-6 bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-border/50 shadow-2xl relative">
                <div className="absolute inset-0 bg-indigo-500/5 blur-3xl -z-10 rounded-full" />

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">Tu Nombre</Label>
                    <Input
                        autoFocus
                        value={data.nombre}
                        onChange={(e) => onChange({ ...data, nombre: e.target.value })}
                        onKeyDown={handleKeyDown}
                        placeholder="Ej: John Doe"
                        className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-lg"
                    />
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">Email Corporativo</Label>
                    <Input
                        type="email"
                        value={data.email}
                        onChange={(e) => onChange({ ...data, email: e.target.value })}
                        onKeyDown={handleKeyDown}
                        placeholder="john@empresa.com"
                        className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-lg"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">Contraseña</Label>
                        <Input
                            type="password"
                            value={data.password}
                            onChange={(e) => onChange({ ...data, password: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">Confirmar</Label>
                        <Input
                            type="password"
                            value={data.confirmPassword}
                            onChange={(e) => onChange({ ...data, confirmPassword: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                        />
                    </div>
                </div>
            </div>

            <p className="text-center text-xs text-muted-foreground font-medium uppercase tracking-widest mt-8">
                Presiona <kbd className="px-2 py-1 rounded bg-muted font-sans border border-border mx-1 text-foreground/70">Enter</kbd> para continuar
            </p>
        </motion.div>
    );
}
