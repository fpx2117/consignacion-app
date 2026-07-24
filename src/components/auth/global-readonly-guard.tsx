"use client";

import * as React from "react";
import { toast } from "sonner";
import { useSucursalStore } from "@/store/useSucursalStore";

const BLOCKED_ACTION_LABELS =
  /(nuevo|nueva|crear|guardar|editar|eliminar|borrar|desactivar|activar|anular|cobrar|confirmar|postergar|registrar|agregar|aplicar|quitar|actualizar|abrir caja|cerrar caja|extender turno|delete|create|edit|save|update)/i;

function getActionLabel(el: Element | null): string {
  if (!el) return "";
  const htmlEl = el as HTMLElement;
  return (
    htmlEl.getAttribute("aria-label") ||
    htmlEl.getAttribute("title") ||
    htmlEl.textContent ||
    ""
  ).trim();
}

export function GlobalReadonlyGuard() {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const isGlobalView = activeSucursalId === 0;

  React.useEffect(() => {
    if (!isGlobalView) return;

    const showBlockedToast = () => {
      toast.warning(
        "Vista global: solo lectura. Selecciona una sucursal para operar.",
      );
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      const actionable = target.closest("button, a, [role='menuitem']");
      if (!actionable) return;

      const actionLabel = getActionLabel(actionable);
      const explicitBypass = actionable.hasAttribute("data-readonly-allow");
      const shouldBlock =
        !explicitBypass && BLOCKED_ACTION_LABELS.test(actionLabel);

      if (!shouldBlock) return;

      event.preventDefault();
      event.stopPropagation();
      showBlockedToast();
    };

    const onSubmitCapture = (event: SubmitEvent) => {
      event.preventDefault();
      event.stopPropagation();
      showBlockedToast();
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("submit", onSubmitCapture, true);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("submit", onSubmitCapture, true);
    };
  }, [isGlobalView]);

  return null;
}
