"use client";

import { motion } from "framer-motion";
import { Users, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface StaffMember {
    nombre: string;
    email: string;
    rol: string;
    password?: string;
}

interface TeamStepProps {
    staff: StaffMember[];
    setStaff: (data: StaffMember[]) => void;
    onNext: () => void;
}

export function TeamStep({ staff, setStaff, onNext }: TeamStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl mx-auto space-y-10"
        >
            <div className="space-y-4 text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 rounded-2xl bg-fuchsia-600/10 border border-fuchsia-500/20 flex items-center justify-center mx-auto mb-6"
                >
                    <Users className="w-8 h-8 text-fuchsia-500" />
                </motion.div>
                <h2 className="text-3xl font-black tracking-tight">Tu Equipo Inicial</h2>
                <p className="text-muted-foreground text-lg">
                    Añade a las personas que trabajarán contigo. <br /> <span className="opacity-70 text-sm">(Puedes omitir este paso y hacerlo más tarde)</span>
                </p>
            </div>

            <div className="space-y-4">
                {staff.map((member, index) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={index}
                        className="flex flex-col sm:flex-row gap-4 items-start sm:items-end p-6 rounded-3xl bg-card/40 backdrop-blur-md border border-border/50 shadow-lg relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-fuchsia-500/5 blur-3xl -z-10 rounded-full" />

                        <div className="space-y-2 flex-1 w-full">
                            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">Nombre</Label>
                            <Input
                                value={member.nombre}
                                onChange={(e) => {
                                    const newStaff = [...staff];
                                    newStaff[index].nombre = e.target.value;
                                    setStaff(newStaff);
                                }}
                                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10"
                                placeholder="Empleado"
                            />
                        </div>
                        <div className="space-y-2 flex-1 w-full">
                            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">Email</Label>
                            <Input
                                value={member.email}
                                onChange={(e) => {
                                    const newStaff = [...staff];
                                    newStaff[index].email = e.target.value;
                                    setStaff(newStaff);
                                }}
                                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10"
                                placeholder="email@empleado.com"
                            />
                        </div>
                        <div className="space-y-2 flex-1 w-full">
                            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">Contraseña</Label>
                            <Input
                                type="text"
                                value={member.password || ""}
                                onChange={(e) => {
                                    const newStaff = [...staff];
                                    newStaff[index].password = e.target.value;
                                    setStaff(newStaff);
                                }}
                                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10"
                                placeholder="(Opcional)"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl sm:shrink-0"
                            onClick={() => setStaff(staff.filter((_, i) => i !== index))}
                        >
                            &times;
                        </Button>
                    </motion.div>
                ))}

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                        variant="outline"
                        onClick={() => setStaff([...staff, { nombre: "", email: "", rol: "EMPLEADO", password: "" }])}
                        className="w-full h-16 rounded-3xl border-dashed border-2 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 text-fuchsia-600 font-bold tracking-wide"
                    >
                        <UserPlus className="w-5 h-5 mr-3" /> Añadir Nuevo Miembro
                    </Button>
                </motion.div>
            </div>

            <div className="flex justify-center pt-8">
                <Button
                    onClick={onNext}
                    variant="ghost"
                    className="text-xs font-bold uppercase tracking-widest hover:bg-transparent hover:text-fuchsia-500"
                >
                    Continuar a Elección de Plan &rarr;
                </Button>
            </div>
        </motion.div>
    );
}
