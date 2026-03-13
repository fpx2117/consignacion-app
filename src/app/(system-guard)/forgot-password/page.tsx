/* eslint-disable */
// @ts-nocheck
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiService } from "@/lib/apiService";

export default function ForgotPasswordPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            setError("Por favor ingresá tu correo electrónico.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await apiService.requestPasswordReset(email.trim());
            setSuccess(true);
        } catch (err: any) {
            setError(err?.message || "Ocurrió un error al procesar tu solicitud.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-6">
            {/* Background glow */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-muted/40 blur-3xl" />
            </div>

            <div className="w-full max-w-md">
                <Card className="border-muted/60 shadow-xl">
                    <CardHeader className="space-y-2 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>

                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold tracking-tight">
                                Recuperar contraseña
                            </CardTitle>
                            <CardDescription>
                                Ingresá tu correo electrónico y te enviaremos un enlace para reestablecer tu contraseña.
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {success ? (
                            <div className="space-y-6 text-center">
                                <div className="flex justify-center flex-col items-center space-y-3 p-4 bg-[color:var(--status-success)]/10 rounded-lg text-[color:var(--status-success)] border border-[color:var(--status-success)]/20">
                                    <CheckCircle2 className="h-8 w-8" />
                                    <p className="text-sm font-medium">Revisá tu bandeja de entrada</p>
                                    <p className="text-xs text-muted-foreground">Si existe una cuenta asociada a ese correo, recibirás un enlace de recuperación.</p>
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => router.push("/login")}
                                >
                                    Volver al inicio de sesión
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <Alert variant="destructive" className="border-destructive/30">
                                        <AlertDescription className="text-sm">{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="email">Correo electrónico</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="tu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={loading}
                                            required
                                            className="pl-9"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full gap-2"
                                    disabled={loading || !email}
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {loading ? "Enviando..." : "Enviar enlace"}
                                </Button>

                                <div className="flex justify-center pt-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2 text-muted-foreground"
                                        onClick={() => router.push("/login")}
                                        disabled={loading}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Volver al login
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
