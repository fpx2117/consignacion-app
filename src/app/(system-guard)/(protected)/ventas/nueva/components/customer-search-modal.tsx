"use client";

import * as React from "react";
import { Check, Phone, Search, UserCircle2, Users, Wallet } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Cliente } from "@/lib/types";

interface CustomerSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
  selectedClienteId: number | "";
  onSelectConsumidorFinal: () => void;
  onSelectCliente: (clienteId: number) => void;
}

export function CustomerSearchModal({
  open,
  onOpenChange,
  clientes,
  selectedClienteId,
  onSelectConsumidorFinal,
  onSelectCliente,
}: CustomerSearchModalProps) {
  const handleSelectConsumidor = () => {
    onSelectConsumidorFinal();
    onOpenChange(false);
  };

  const handleSelectCliente = (id: number) => {
    onSelectCliente(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 rounded-2xl border-border/60 shadow-2xl overflow-hidden w-[min(90vw,520px)] max-w-none sm:max-w-none"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar cliente</DialogTitle>
          <DialogDescription>
            Seleccioná un cliente registrado o continuá como Consumidor Final
          </DialogDescription>
        </DialogHeader>

        <Command
          filter={(value, search) => {
            if (value === "consumidor-final") {
              return search === ""
                ? 1
                : "consumidor final".includes(search.toLowerCase())
                  ? 1
                  : 0;
            }
            const cliente = clientes.find((c) => String(c.id) === value);
            if (!cliente) return 0;
            const q = search.toLowerCase();
            if (cliente.nombre.toLowerCase().includes(q)) return 1;
            if (cliente.telefono?.toLowerCase().includes(q)) return 1;
            return 0;
          }}
          className="bg-background w-full"
        >
          {/* ── Search input ─────────────────────────────────────────── */}
          <div className="flex items-center h-14 border-b border-border/60 bg-background">
            {/* Ícono izquierdo */}
            <div className="flex items-center justify-center w-14 h-full shrink-0 border-r border-border/40">
              <Users className="h-5 w-5 text-primary" />
            </div>

            {/* Wrapper flex-1 que contiene lupa + input */}
            <div className="flex-1 flex items-center gap-3 px-4 min-w-0 overflow-hidden">
              <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <CommandPrimitive.Input
                placeholder="Nombre o teléfono del cliente..."
                autoFocus
                className="w-full h-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none border-0"
              />
            </div>

            {/* Badge F7 — pegado al borde derecho */}
            <div className="hidden md:flex items-center gap-1.5 mr-4 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
              <kbd className="text-[11px] font-black font-mono text-primary tracking-tight">
                F7
              </kbd>
              <span className="text-[10px] text-primary/70 font-semibold">
                clientes
              </span>
            </div>
          </div>

          <CommandList className="max-h-[60vh] overflow-y-auto p-2">
            <CommandEmpty>
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <UserCircle2 className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">
                  No se encontró ningún cliente
                </p>
              </div>
            </CommandEmpty>

            {/* Consumidor Final — siempre primero */}
            <CommandGroup>
              <CommandItem
                value="consumidor-final"
                onSelect={handleSelectConsumidor}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer",
                  "data-[selected=true]:bg-primary/10",
                  selectedClienteId === "" && "bg-primary/5",
                )}
              >
                <div className="h-10 w-10 rounded-full bg-muted border border-border/50 flex items-center justify-center shrink-0">
                  <UserCircle2 className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">
                    Consumidor Final
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sin datos registrados
                  </p>
                </div>
                {selectedClienteId === "" && (
                  <Check
                    className="h-4 w-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                )}
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className="my-1" />

            {/* Clientes registrados */}
            <CommandGroup
              heading={
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 px-1">
                  Clientes registrados ({clientes.length})
                </span>
              }
            >
              {clientes.map((cliente) => {
                const isSelected = selectedClienteId === cliente.id;
                const saldo = Number(cliente.saldoCuenta ?? 0);
                const tieneSaldo = saldo > 0;

                return (
                  <CommandItem
                    key={cliente.id}
                    value={String(cliente.id)}
                    onSelect={() => handleSelectCliente(cliente.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer",
                      "data-[selected=true]:bg-primary/10",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    {/* Avatar con inicial */}
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted border-border/50 text-muted-foreground",
                      )}
                    >
                      {cliente.nombre.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-bold text-sm leading-tight truncate",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {cliente.nombre}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {cliente.telefono && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            <Phone className="h-2.5 w-2.5" />
                            {cliente.telefono}
                          </span>
                        )}
                        {tieneSaldo && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10 px-1.5 py-0 rounded-md">
                            <Wallet className="h-2.5 w-2.5" />
                            Saldo: ${saldo.toLocaleString("es-AR")}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        className="h-4 w-4 text-primary shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/10">
            <span className="text-[10px] text-muted-foreground font-medium">
              {clientes.length} clientes registrados
            </span>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center px-1 rounded border border-border bg-muted text-[9px] font-mono">
                  ↑↓
                </kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center px-1.5 rounded border border-border bg-muted text-[9px] font-mono">
                  ↵
                </kbd>
                seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center px-1.5 rounded border border-border bg-muted text-[9px] font-mono">
                  Esc
                </kbd>
                cerrar
              </span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
