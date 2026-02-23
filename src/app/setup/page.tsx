"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Sub-components
import { BusinessAdminStep } from "./components/BusinessAdminStep";
import { SubscriptionStep } from "./components/SubscriptionStep";
import { PaymentStep } from "./components/PaymentStep";

import { SUBSCRIPTION_PLANS, SubscriptionPlan } from "@/constants/subscriptions";
import { Button } from "@/components/ui/button";

const steps = [
    { id: 1, title: "Negocio & Equipo" },
    { id: 2, title: "Plan" },
    { id: 3, title: "Activación" },
];

export default function SetupPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Form States
    const [businessName, setBusinessName] = useState("");
    const [adminData, setAdminData] = useState({
        nombre: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [staff, setStaff] = useState([
        { nombre: "", email: "", rol: "EMPLEADO" }
    ]);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

    const handleNext = () => {
        if (currentStep === 1) {
            if (!businessName) {
                toast.error("El nombre de la empresa es requerido");
                return;
            }
            if (!adminData.nombre || !adminData.email || !adminData.password) {
                toast.error("Los datos del administrador son requeridos");
                return;
            }
            if (adminData.password !== adminData.confirmPassword) {
                toast.error("Las contraseñas no coinciden");
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            // Usually Plan is selected directly from card click in SubscriptionStep
            // But if we had a manual next button, we'd validate here.
            if (!selectedPlan) {
                toast.error("Debes seleccionar un plan");
                return;
            }
            setCurrentStep(3);
        }
    };

    const handleBack = () => setCurrentStep(prev => prev - 1);

    const handlePlanSelected = (plan: SubscriptionPlan) => {
        setSelectedPlan(plan);
        setCurrentStep(3); // Auto-advance to payment step
    };

    const handlePaymentSuccess = async (promoCode?: string) => {
        if (!selectedPlan) return;

        setLoading(true);
        try {
            // Note: In a real flow, if it's a paid plan, MP/PayPal will return a success callback
            // For now, we simulate that success or valid promo code triggers initialization directly.
            const payload = {
                admin: adminData,
                planId: selectedPlan.id,
                businessName: businessName,
                staff: staff.filter(s => s.nombre && s.email),
                promoCode: promoCode // Pass the promo code to the backend
            };

            const response = await fetch("/api/setup/initialize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                toast.success("¡Ecosistema creado con éxito!");

                // Show a brief success animation before redirect
                setTimeout(() => {
                    router.push("/dashboard");
                }, 1500);
            } else {
                const error = await response.json();
                toast.error(error.message || "Error al inicializar el sistema");
                setLoading(false);
            }
        } catch (error) {
            console.error("Setup error:", error);
            toast.error("Ocurrió un error en el servidor");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-foreground flex flex-col relative overflow-hidden font-sans">
            {/* Ambient Backgrounds */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-900/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Header (Stepper) */}
            <div className="w-full pt-12 pb-8 px-6 relative z-10 flex flex-col items-center border-b border-border/10 bg-background/50 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-center"
                >
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-bold uppercase tracking-[0.2em]">
                        <Play className="w-3 h-3 fill-current" />
                        Setup Inicial
                    </div>
                </motion.div>

                <div className="flex items-center justify-center w-full max-w-2xl gap-2 md:gap-4">
                    {steps.map((step, index) => {
                        const isActive = currentStep === step.id;
                        const isPast = currentStep > step.id;

                        return (
                            <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                <motion.div
                                    className={`flex items-center justify-center h-10 w-10 shrink-0 rounded-2xl font-bold transition-all duration-500 text-sm ${isActive
                                        ? "bg-violet-600 text-white shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-violet-500/50 -translate-y-1"
                                        : isPast
                                            ? "bg-foreground text-background"
                                            : "bg-muted text-muted-foreground border border-border"
                                        }`}
                                >
                                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                                </motion.div>
                                <span className={`ml-3 hidden md:block text-xs font-black uppercase tracking-widest transition-colors duration-300 ${isActive ? "text-violet-400" : isPast ? "text-foreground" : "text-muted-foreground"}`}>
                                    {step.title}
                                </span>
                                {index < steps.length - 1 && (
                                    <div className="flex-1 min-w-[2rem] h-[2px] mx-4 rounded-full bg-border overflow-hidden">
                                        <div className={`h-full bg-violet-600 transition-all duration-1000 ease-in-out ${isPast ? "w-full" : "w-0"}`} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 md:p-12 relative z-10 w-full max-w-5xl mx-auto min-h-[500px]">
                <AnimatePresence mode="wait" custom={currentStep}>
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                            className="w-full max-w-2xl"
                        >
                            <BusinessAdminStep
                                businessName={businessName}
                                setBusinessName={setBusinessName}
                                adminData={adminData}
                                setAdminData={setAdminData}
                                staff={staff}
                                setStaff={setStaff}
                            />
                        </motion.div>
                    )}

                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                            className="w-full"
                        >
                            <SubscriptionStep onPlanSelected={handlePlanSelected} />
                        </motion.div>
                    )}

                    {currentStep === 3 && selectedPlan && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                            className="w-full"
                        >
                            <PaymentStep
                                plan={selectedPlan}
                                onPaymentSuccess={handlePaymentSuccess}
                                loading={loading}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Nav Controls */}
            <div className="fixed bottom-0 left-0 w-full p-6 sm:p-8 flex justify-center pointer-events-none z-20">
                <div className="flex gap-4 w-full max-w-5xl justify-between px-4 sm:px-0">
                    <div className="pointer-events-auto">
                        {currentStep > 1 && !loading && (
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                className="h-14 px-6 rounded-2xl bg-background/50 backdrop-blur-md border-border/50 hover:bg-background shadow-lg hover:-translate-y-1 transition-all"
                            >
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Atrás</span>
                            </Button>
                        )}
                    </div>

                    {currentStep === 1 && (
                        <div className="pointer-events-auto">
                            <Button
                                onClick={handleNext}
                                className="h-14 px-8 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white shadow-[0_10px_30px_-10px_var(--tw-shadow-color)] shadow-violet-600/50 hover:shadow-violet-600/80 hover:-translate-y-1 transition-all"
                            >
                                <span className="text-xs font-black uppercase tracking-widest">Siguiente Paso</span>
                                <ArrowRight className="w-5 h-5 ml-3" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading Overlay */}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl"
                    >
                        <Loader2 className="w-12 h-12 text-violet-600 animate-spin mb-6" />
                        <h2 className="text-2xl font-black tracking-tight mb-2">Construyendo tu ecosistema...</h2>
                        <p className="text-muted-foreground font-medium">Por favor no cierres esta ventana.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

