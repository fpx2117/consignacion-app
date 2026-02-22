"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserPlus,
    CreditCard,
    Users,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Loader2,
    ShieldCheck,
    Zap,
    Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    SUBSCRIPTION_PLANS,
    PLAN_LIMITS_DEFAULTS
} from "@/constants/subscriptions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const steps = [
    { id: 1, title: "Usuarios", icon: Users },
    { id: 2, title: "Suscripción", icon: CreditCard },
    { id: 3, title: "Iniciar Sistema", icon: CheckCircle2 },
];

export default function SetupPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Form States
    const [adminData, setAdminData] = useState({
        nombre: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [selectedPlan, setSelectedPlan] = useState(SUBSCRIPTION_PLANS[1]); // Default to Pro

    const [staff, setStaff] = useState([
        { nombre: "", email: "", rol: "EMPLEADO" }
    ]);

    const handleNext = () => {
        if (currentStep === 1) {
            if (!adminData.nombre || !adminData.email || !adminData.password) {
                toast.error("Por favor completa todos los campos del administrador");
                return;
            }
            if (adminData.password !== adminData.confirmPassword) {
                toast.error("Las contraseñas no coinciden");
                return;
            }
        }
        setCurrentStep(prev => prev + 1);
    };

    const handleBack = () => setCurrentStep(prev => prev - 1);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/setup/initialize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    admin: adminData,
                    planId: selectedPlan.id,
                    staff: staff.filter(s => s.nombre && s.email)
                }),
            });

            if (response.ok) {
                toast.success("¡Sistema inicializado con éxito!");
                router.push("/login");
            } else {
                const error = await response.json();
                toast.error(error.message || "Error al inicializar el sistema");
            }
        } catch (error) {
            console.error("Setup error:", error);
            toast.error("Ocurrió un error inesperado durante la configuración");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
                    >
                        Bienvenido a tu <span className="text-primary">Ecosistema POS</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-500 dark:text-slate-400"
                    >
                        Configura tu instancia en pocos pasos y comienza a vender.
                    </motion.p>
                </div>

                {/* Stepper Progress */}
                <div className="flex justify-between max-w-md mx-auto relative px-10">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10" />
                    {steps.map((step) => {
                        const Icon = step.icon;
                        const isActive = currentStep >= step.id;
                        const isCompleted = currentStep > step.id;

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-2">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${isActive ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-900 text-slate-400"
                                        }`}
                                >
                                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                                </div>
                                <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-slate-400"}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                            <CardHeader>
                                {currentStep === 1 && (
                                    <>
                                        <CardTitle className="text-2xl flex items-center gap-2">
                                            <ShieldCheck className="text-primary w-6 h-6" />
                                            Configuración de Usuarios
                                        </CardTitle>
                                        <CardDescription>
                                            Crea la cuenta del administrador principal y añade a tu equipo inicial.
                                        </CardDescription>
                                    </>
                                )}
                                {currentStep === 2 && (
                                    <>
                                        <CardTitle className="text-2xl flex items-center gap-2">
                                            <Zap className="text-primary w-6 h-6" />
                                            Elección de Plan
                                        </CardTitle>
                                        <CardDescription>
                                            Selecciona el plan que se adapte mejor a tu negocio.
                                        </CardDescription>
                                    </>
                                )}
                                {currentStep === 3 && (
                                    <>
                                        <CardTitle className="text-2xl flex items-center gap-2">
                                            <CheckCircle2 className="text-primary w-6 h-6" />
                                            Confirmación Final
                                        </CardTitle>
                                        <CardDescription>
                                            Revisa los detalles y lanza tu sistema POS.
                                        </CardDescription>
                                    </>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {currentStep === 1 && (
                                    <div className="space-y-6 py-2">
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <UserPlus className="w-5 h-5 text-primary" />
                                                Administrador Principal
                                            </h3>
                                            <div className="grid gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="name">Nombre Completo</Label>
                                                    <Input
                                                        id="name"
                                                        value={adminData.nombre}
                                                        onChange={(e) => setAdminData({ ...adminData, nombre: e.target.value })}
                                                        placeholder="Ej. Juan Pérez"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="email">Email Corporativo</Label>
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        value={adminData.email}
                                                        onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                                                        placeholder="admin@tuempresa.com"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="password">Contraseña</Label>
                                                        <Input
                                                            id="password"
                                                            type="password"
                                                            value={adminData.password}
                                                            onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="confirm">Confirmar</Label>
                                                        <Input
                                                            id="confirm"
                                                            type="password"
                                                            value={adminData.confirmPassword}
                                                            onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator className="my-6" />

                                        <div className="space-y-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <Users className="w-5 h-5 text-primary" />
                                                Equipo Inicial (Opcional)
                                            </h3>
                                            <div className="space-y-4">
                                                {staff.map((member, index) => (
                                                    <div key={index} className="flex gap-4 items-end animate-in fade-in slide-in-from-left-4">
                                                        <div className="grid gap-2 flex-1">
                                                            <Label>Nombre</Label>
                                                            <Input
                                                                value={member.nombre}
                                                                onChange={(e) => {
                                                                    const newStaff = [...staff];
                                                                    newStaff[index].nombre = e.target.value;
                                                                    setStaff(newStaff);
                                                                }}
                                                                placeholder="Nombre Empleado"
                                                            />
                                                        </div>
                                                        <div className="grid gap-2 flex-1">
                                                            <Label>Email</Label>
                                                            <Input
                                                                value={member.email}
                                                                onChange={(e) => {
                                                                    const newStaff = [...staff];
                                                                    newStaff[index].email = e.target.value;
                                                                    setStaff(newStaff);
                                                                }}
                                                                placeholder="email@empleado.com"
                                                            />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            onClick={() => setStaff(staff.filter((_, i) => i !== index))}
                                                        >
                                                            &times;
                                                        </Button>
                                                    </div>
                                                ))}
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-dashed"
                                                    onClick={() => setStaff([...staff, { nombre: "", email: "", rol: "EMPLEADO" }])}
                                                >
                                                    <UserPlus className="w-4 h-4 mr-2" />
                                                    Añadir otro empleado
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentStep === 2 && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-2">
                                        {SUBSCRIPTION_PLANS.map((plan) => (
                                            <div
                                                key={plan.id}
                                                onClick={() => setSelectedPlan(plan)}
                                                className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${selectedPlan.id === plan.id
                                                    ? "border-primary bg-primary/5 shadow-inner"
                                                    : "border-slate-200 dark:border-slate-800 hover:border-primary/50"
                                                    }`}
                                            >
                                                {plan.popular && (
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Star className="w-3 h-3 fill-current" />
                                                        POPULAR
                                                    </div>
                                                )}
                                                <h3 className="font-bold text-lg">{plan.nombre}</h3>
                                                <div className="mt-2 text-2xl font-black">
                                                    ${plan.precioARS.toLocaleString()}<span className="text-xs font-normal text-slate-500">/mes</span>
                                                </div>
                                                <ul className="mt-4 space-y-2">
                                                    {plan.features.slice(0, 4).map((f, i) => (
                                                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                            {f}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {currentStep === 3 && (
                                    <div className="space-y-6 py-2">
                                        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 space-y-4">
                                            <h3 className="text-xl font-bold flex items-center gap-2">
                                                <Zap className="w-5 h-5 text-primary" />
                                                Resumen de Configuración
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold">Administrador</p>
                                                    <p className="font-medium text-lg">{adminData.nombre}</p>
                                                    <p className="text-sm text-muted-foreground">{adminData.email}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold">Plan Seleccionado</p>
                                                    <p className="font-medium text-lg text-primary">{selectedPlan.nombre}</p>
                                                    <p className="text-sm text-muted-foreground">${selectedPlan.precioARS.toLocaleString()} / mes</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold">Equipo</p>
                                                    <p className="font-medium">{staff.filter(s => s.nombre && s.email).length} Empleados iniciales</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 flex gap-3">
                                            <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
                                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                                Al hacer clic en "Lanzar Sistema", se crearán las cuentas de usuario y se activará un periodo de prueba de 30 días del plan <strong>{selectedPlan.nombre}</strong>.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6 bg-slate-50/50 dark:bg-slate-900/50">
                                <Button
                                    variant="ghost"
                                    onClick={handleBack}
                                    disabled={currentStep === 1 || loading}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Atrás
                                </Button>

                                {currentStep < 3 ? (
                                    <Button onClick={handleNext}>
                                        Siguiente
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button
                                        className="bg-primary hover:bg-primary/90"
                                        onClick={handleSubmit}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <ShieldCheck className="w-4 h-4 mr-2" />
                                        )}
                                        Finalizar y Lanzar
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </motion.div>
                </AnimatePresence>

                {/* Footer Info */}
                <p className="text-center text-xs text-slate-500">
                    Al completar este proceso, aceptas los términos de servicio y la política de privacidad.
                    <br />Copyright © 2026 Admin Dashboard SaaS
                </p>
            </div>
        </div>
    );
}
