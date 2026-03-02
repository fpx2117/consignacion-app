import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Rows3, Store, Search, Tag, Percent, ExternalLink, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Mini SVG mockups para los layouts
function GridMockup() {
    return (
        <svg viewBox="0 0 60 44" className="w-full h-full" aria-hidden>
            {/* Header bar */}
            <rect x="2" y="2" width="56" height="6" rx="2" fill="currentColor" opacity="0.2" />
            {/* Grid cards — 2 columns */}
            <rect x="2" y="12" width="26" height="14" rx="2" fill="currentColor" opacity="0.15" />
            <rect x="32" y="12" width="26" height="14" rx="2" fill="currentColor" opacity="0.15" />
            <rect x="2" y="30" width="26" height="14" rx="2" fill="currentColor" opacity="0.15" />
            <rect x="32" y="30" width="26" height="14" rx="2" fill="currentColor" opacity="0.15" />
            {/* Image placeholders */}
            <rect x="4" y="14" width="22" height="8" rx="1" fill="currentColor" opacity="0.25" />
            <rect x="34" y="14" width="22" height="8" rx="1" fill="currentColor" opacity="0.25" />
            <rect x="4" y="32" width="22" height="8" rx="1" fill="currentColor" opacity="0.25" />
            <rect x="34" y="32" width="22" height="8" rx="1" fill="currentColor" opacity="0.25" />
        </svg>
    );
}

function ListMockup() {
    return (
        <svg viewBox="0 0 60 44" className="w-full h-full" aria-hidden>
            {/* Header bar */}
            <rect x="2" y="2" width="56" height="6" rx="2" fill="currentColor" opacity="0.2" />
            {/* List items — 1 column with image + text */}
            {[12, 22, 32].map((y) => (
                <g key={y}>
                    <rect x="2" y={y} width="58" height="9" rx="2" fill="currentColor" opacity="0.1" />
                    <rect x="4" y={y + 1.5} width="14" height="6" rx="1" fill="currentColor" opacity="0.3" />
                    <rect x="21" y={y + 2} width="20" height="2" rx="1" fill="currentColor" opacity="0.2" />
                    <rect x="21" y={y + 5} width="12" height="1.5" rx="0.5" fill="currentColor" opacity="0.15" />
                </g>
            ))}
        </svg>
    );
}

export function LayoutTab({ config, setConfig }: any) {
    return (
        <div className="space-y-5">
            {/* ── ACTIVAR TIENDA ── */}
            <section className={cn(
                "rounded-2xl border-2 overflow-hidden transition-all duration-300",
                config.convertirTienda
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20"
                    : "border-border bg-background"
            )}>
                <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                            config.convertirTienda
                                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                        )}>
                            <Store className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Label className="text-sm font-black">Catálogo Público</Label>
                                {config.convertirTienda ? (
                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[10px] font-bold h-4 px-2">● En línea</Badge>
                                ) : (
                                    <Badge variant="secondary" className="rounded-full text-[10px] font-bold h-4 px-2">Offline</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {config.convertirTienda
                                    ? "Tus clientes pueden ver tu catálogo públicamente."
                                    : "La tienda está oculta. Solo tú puedes verla."}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {config.convertirTienda && (
                            <Button asChild variant="outline" size="sm" className="rounded-lg text-xs font-bold h-8 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hidden sm:flex">
                                <a href="/lista" target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                    Ver tienda
                                </a>
                            </Button>
                        )}
                        <Switch
                            checked={config.convertirTienda}
                            onCheckedChange={(checked) => setConfig({ ...config, convertirTienda: checked })}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    </div>
                </div>
            </section>

            {/* ── DISTRIBUCIÓN ── */}
            <section className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Distribución de Productos</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                    {/* Grid option */}
                    <button
                        onClick={() => setConfig({ ...config, tiendaLayout: 'grid' })}
                        className={cn(
                            "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer group",
                            config.tiendaLayout === 'grid'
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                        )}
                    >
                        {config.tiendaLayout === 'grid' && (
                            <div className="absolute top-2 right-2">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                            </div>
                        )}
                        <div className={cn(
                            "w-full h-16 rounded-lg overflow-hidden transition-colors",
                            config.tiendaLayout === 'grid' ? "text-primary" : "text-muted-foreground"
                        )}>
                            <GridMockup />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 justify-center">
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span className="text-xs font-black">Mosaico</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center mt-0.5">2 columnas · Ideal para móvil</p>
                        </div>
                    </button>

                    {/* List option */}
                    <button
                        onClick={() => setConfig({ ...config, tiendaLayout: 'list' })}
                        className={cn(
                            "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer group",
                            config.tiendaLayout === 'list'
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                        )}
                    >
                        {config.tiendaLayout === 'list' && (
                            <div className="absolute top-2 right-2">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                            </div>
                        )}
                        <div className={cn(
                            "w-full h-16 rounded-lg overflow-hidden transition-colors",
                            config.tiendaLayout === 'list' ? "text-primary" : "text-muted-foreground"
                        )}>
                            <ListMockup />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 justify-center">
                                <Rows3 className="h-3.5 w-3.5" />
                                <span className="text-xs font-black">Lista</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center mt-0.5">1 columna · Más detalle</p>
                        </div>
                    </button>
                </div>
            </section>

            {/* ── ELEMENTOS VISIBLES ── */}
            <section className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Elementos Visibles</h3>
                </div>

                <div className="divide-y divide-border/50">
                    {/* Buscador */}
                    <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                config.mostrarBuscador ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                <Search className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-bold cursor-pointer">Barra de Búsqueda</Label>
                                    <Badge variant="secondary" className="text-[9px] uppercase tracking-wider bg-primary/10 text-primary border-none font-bold h-4 px-1.5 rounded-md">Nuevo</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">Caja de búsqueda en el inicio de la tienda</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                                "text-[10px] font-bold",
                                config.mostrarBuscador ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
                            )}>
                                {config.mostrarBuscador ? "Visible" : "Oculto"}
                            </span>
                            <Switch
                                checked={config.mostrarBuscador}
                                onCheckedChange={(checked) => setConfig({ ...config, mostrarBuscador: checked })}
                            />
                        </div>
                    </div>

                    {/* Categorías */}
                    <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                config.mostrarCategoriasEnHeader ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                <Tag className="h-4 w-4" />
                            </div>
                            <div>
                                <Label className="text-sm font-bold cursor-pointer">Filtro de Categorías</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">Chips rápidos arriba de los productos</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={cn(
                                "text-[10px] font-bold",
                                config.mostrarCategoriasEnHeader ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
                            )}>
                                {config.mostrarCategoriasEnHeader ? "Visible" : "Oculto"}
                            </span>
                            <Switch
                                checked={config.mostrarCategoriasEnHeader}
                                onCheckedChange={(checked) => setConfig({ ...config, mostrarCategoriasEnHeader: checked })}
                            />
                        </div>
                    </div>

                    {/* Precios consignación */}
                    <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                config.mostrarPreciosConsignacion ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-muted text-muted-foreground"
                            )}>
                                <Percent className="h-4 w-4" />
                            </div>
                            <div>
                                <Label className="text-sm font-bold cursor-pointer">Costo de Consignación</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">Muestra comisiones a proveedores en público</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {config.mostrarPreciosConsignacion && (
                                <Badge variant="secondary" className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-none h-4 px-1.5 rounded-md font-bold">⚠ Público</Badge>
                            )}
                            <Switch
                                checked={config.mostrarPreciosConsignacion}
                                onCheckedChange={(checked) => setConfig({ ...config, mostrarPreciosConsignacion: checked })}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
