"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  EyeOff,
  Eye,
} from "lucide-react";

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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("El enlace es inválido o falta el token de recuperación.");
    }
  }, [token]);

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCapsOn = e.getModifierState?.("CapsLock") ?? false;
    setCapsLockOn(isCapsOn);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) return;

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.resetPassword({ token, password });
      setSuccess(true);
      // Opcional: auto-redirigir después de unos segundos
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al procesar tu solicitud.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token && !error) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <Card className="border-muted/60 shadow-xl">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>

        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Nueva contraseña
          </CardTitle>
          <CardDescription>
            Creá una nueva contraseña para tu cuenta.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {success ? (
          <div className="space-y-6 text-center">
            <div className="flex justify-center flex-col items-center space-y-3 p-4 bg-[color:var(--status-success)]/10 rounded-lg text-[color:var(--status-success)] border border-[color:var(--status-success)]/20">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm font-medium">Contraseña actualizada</p>
              <p className="text-xs text-muted-foreground">
                Tu contraseña ha sido cambiada con éxito. Serás redirigido al
                inicio de sesión.
              </p>
            </div>

            <Button className="w-full" onClick={() => router.push("/login")}>
              Ir al inicio de sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-destructive/30">
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {/* Nueva Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={handleCapsLock}
                    onKeyDown={handleCapsLock}
                    disabled={loading || !token}
                    required
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={loading || !token}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirmar Contraseña */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyUp={handleCapsLock}
                    onKeyDown={handleCapsLock}
                    disabled={loading || !token}
                    required
                    className="pl-9 pr-10"
                  />
                </div>
              </div>

              {capsLockOn && (
                <p className="text-xs text-[color:var(--status-warning)]">
                  ⚠️ Bloq Mayús activado
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !token || !password || !confirmPassword}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Guardando..." : "Guardar contraseña"}
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
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-6">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-muted/40 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <Suspense
          fallback={<div className="text-center">Cargando formulario...</div>}
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
