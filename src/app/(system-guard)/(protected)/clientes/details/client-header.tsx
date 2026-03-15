"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import type { Cliente } from "@/lib/types";

// Helpers
const formatCurrency = (val: number) => 
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(val);

const getInitials = (name: string) => 
  name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

export function ClientProfileHeader({ cliente }: { cliente: Cliente }) {
  const whatsappLink = cliente.telefono 
    ? `https://wa.me/${cliente.telefono.replace(/\D/g, '')}`
    : null;

  return (
    <Card className="group overflow-hidden border-border/60 bg-card shadow-sm relative">
      {/* Banner */}
      <div className="h-24 md:h-32 bg-gradient-to-r from-[color:var(--primary)]/20 via-primary/10 to-background" />
      
      <div className="px-4 md:px-8 pb-6 relative">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-end -mt-10 md:-mt-12">
            
            {/* AVATAR */}
            <div className="relative shrink-0">
                <Avatar className="h-20 w-20 md:h-28 md:w-28 border-[4px] border-card shadow-lg text-2xl md:text-4xl">
                    <AvatarFallback className="bg-primary text-primary-foreground font-black tracking-tight">
                        {getInitials(cliente.nombre)}
                    </AvatarFallback>
                </Avatar>
                {/* Indicador estado (Visible solo desktop) */}
                <div className={`hidden md:block absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-card ${cliente.activo ? 'bg-[color:var(--status-success-strong)]' : 'bg-destructive'}`} />
            </div>

            {/* DATOS PRINCIPALES */}
            <div className="flex-1 space-y-3 pb-1 text-center md:text-left w-full">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-none">
                        {cliente.nombre}
                    </h1>
                   
                </div>
                
                {/* Botones de Contacto / Dirección */}
                <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
                     
                     {/* BOTÓN WHATSAPP RESPONSIVE */}
                     {whatsappLink && (
                        <Button 
                            asChild 
                            variant="outline" 
                            className="w-full md:w-auto gap-2 border-[color:var(--status-success-strong)]/30 text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/5 hover:bg-[color:var(--status-success-strong)]/15 h-9"
                        >
                           <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-4 w-4" />
                              <span className="font-mono">{cliente.telefono}</span>
                           </a>
                        </Button>
                     )}
                     
                     {cliente.direccion && (
                        <Badge variant="secondary" className="font-normal gap-1.5 py-1.5 px-3 w-full md:w-auto justify-center md:justify-start">
                            <MapPin className="h-3.5 w-3.5 opacity-70" /> {cliente.direccion}
                        </Badge>
                     )}
                </div>
            </div>

            {/* SECCIÓN DE SALDO */}
            <div className="flex flex-col items-center md:items-end gap-1 p-4 w-full md:w-auto bg-muted/30 rounded-xl md:bg-transparent md:p-0">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saldo Actual</span>
                <div className={`text-3xl md:text-4xl font-black tabular-nums tracking-tighter ${cliente.saldoCuenta > 0 ? 'text-primary' : 'text-foreground'}`}>
                    {formatCurrency(cliente.saldoCuenta)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                     <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cliente.activo ? 'border-[color:var(--status-success-strong)]/20 bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>
                        {cliente.activo ? (
                            <><CheckCircle2 className="h-3 w-3" /> Activa</>
                        ) : (
                            <><AlertCircle className="h-3 w-3" /> Inactiva</>
                        )}
                     </span>
                </div>
            </div>
        </div>
      </div>
    </Card>
  );
}