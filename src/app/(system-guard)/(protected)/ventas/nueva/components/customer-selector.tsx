import { Check, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";

type CustomerSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClienteId: number | "";
  clientesFiltrados: Cliente[];
  isClienteRegistrado: boolean;
  selectedLabel: string;
  onSelectConsumidorFinal: () => void;
  onSelectCliente: (clienteId: number) => void;
};

export function CustomerSelector({
  open,
  onOpenChange,
  selectedClienteId,
  clientesFiltrados,
  isClienteRegistrado,
  selectedLabel,
  onSelectConsumidorFinal,
  onSelectCliente,
}: CustomerSelectorProps) {
  return (
    <div className="w-[115px] sm:w-1/3 min-w-[115px]">
      <label htmlFor="selector-cliente" className="sr-only">
        Seleccionar cliente
      </label>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="selector-cliente"
            variant="outline"
            role="combobox"
            type="button"
            aria-label="Seleccionar cliente"
            className={cn(
              "w-full justify-between h-10 text-[11px] sm:text-xs px-2 truncate rounded-xl transition-all focus-visible:ring-2",
              isClienteRegistrado && "border-indigo-400 bg-indigo-50 text-indigo-600 font-bold",
            )}
          >
            <span className="truncate">{selectedClienteId === "" ? "Cons. Final" : selectedLabel}</span>
            <UserCircle2 className="ml-1 h-3.5 w-3.5 opacity-50 shrink-0" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[85vw] sm:w-[320px] p-0 rounded-xl" align="start">
          <Command>
            <CommandInput placeholder="Buscar cliente..." className="h-10" />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No se encontro el cliente.</CommandEmpty>
              <CommandGroup heading="Opciones">
                <CommandItem value="consumidor final" onSelect={onSelectConsumidorFinal} className="cursor-pointer">
                  <UserCircle2 className="mr-2 h-4 w-4 opacity-70" aria-hidden="true" />
                  <span className="font-medium">Consumidor Final</span>
                  {selectedClienteId === "" && <Check className="ml-auto h-4 w-4 text-primary" aria-hidden="true" />}
                </CommandItem>
              </CommandGroup>
              <Separator />
              <CommandGroup heading="Clientes Registrados">
                {clientesFiltrados.map((cliente) => (
                  <CommandItem
                    key={cliente.id}
                    value={cliente.nombre}
                    onSelect={() => onSelectCliente(cliente.id)}
                    className="cursor-pointer"
                  >
                    <span className={cn("text-sm truncate", selectedClienteId === cliente.id && "font-bold text-primary")}>
                      {cliente.nombre}
                    </span>
                    {selectedClienteId === cliente.id && (
                      <Check className="ml-auto h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
