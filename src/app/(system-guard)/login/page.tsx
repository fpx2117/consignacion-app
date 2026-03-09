import { Suspense } from "react"; // 👈 Importamos esto
import { LoginForm } from "@/components/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-6">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-muted/40 blur-3xl" />
      </div>

      {/* Wrapper */}
      <div className="w-full max-w-md">
        
        {/* 👇 Envolvemos el LoginForm en Suspense para evitar el error de prerenderizado */}
        <Suspense fallback={<div className="text-center">Cargando formulario...</div>}>
          <LoginForm />
        </Suspense>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AllData · Sistema de consignaciones
        </p>
      </div>
    </div>
  );
}
