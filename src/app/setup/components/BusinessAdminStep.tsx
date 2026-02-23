"use client";

import { motion } from "framer-motion";
import { UserPlus, Users, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface StaffMember {
    nombre: string;
    email: string;
    rol: string;
}

interface BusinessAdminStepProps {
    businessName: string;
    setBusinessName: (value: string) => void;
    adminData: { nombre: string; email: string; password: string; confirmPassword: string };
    setAdminData: (data: any) => void;
    staff: StaffMember[];
    setStaff: (data: StaffMember[]) => void;
}

export function BusinessAdminStep({
    businessName,
    setBusinessName,
    adminData,
    setAdminData,
    staff,
    setStaff
}: BusinessAdminStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
        >
            {/* Header */}
            <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-600/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-violet-600" />
                    </div>
                    Información Base
                </h2>
                <p className="text-muted-foreground text-sm font-medium">Configura los cimientos de tu ecosistema.</p>
            </div>

            <div className="space-y-8 p-6 rounded-[2rem] bg-card/40 backdrop-blur-xl border border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -z-10" />

                {/* Business Info */}
                <div className="space-y-4 relative z-10">
                    <Label htmlFor="businessName" className="text-xs font-bold uppercase tracking-widest text-foreground/80">Nombre de la Empresa</Label>
                    <Input
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Ej: Mega Store S.A."
                        className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all font-medium"
                    />
                </div>

                <div className="py-2">
                    <Separator className="bg-border/50" />
                </div>

                {/* Admin Info */}
                <div className="space-y-4 relative z-10">
                    <h3 className="text-sm font-black uppercase tracking-widest text-violet-600 flex items-center gap-2 mb-4">
                        <UserPlus className="w-4 h-4" /> Administrador Principal
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="adminName" className="text-xs font-bold text-foreground/80">Nombre Completo</Label>
                            <Input
                                id="adminName"
                                value={adminData.nombre}
                                onChange={(e) => setAdminData({ ...adminData, nombre: e.target.value })}
                                placeholder="Ej: Maria Gonzalez"
                                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500/50 focus:ring-violet-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adminEmail" className="text-xs font-bold text-foreground/80">Email Corporativo</Label>
                            <Input
                                id="adminEmail"
                                type="email"
                                value={adminData.email}
                                onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                                placeholder="maria@megastore.com"
                                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500/50 focus:ring-violet-500/20"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="adminPass" className="text-xs font-bold text-foreground/80">Contraseña</Label>
                            <Input
                                id="adminPass"
                                type="password"
                                value={adminData.password}
                                onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500/50 focus:ring-violet-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adminConfirm" className="text-xs font-bold text-foreground/80">Confirmar Contraseña</Label>
                            <Input
                                id="adminConfirm"
                                type="password"
                                value={adminData.confirmPassword}
                                onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500/50 focus:ring-violet-500/20"
                            />
                        </div>
                    </div>
                </div>

                <div className="py-2">
                    <Separator className="bg-border/50" />
                </div>

                {/* Team Info */}
                <div className="space-y-4 relative z-10">
                    <h3 className="text-sm font-black uppercase tracking-widest text-violet-600 flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4" /> Equipo Inicial <span className="text-muted-foreground font-medium normal-case text-xs opacity-60 ml-2">(Opcional)</span>
                    </h3>

                    <div className="space-y-4">
                        {staff.map((member, index) => (
                            <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end p-4 rounded-xl bg-background/30 border border-border/30">
                                <div className="space-y-2 flex-1 w-full">
                                    <Label className="text-xs font-bold text-foreground/80">Nombre</Label>
                                    <Input
                                        value={member.nombre}
                                        onChange={(e) => {
                                            const newStaff = [...staff];
                                            newStaff[index].nombre = e.target.value;
                                            setStaff(newStaff);
                                        }}
                                        className="h-10 rounded-lg bg-background/80"
                                        placeholder="Empleado"
                                    />
                                </div>
                                <div className="space-y-2 flex-1 w-full">
                                    <Label className="text-xs font-bold text-foreground/80">Email</Label>
                                    <Input
                                        value={member.email}
                                        onChange={(e) => {
                                            const newStaff = [...staff];
                                            newStaff[index].email = e.target.value;
                                            setStaff(newStaff);
                                        }}
                                        className="h-10 rounded-lg bg-background/80"
                                        placeholder="email@empleado.com"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg sm:shrink-0"
                                    onClick={() => setStaff(staff.filter((_, i) => i !== index))}
                                >
                                    &times;
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => setStaff([...staff, { nombre: "", email: "", rol: "EMPLEADO" }])}
                        className="w-full h-12 rounded-xl border-dashed border-2 hover:border-violet-500/50 hover:bg-violet-500/5 text-violet-600 font-bold tracking-wide"
                    >
                        <UserPlus className="w-4 h-4 mr-2" /> Añadir Miembro al Equipo
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

