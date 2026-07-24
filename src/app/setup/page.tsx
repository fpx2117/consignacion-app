"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

import { SetupShell } from "./components/SetupShell";
import { WelcomeStep } from "./components/steps/WelcomeStep";
import { BusinessStep } from "./components/steps/BusinessStep";
import { AdminStep } from "./components/steps/AdminStep";
import { BranchStep } from "./components/steps/BranchStep";
import { PosConfigStep } from "./components/steps/PosConfigStep";
import { CatalogStep } from "./components/steps/CatalogStep";
import { NotificationsStep } from "./components/steps/NotificationsStep";
import { TeamStep } from "./components/steps/TeamStep";
import { SubscriptionStep } from "./components/steps/SubscriptionStep";
import { PaymentStep } from "./components/steps/PaymentStep";
import { LoadingStep } from "./components/steps/LoadingStep";
import { SuccessStep } from "./components/steps/SuccessStep";

import { STEPS } from "./constants";
import { DEFAULT_FORM_DATA } from "./constants";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";

import type { SetupStep, SetupFormData, InitializePayload } from "./types";
import type { SubscriptionPlan } from "@/constants/subscriptions";

const ENABLED_SETUP_PLAN_IDS = [2, 3] as const;
const isEnabledSetupPlan = (planId: number) =>
  ENABLED_SETUP_PLAN_IDS.includes(
    planId as (typeof ENABLED_SETUP_PLAN_IDS)[number],
  );

// ─── Helpers ────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const [mimeInfo, data] = result.split(";base64,");
      const mime = mimeInfo.split(":")[1];
      resolve({ data, mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toSafeData(form: SetupFormData): Record<string, unknown> {
  const { password: _ap, confirmPassword: _acp, ...safeAdmin } = form.adminData;
  const safeStaff = form.staff.map(({ password: _sp, ...rest }) => rest);
  const { logoFile: _lf, logoPreview: _lp, ...safeBranding } = form.branding;

  return {
    businessName: form.businessName,
    rubroNegocio: form.rubroNegocio,
    adminData: safeAdmin,
    branding: safeBranding,
    branch: form.branch,
    posConfig: form.posConfig,
    catalog: form.catalog,
    notifications: form.notifications,
    staff: safeStaff,
    selectedPlanId: form.selectedPlanId,
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stepIndex, setStepIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [form, setForm] = useState<SetupFormData>({ ...DEFAULT_FORM_DATA });
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );

  const currentStep = STEPS[stepIndex]?.id ?? "welcome";

  // ─── Persistence ────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("setup_data_v2");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setForm((prev) => ({
        ...prev,
        businessName: data.businessName ?? prev.businessName,
        rubroNegocio:
          data.rubroNegocio !== undefined
            ? data.rubroNegocio
            : prev.rubroNegocio,
        branding: { ...prev.branding, ...data.branding },
        adminData: { ...prev.adminData, ...data.adminData },
        branch: { ...prev.branch, ...data.branch },
        posConfig: { ...prev.posConfig, ...data.posConfig },
        catalog: { ...prev.catalog, ...data.catalog },
        notifications: { ...prev.notifications, ...data.notifications },
        staff: data.staff ?? prev.staff,
        selectedPlanId: data.selectedPlanId ?? prev.selectedPlanId,
      }));
      if (data.selectedPlanId) {
        const plan = SUBSCRIPTION_PLANS.find(
          (p) => p.id === data.selectedPlanId && isEnabledSetupPlan(p.id),
        );
        if (plan) setSelectedPlan(plan);
      }
      if (typeof data.stepIndex === "number") setStepIndex(data.stepIndex);
    } catch {
      // silently ignore corrupt data
    }
  }, []);

  useEffect(() => {
    const safe = toSafeData(form);
    sessionStorage.setItem(
      "setup_data_v2",
      JSON.stringify({ ...safe, stepIndex }),
    );
  }, [form, stepIndex]);

  // ─── Navigation ─────────────────────────────────────────────────────────
  const goToStep = useCallback((step: SetupStep) => {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx >= 0) setStepIndex(idx);
  }, []);

  const handleNext = useCallback(() => {
    const step = STEPS[stepIndex]?.id;

    if (step === "business") {
      if (!form.businessName.trim()) {
        toast.error("El nombre del negocio es requerido");
        return;
      }
    }

    if (step === "admin") {
      if (
        !form.adminData.nombre ||
        !form.adminData.email ||
        !form.adminData.password
      ) {
        toast.error("Todos los datos del administrador son requeridos");
        return;
      }
      if (form.adminData.password !== form.adminData.confirmPassword) {
        toast.error("Las contraseñas no coinciden");
        return;
      }
      if (form.adminData.password.length < 6) {
        toast.error("La contraseña debe tener al menos 6 caracteres");
        return;
      }
    }

    if (step === "branch") {
      if (!form.branch.nombre.trim()) {
        toast.error("El nombre de la sucursal es requerido");
        return;
      }
      if (!form.branch.terminalNombre.trim()) {
        toast.error("El nombre de la terminal es requerido");
        return;
      }
    }

    if (step === "subscription") {
      if (!selectedPlan) {
        toast.error("Debes seleccionar un plan");
        return;
      }
    }

    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, [stepIndex, form, selectedPlan]);

  const handleBack = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkip = useCallback(() => {
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  // ─── Plan selection ────────────────────────────────────────────────────
  const handlePlanSelected = useCallback(
    (plan: SubscriptionPlan) => {
      setSelectedPlan(plan);
      setForm((prev) => ({ ...prev, selectedPlanId: plan.id }));
      goToStep("payment");
    },
    [goToStep],
  );

  // ─── Form updaters ────────────────────────────────────────────────────
  const updateForm = useCallback(
    <K extends keyof SetupFormData>(key: K, value: SetupFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ─── Payment + Initialize ──────────────────────────────────────────────
  const handlePaymentSuccess = useCallback(
    async (promoCode?: string, paymentId?: string) => {
      console.log(
        "🚀 handlePaymentSuccess llamado - promoCode:",
        promoCode,
        "paymentId:",
        paymentId,
      );

      if (!selectedPlan && !promoCode) {
        console.warn("⚠️ No hay selectedPlan ni promoCode");
        return;
      }

      goToStep("loading");
      setIsProcessing(true);

      try {
        let logoPayload: { logoData?: string; logoMime?: string } = {};
        if (form.branding.logoFile) {
          const { data, mime } = await fileToBase64(form.branding.logoFile);
          logoPayload = { logoData: data, logoMime: mime };
        }

        const payload: InitializePayload = {
          admin: {
            nombre: form.adminData.nombre,
            email: form.adminData.email,
            password: form.adminData.password,
          },
          planId: selectedPlan?.id ?? 2,
          businessName: form.businessName,
          rubroNegocio: form.rubroNegocio,
          staff: form.staff.filter((s) => s.nombre && s.email),
          promoCode,
          paymentId,
          branding: {
            phone: form.branding.phone || undefined,
            address: form.branding.address || undefined,
            primaryColor: form.branding.primaryColor,
            ...logoPayload,
          },
          branch: {
            nombre: form.branch.nombre,
            terminalNombre: form.branch.terminalNombre,
          },
          posConfig: form.posConfig,
          catalog: form.catalog.mostrarListaPrecios
            ? {
                mostrarListaPrecios: form.catalog.mostrarListaPrecios,
                whatsappNumber: form.catalog.whatsappNumber || undefined,
              }
            : undefined,
          notifications: {
            minStockGlobal: form.notifications.minStockGlobal,
            diasAnticipacionVencimiento:
              form.notifications.diasAnticipacionVencimiento,
            notificarStockBajo: form.notifications.notificarStockBajo,
            notificarVencimientos: form.notifications.notificarVencimientos,
            notificarVentas: form.notifications.notificarVentas,
            notificarLiquidaciones: form.notifications.notificarLiquidaciones,
            notificarConsignacionesActivas:
              form.notifications.notificarConsignacionesActivas,
            diasAvisoConsignacion: form.notifications.diasAvisoConsignacion,
          },
        };

        const response = await fetch("/api/setup/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        console.log("📡 API Response status:", response.status);

        if (response.ok) {
          console.log("✅ Setup inicializado correctamente");
          console.log("📝 Response:", await response.clone().json());
          sessionStorage.removeItem("setup_data_v2");
          goToStep("success");
          setTimeout(() => {
            console.log("🔄 Redirigiendo a /dashboard...");
            router.push("/dashboard");
          }, 4000);
        } else {
          const error = await response.json();
          console.error("❌ API Error:", error);
          toast.error(error.message || "Error al inicializar el sistema");
          goToStep("payment");
        }
      } catch {
        toast.error("Ocurrió un error en el servidor");
        goToStep("payment");
      } finally {
        setIsProcessing(false);
      }
    },
    [form, goToStep, router, selectedPlan],
  );

  // ─── Payment redirect handler ──────────────────────────────────────────
  useEffect(() => {
    const status = searchParams.get("status");
    const paymentId =
      searchParams.get("payment_id") ??
      searchParams.get("preference_id") ??
      searchParams.get("subscription_id");

    if (status === "success" && paymentId) {
      void handlePaymentSuccess(undefined, paymentId);
      return;
    }

    if (status === "failure") {
      toast.error("El pago no pudo ser procesado. Reintenta.");
      goToStep("payment");
    }
  }, [goToStep, handlePaymentSuccess, searchParams]);

  // ─── Render ─────────────────────────────────────────────────────────────
  const stepsWithOwnNext: SetupStep[] = [
    "welcome",
    "subscription",
    "payment",
    "loading",
    "success",
  ];
  const showNextButton = !stepsWithOwnNext.includes(currentStep);

  return (
    <SetupShell
      currentStep={currentStep}
      stepIndex={stepIndex}
      onBack={handleBack}
      onNext={handleNext}
      onSkip={!STEPS[stepIndex]?.required ? handleSkip : undefined}
      showNextButton={showNextButton}
    >
      {currentStep === "welcome" && (
        <WelcomeStep key="welcome" onNext={() => setStepIndex(1)} />
      )}

      {currentStep === "business" && (
        <BusinessStep
          key="business"
          businessName={form.businessName}
          branding={form.branding}
          rubroNegocio={form.rubroNegocio}
          onBusinessNameChange={(v) => updateForm("businessName", v)}
          onBrandingChange={(v) => updateForm("branding", v)}
          onRubroNegocioChange={(v) => updateForm("rubroNegocio", v)}
        />
      )}

      {currentStep === "admin" && (
        <AdminStep
          key="admin"
          data={form.adminData}
          onChange={(v) => updateForm("adminData", v)}
        />
      )}

      {currentStep === "branch" && (
        <BranchStep
          key="branch"
          data={form.branch}
          onChange={(v) => updateForm("branch", v)}
        />
      )}

      {currentStep === "pos" && (
        <PosConfigStep
          key="pos"
          data={form.posConfig}
          onChange={(v) => updateForm("posConfig", v)}
        />
      )}

      {currentStep === "catalog" && (
        <CatalogStep
          key="catalog"
          data={form.catalog}
          onChange={(v) => updateForm("catalog", v)}
        />
      )}

      {currentStep === "notifications" && (
        <NotificationsStep
          key="notifications"
          data={form.notifications}
          onChange={(v) => updateForm("notifications", v)}
        />
      )}

      {currentStep === "team" && (
        <TeamStep
          key="team"
          staff={form.staff}
          onChange={(v) => updateForm("staff", v)}
        />
      )}

      {currentStep === "subscription" && (
        <SubscriptionStep
          key="subscription"
          onPlanSelected={handlePlanSelected}
        />
      )}

      {currentStep === "payment" && selectedPlan && (
        <PaymentStep
          key="payment"
          plan={selectedPlan}
          onPaymentSuccess={handlePaymentSuccess}
          loading={isProcessing}
        />
      )}

      {currentStep === "loading" && <LoadingStep key="loading" />}

      {currentStep === "success" && <SuccessStep key="success" />}
    </SetupShell>
  );
}
