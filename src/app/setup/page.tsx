"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

// Sub-components
import { WelcomeStep } from "./components/WelcomeStep";
import { BusinessStep } from "./components/BusinessStep";
import { AdminStep } from "./components/AdminStep";
import { TeamStep, StaffMember } from "./components/TeamStep";
import { SubscriptionStep } from "./components/SubscriptionStep";
import { PaymentStep } from "./components/PaymentStep";
import { LoadingStep } from "./components/LoadingStep";

import { SUBSCRIPTION_PLANS, SubscriptionPlan } from "@/constants/subscriptions";
import { Button } from "@/components/ui/button";

const stepsCount = 7; // excluding success/loading

export default function SetupPage() {
    const [currentStep, setCurrentStep] = useState(0); // 0 = Welcome
    const [isProcessing, setIsProcessing] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();

    // Form States
    const [businessName, setBusinessName] = useState("");
    const [adminData, setAdminData] = useState({
        nombre: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [staff, setStaff] = useState<StaffMember[]>([
        { nombre: "", email: "", rol: "EMPLEADO", password: "" }
    ]);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

    // Persistence: Load from sessionStorage on mount
    useEffect(() => {
        const savedData = sessionStorage.getItem("setup_data");
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                setBusinessName(data.businessName || "");
                setAdminData(data.adminData || { nombre: "", email: "", password: "", confirmPassword: "" });
                setStaff(data.staff || [{ nombre: "", email: "", rol: "EMPLEADO" }]);
                if (data.selectedPlanId) {
                    const plan = SUBSCRIPTION_PLANS.find(p => p.id === data.selectedPlanId);
                    if (plan) setSelectedPlan(plan);
                }
                if (data.currentStep) setCurrentStep(data.currentStep);
            } catch (e) {
                console.error("Error loading persisted setup data", e);
            }
        }
    }, []);

    // Persistence: Save to sessionStorage on change
    useEffect(() => {
        const data = {
            businessName,
            adminData,
            staff,
            selectedPlanId: selectedPlan?.id,
            currentStep
        };
        sessionStorage.setItem("setup_data", JSON.stringify(data));
    }, [businessName, adminData, staff, selectedPlan, currentStep]);

    // Handle payment redirect success
    useEffect(() => {
        const status = searchParams.get("status");
        const paymentId = searchParams.get("payment_id");
        const preferenceId = searchParams.get("preference_id");
        const subscriptionId = searchParams.get("subscription_id");

        const activePaymentId = paymentId || preferenceId || subscriptionId;

        if (status === "success" && activePaymentId) {
            handlePaymentSuccess(undefined, activePaymentId);
        } else if (status === "failure") {
            toast.error("El pago no pudo ser procesado. Reintenta.");
            setCurrentStep(5); // Go back to payment selection
        }
    }, [searchParams]);

    const handleNext = () => {
        if (currentStep === 1) { // Business Step
            if (!businessName.trim()) {
                toast.error("El nombre de la empresa es requerido");
                return;
            }
        } else if (currentStep === 2) { // Admin Step
            if (!adminData.nombre || !adminData.email || !adminData.password) {
                toast.error("Todos los datos del administrador son requeridos");
                return;
            }
            if (adminData.password !== adminData.confirmPassword) {
                toast.error("Las contraseñas no coinciden");
                return;
            }
        } else if (currentStep === 4) { // Subscription Step
            if (!selectedPlan) {
                toast.error("Debes seleccionar un plan");
                return;
            }
        }
        setCurrentStep(prev => prev + 1);
    };

    const handleBack = () => setCurrentStep(prev => prev - 1);

    const handlePlanSelected = (plan: SubscriptionPlan) => {
        setSelectedPlan(plan);
        setCurrentStep(5); // Go to Payment
    };

    const handlePaymentSuccess = async (promoCode?: string, paymentId?: string) => {
        if (!selectedPlan && !promoCode) return;

        // Final Loading Step
        setCurrentStep(6);
        setIsProcessing(true);

        try {
            const payload = {
                admin: adminData,
                planId: selectedPlan?.id || 1, // Fallback if promo overrides
                businessName,
                staff: staff.filter(s => s.nombre && s.email),
                promoCode,
                paymentId
            };

            const response = await fetch("/api/setup/initialize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                sessionStorage.removeItem("setup_data");
                setCurrentStep(7); // Success Step
                setTimeout(() => {
                    router.push("/dashboard");
                }, 4000);
            } else {
                const error = await response.json();
                toast.error(error.message || "Error al inicializar el sistema");
                setCurrentStep(5); // Go back to payment
            }
        } catch (error) {
            console.error("Setup error:", error);
            toast.error("Ocurrió un error en el servidor");
            setCurrentStep(5);
        } finally {
            setIsProcessing(false);
        }
    };

    // Progress Bar Calculation
    const progressPercentage = Math.min((currentStep / (stepsCount - 2)) * 100, 100);

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-foreground flex flex-col items-center justify-center relative overflow-hidden font-sans">
            {/* Background effects */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full pointer-events-none" />

            {/* Top Progress Bar (Visible outside welcome and loading/success) */}
            {currentStep > 0 && currentStep < 6 && (
                <div className="absolute top-0 left-0 w-full h-1 bg-muted/30 z-50">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_10px_2px_rgba(139,92,246,0.5)]"
                    />
                </div>
            )}

            <div className="w-full max-w-5xl px-6 py-12 md:py-24 relative z-10 flex flex-col min-h-screen">
                <div className="flex-1 flex flex-col justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                        {currentStep === 0 && (
                            <motion.div key="step0">
                                <WelcomeStep onNext={() => setCurrentStep(1)} />
                            </motion.div>
                        )}

                        {currentStep === 1 && (
                            <BusinessStep key="step1" value={businessName} onChange={setBusinessName} onNext={handleNext} />
                        )}

                        {currentStep === 2 && (
                            <AdminStep key="step2" data={adminData} onChange={setAdminData} onNext={handleNext} />
                        )}

                        {currentStep === 3 && (
                            <TeamStep key="step3" staff={staff} setStaff={setStaff} onNext={handleNext} />
                        )}

                        {currentStep === 4 && (
                            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full">
                                <div className="text-center mb-10">
                                    <h2 className="text-3xl font-black tracking-tight">Selecciona tu Plan</h2>
                                    <p className="text-muted-foreground mt-2">Elige la capacidad que necesita tu ecosistema.</p>
                                </div>
                                <SubscriptionStep onPlanSelected={handlePlanSelected} />
                            </motion.div>
                        )}

                        {currentStep === 5 && selectedPlan && (
                            <motion.div key="step5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-3xl mx-auto">
                                <div className="text-center mb-10">
                                    <h2 className="text-3xl font-black tracking-tight">Activación de Licencia</h2>
                                    <p className="text-muted-foreground mt-2">Inicia tu pago de forma segura para activar el sistema.</p>
                                </div>
                                <PaymentStep plan={selectedPlan} onPaymentSuccess={handlePaymentSuccess} loading={isProcessing} />
                            </motion.div>
                        )}

                        {currentStep === 6 && (
                            <LoadingStep key="step6" />
                        )}

                        {currentStep === 7 && (
                            <motion.div
                                key="step7"
                                initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                className="flex flex-col items-center justify-center text-center space-y-6 h-[50vh]"
                            >
                                <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_50px_10px_rgba(34,197,94,0.4)]">
                                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <motion.path
                                                initial={{ pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ duration: 0.5, delay: 0.2 }}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                    </div>
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black tracking-tight">¡Todo Listo!</h2>
                                <p className="text-muted-foreground text-xl">Tu ecosistema empresarial ha sido configurado con éxito.</p>
                                <p className="text-sm font-medium text-foreground/50 animate-pulse pt-4">Redirigiendo al panel de control...</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Bottom Navigation */}
                {currentStep > 0 && currentStep < 6 && (
                    <div className="fixed bottom-0 left-0 w-full p-6 sm:p-8 flex justify-between pointer-events-none z-50">
                        <div className="pointer-events-auto">
                            <Button
                                variant="ghost"
                                onClick={handleBack}
                                className="h-12 px-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Atrás</span>
                            </Button>
                        </div>

                        {currentStep < 3 && ( // Only show "Next" for Business & Admin step, Team step handles it inside
                            <div className="pointer-events-auto">
                                <Button
                                    onClick={handleNext}
                                    className="h-12 px-6 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-[0_4px_20px_-5px_var(--tw-shadow-color)] shadow-foreground/30 hover:-translate-y-1 transition-all"
                                >
                                    <span className="text-xs font-bold uppercase tracking-widest">Siguiente</span>
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
