import { Filter } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Categoria = {
  id: number;
  nombre: string;
};

type GastosFiltersProps = {
  filterEstado: string;
  filterCategoria: string;
  categorias: Categoria[];
  onEstadoChange: (value: string) => void;
  onCategoriaChange: (value: string) => void;
};

export function GastosFilters({
  filterEstado,
  filterCategoria,
  categorias,
  onEstadoChange,
  onCategoriaChange,
}: GastosFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card/50 backdrop-blur-sm p-3 rounded-2xl border border-border/50 shadow-sm mx-2 md:mx-0">
      <div className="flex items-center gap-2 px-3 sm:border-r border-border/50 sm:pr-4 py-1 sm:py-0">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">Filtros</span>
      </div>

      <div className="grid grid-cols-2 sm:flex items-center gap-2 flex-1">
        <Select value={filterEstado} onValueChange={onEstadoChange}>
          <SelectTrigger className="w-full sm:w-[160px] border-transparent bg-muted/30 rounded-xl h-11 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted/50 transition-all">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-2xl">
            <SelectItem value="all" className="font-medium">Todos los estados</SelectItem>
            <SelectItem value="PAGADO" className="font-medium text-emerald-600">Pagados</SelectItem>
            <SelectItem value="PENDIENTE" className="font-medium text-orange-600">Pendientes</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategoria} onValueChange={onCategoriaChange}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] border-transparent bg-muted/30 rounded-xl h-11 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted/50 transition-all">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-2xl">
            <SelectItem value="all" className="font-medium">Todas las categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)} className="font-medium">
                {cat.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
