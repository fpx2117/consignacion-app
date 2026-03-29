import { Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

import { gastosTypography } from "./gastos-typography";

type GastosHeaderProps = {
  onOpenCategories: () => void;
  onOpenNew: () => void;
};

export function GastosHeader({ onOpenCategories, onOpenNew }: GastosHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 md:px-0">
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className={gastosTypography.eyebrow}>Finanzas del negocio</span>
        </div>
        <h1 className={gastosTypography.heading}>
          Gestion de <span className="text-primary">Gastos</span>
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
        <Button
          variant="outline"
          onClick={onOpenCategories}
          className="w-full sm:w-auto rounded-2xl h-12 md:h-14 font-bold text-[10px] sm:text-xs uppercase tracking-normal sm:tracking-widest border-primary/20 hover:bg-primary/5 transition-all"
        >
          Categorias
        </Button>
        <Button
          onClick={onOpenNew}
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl h-12 md:h-14 font-bold text-[10px] sm:text-xs uppercase tracking-normal sm:tracking-widest gap-2 shadow-xl shadow-primary/20 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4 shrink-0" /> Nuevo Gasto
        </Button>
      </div>
    </div>
  );
}
