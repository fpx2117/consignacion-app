"use client";

import type React from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiRequestError, apiService } from "@/lib/apiService";
import type { LoginInput } from "@/lib/types";
import { cn } from "@/lib/utils";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCapsOn = e.getModifierState?.("CapsLock") ?? false;
    setCapsLockOn(isCapsOn);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return;

    setLoading(true);
    setError(null);

    try {
      const payload: LoginInput = {
        email: cleanEmail,
        password,
        remember,
      };

      // ✅ Usa apiService (cookie HttpOnly seteada por el backend)
      await apiService.login(payload);

      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = getLoginErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-muted/60 shadow-xl">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>

        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Iniciar sesión
          </CardTitle>
          <CardDescription>
            Accedé a tu cuenta para operar el sistema.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {error && (
          <Alert variant="destructive" className="border-destructive/30" aria-live="assertive">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="pl-9"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>

              <button
                type="button"
                className="text-xs text-primary hover:underline disabled:opacity-50"
                disabled={loading}
                onClick={() => router.push("/forgot-password")}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={handleCapsLock}
                onKeyDown={handleCapsLock}
                disabled={loading}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-password-feedback" : undefined}
                required
                className={cn(
                  "pl-9 pr-10",
                  error && "border-destructive/70 focus-visible:ring-destructive/40",
                )}
              />

              <button
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {capsLockOn && (
              <p className="text-xs text-[color:var(--status-warning)]">⚠️ Bloq Mayús activado</p>
            )}

            {error && (
              <p id="login-password-feedback" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>

          {/* Remember */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(!!v)}
                disabled={loading}
              />
              <Label htmlFor="remember" className="text-sm text-muted-foreground">
                Mantener sesión iniciada
              </Label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </form>

        <Separator />

        <div className="text-xs leading-relaxed text-muted-foreground">
          <p>
            Tus credenciales se transmiten de forma segura y se manejan mediante
            autenticación protegida (cookie HttpOnly).
          </p>
          <p className="mt-2">Si no tenés acceso, contactá a un administrador.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 429) {
      return error.retryAfterSeconds && error.retryAfterSeconds > 0
        ? `Demasiados intentos de inicio de sesion. Espera ${formatRetryAfter(error.retryAfterSeconds)} antes de volver a intentar.`
        : "Demasiados intentos de inicio de sesion. Espera un momento antes de volver a intentar.";
    }

    if (error.status === 401) {
      return typeof error.remainingAttempts === "number" && error.remainingAttempts >= 0
        ? `Correo o contrasena incorrectos. Te quedan ${formatRemainingAttempts(error.remainingAttempts)} antes del bloqueo temporal.`
        : "Correo o contrasena incorrectos. Revisa tus datos e intenta de nuevo.";
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "No se pudo iniciar sesion. Intenta nuevamente.";
}

function formatRetryAfter(retryAfterSeconds: number) {
  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds} segundo${retryAfterSeconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
}

function formatRemainingAttempts(remainingAttempts: number) {
  return `${remainingAttempts} intento${remainingAttempts === 1 ? "" : "s"}`;
}
