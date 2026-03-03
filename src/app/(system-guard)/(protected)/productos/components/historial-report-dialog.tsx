/* eslint-disable */
// @ts-nocheck
import React from 'react';
import { Calendar, History, Loader2, X } from 'lucide-react'; 
import { toast } from 'sonner';
import { apiService } from '@/lib/apiService'; 
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogClose 
} from '@/components/ui/dialog'; 
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function HistoryReportDialog() {
  const [isPreparing, setIsPreparing] = React.useState(false);
  const [selectedMes, setSelectedMes] = React.useState(new Date().getMonth());
  const [selectedAnio, setSelectedAnio] = React.useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = React.useState<number[]>([]);
  const [isLoadingYears, setIsLoadingYears] = React.useState(true);

  const MESES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  React.useEffect(() => {
    let mounted = true;
    const fetchYears = async () => {
      setIsLoadingYears(true);
      try {
        const years = await apiService.getAvailableYears();
        if (mounted) {
          const sortedYears = years.sort((a, b) => b - a);
          setAvailableYears(sortedYears);
          if (sortedYears.length > 0 && !sortedYears.includes(selectedAnio)) {
            setSelectedAnio(sortedYears[0]);
          }
        }
      } catch (error) {
        console.error("Error cargando años", error);
        if (mounted) setAvailableYears([new Date().getFullYear()]);
      } finally {
        if (mounted) setIsLoadingYears(false);
      }
    };
    fetchYears();
    return () => { mounted = false; };
  }, []); 

  const handleGenerate = async () => {
    setIsPreparing(true);
    try {
      const shareUrl = await apiService.getHistorialPdfUrl(selectedMes, selectedAnio);
      window.open(shareUrl, '_blank');
      toast.success("Enlace de auditoría generado");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el reporte");
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="lg"
          className="h-12 rounded-2xl px-5 border-dashed border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-500/5 text-muted-foreground hover:text-indigo-600 dark:hover:bg-indigo-500/10 transition-all gap-2"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline font-bold text-xs uppercase tracking-tight">Auditoría</span>
        </Button>
      </DialogTrigger>
      
      {/* 1. `[&>button]:hidden`: Oculta cualquier botón que sea hijo DIRECTO (la X por defecto).
      */}
      <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden max-w-[420px] border-none shadow-2xl dark:bg-zinc-950 bg-white gap-0 [&>button]:hidden">
        
        {/* 2. Envolvemos nuestra X en un div absoluto. 
              Al estar dentro de un div, ya no es hijo directo del DialogContent, 
              por lo que NO se oculta con la regla de arriba.
        */}
        <div className="absolute right-5 top-5 z-50">
          <DialogClose className="rounded-full bg-white/10 p-2 hover:bg-white/20 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer flex items-center justify-center">
             <X className="h-4 w-4" />
             <span className="sr-only">Cerrar</span>
          </DialogClose>
        </div>

        {/* Header con gradiente */}
        <div className="bg-indigo-600 dark:bg-indigo-700 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Calendar className="h-24 w-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <History className="h-6 w-6 text-white stroke-[2.5px]" />
              </div>
              <DialogTitle className="font-black uppercase tracking-tighter text-2xl">
                Auditoría Mensual
              </DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 text-xs font-bold leading-relaxed opacity-90 uppercase tracking-widest">
              Seleccioná el periodo fiscal
            </DialogDescription>
          </div>
        </div>
        
        <div className="p-8 space-y-8 dark:bg-zinc-950">
          {/* Selector de Año */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase text-indigo-500 ml-1 tracking-[0.2em]">Año</span>
                {isLoadingYears && (
                    <span className="text-[9px] text-zinc-400 animate-pulse font-medium">Cargando...</span>
                )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {isLoadingYears ? (
                 [1, 2].map((_, i) => (
                    <div key={i} className="h-9 w-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
                 ))
              ) : (
                  availableYears.map(year => (
                    <button
                      key={year}
                      onClick={() => setSelectedAnio(year)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black transition-all border",
                        selectedAnio === year 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                          : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:border-indigo-300 hover:text-indigo-500"
                      )}
                    >
                      {year}
                    </button>
                  ))
              )}
            </div>
          </div>

          {/* Grid de Meses */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase text-indigo-500 ml-1 tracking-[0.2em]">Mes</span>
            <div className="grid grid-cols-4 gap-2">
              {MESES.map((name, index) => {
                const isSelected = selectedMes === index;
                const isFuture = new Date(selectedAnio, index) > new Date();
                
                return (
                  <button
                    key={name}
                    disabled={isFuture}
                    onClick={() => setSelectedMes(index)}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black uppercase transition-all border",
                      isFuture ? "opacity-20 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-300 border-transparent" :
                      isSelected 
                        ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 scale-105 shadow-sm" 
                        : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-8 bg-slate-50/50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex-col sm:flex-row gap-3">
          <DialogClose asChild>
            <Button variant="ghost" className="rounded-xl font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors h-12">
              Cerrar
            </Button>
          </DialogClose>
          
          <Button 
            onClick={(e) => {
              e.preventDefault(); 
              handleGenerate();
            }}
            disabled={isPreparing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl px-8 shadow-xl shadow-indigo-500/20 h-12 min-w-[160px] uppercase text-[10px] tracking-widest transition-all active:scale-95"
          >
            {isPreparing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando...</span>
              </div>
            ) : (
              <span>Descargar Reporte</span>
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

export default HistoryReportDialog;