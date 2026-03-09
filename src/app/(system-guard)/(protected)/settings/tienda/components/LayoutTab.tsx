/* eslint-disable */
// @ts-nocheck
import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Rows3, Store, Search, Tag, Percent, ExternalLink, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── SVG Mockups ─── */

function GridMockup({ active }: { active?: boolean }) {
    return (
        <svg viewBox="0 0 120 80" className="w-full h-full" aria-hidden>
            {/* Search bar */}
            <rect x="8" y="4" width="104" height="8" rx="4" fill="currentColor" opacity={active ? 0.18 : 0.1} />
            <circle cx="14" cy="8" r="2" fill="currentColor" opacity={active ? 0.3 : 0.15} />

            {/* Category pills */}
            <rect x="8" y="16" width="20" height="5" rx="2.5" fill="currentColor" opacity={active ? 0.22 : 0.1} />
            <rect x="31" y="16" width="16" height="5" rx="2.5" fill="currentColor" opacity={active ? 0.14 : 0.07} />
            <rect x="50" y="16" width="18" height="5" rx="2.5" fill="currentColor" opacity={active ? 0.14 : 0.07} />

            {/* Product cards — 2x2 grid */}
            {[
                [8, 26], [64, 26],
                [8, 54], [64, 54],
            ].map(([x, y], i) => (
                <g key={i}>
                    <rect x={x} y={y} width="48" height="24" rx="3" fill="currentColor" opacity={active ? 0.08 : 0.05} />
                    {/* Image */}
                    <rect x={x + 3} y={y + 3} width="42" height="11" rx="2" fill="currentColor" opacity={active ? 0.15 : 0.08} />
                    {/* Title */}
                    <rect x={x + 3} y={y + 17} width="24" height="2.5" rx="1" fill="currentColor" opacity={active ? 0.2 : 0.1} />
                    {/* Price */}
                    <rect x={x + 3} y={y + 21} width="14" height="2" rx="1" fill="currentColor" opacity={active ? 0.12 : 0.06} />
                </g>
            ))}
        </svg>
    );
}

function ListMockup({ active }: { active?: boolean }) {
    return (
        <svg viewBox="0 0 120 80" className="w-full h-full" aria-hidden>
            {/* Search bar */}
            <rect x="8" y="4" width="104" height="8" rx="4" fill="currentColor" opacity={active ? 0.18 : 0.1} />
            <circle cx="14" cy="8" r="2" fill="currentColor" opacity={active ? 0.3 : 0.15} />

            {/* Category pills */}
            <rect x="8" y="16" width="20" height="5" rx="2.5" fill="currentColor" opacity={active ? 0.22 : 0.1} />
            <rect x="31" y="16" width="16" height="5" rx="2.5" fill="currentColor" opacity={active ? 0.14 : 0.07} />
            <rect x="50" y="16" width="18" height="5" rx="2.5" fill="currentColor" opacity={active ? 0.14 : 0.07} />

            {/* Product rows — 3 items */}
            {[26, 44, 62].map((y, i) => (
                <g key={i}>
                    <rect x="8" y={y} width="104" height="14" rx="3" fill="currentColor" opacity={active ? 0.06 : 0.04} />
                    {/* Thumbnail */}
                    <rect x="11" y={y + 2} width="18" height="10" rx="2" fill="currentColor" opacity={active ? 0.18 : 0.09} />
                    {/* Title */}
                    <rect x="33" y={y + 3} width="32" height="2.5" rx="1" fill="currentColor" opacity={active ? 0.2 : 0.1} />
                    {/* Subtitle */}
                    <rect x="33" y={y + 7.5} width="20" height="2" rx="1" fill="currentColor" opacity={active ? 0.1 : 0.06} />
                    {/* Price */}
                    <rect x="90" y={y + 5} width="16" height="3" rx="1" fill="currentColor" opacity={active ? 0.15 : 0.08} />
                </g>
            ))}
        </svg>
    );
}

/* ─── Main Component ─── */

export function LayoutTab({ config, setConfig }: any) {
    const isLive = config.convertirTienda;

    return (
        <div className={cn(
            "space-y-4 transition-opacity duration-500",
        )}>
            {/* ── HERO: CATÁLOGO PÚBLICO ── */}
            <section className={cn(
                "relative rounded-2xl border-2 overflow-hidden transition-all duration-500",
                isLive
                    ? "border-emerald-400/60 dark:border-emerald-500/40 bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-background dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-background"
                    : "border-border bg-muted/30"
            )}>
                {/* Glow effect when live */}
                {isLive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/5 via-transparent to-emerald-400/5 pointer-events-none" />
                )}

                <div className="relative p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className={cn(
                            "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500",
                            isLive
                                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                                : "bg-muted text-muted-foreground"
                        )}>
                            <Store className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                                <Label className="text-sm font-black">Catálogo Público</Label>
                                {isLive ? (
                                    <span className="flex items-center gap-1">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">En línea</span>
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold text-muted-foreground/60">Offline</span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {isLive
                                    ? "Tu catálogo es visible públicamente"
                                    : "Solo tú podés ver la tienda"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {isLive && (
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="rounded-lg text-xs font-bold h-8 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hidden sm:flex"
                            >
                                <a href="/lista" target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                    Ver tienda
                                </a>
                            </Button>
                        )}
                        <Switch
                            checked={isLive}
                            onCheckedChange={(checked) => setConfig({ ...config, convertirTienda: checked })}
                            className={cn(
                                "scale-110 origin-center",
                                isLive && "data-[state=checked]:bg-emerald-500"
                            )}
                        />
                    </div>
                </div>
            </section>

            {/* ── DISTRIBUCIÓN DE PRODUCTOS ── */}
            <section className={cn(
                "rounded-2xl border overflow-hidden transition-all duration-300",
                isLive ? "border-border bg-background" : "border-border/60 bg-muted/20"
            )}>
                <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
                    <LayoutGrid className={cn("h-3.5 w-3.5 transition-colors", isLive ? "text-primary" : "text-muted-foreground")} />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Distribución</h3>
                </div>

                <div className={cn(
                    "p-4 grid grid-cols-2 gap-3 transition-opacity duration-300",
                    !isLive && "opacity-50 pointer-events-none"
                )}>
                    {/* Grid option */}
                    <button
                        onClick={() => setConfig({ ...config, tiendaLayout: 'grid' })}
                        className={cn(
                            "relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group active:scale-[0.97]",
                            config.tiendaLayout === 'grid'
                                ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20"
                                : "border-border hover:border-primary/30 hover:shadow-sm"
                        )}
                    >
                        {config.tiendaLayout === 'grid' && (
                            <div className="absolute top-2.5 right-2.5">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                            </div>
                        )}
                        <div className={cn(
                            "w-full h-20 rounded-lg overflow-hidden transition-colors duration-200",
                            config.tiendaLayout === 'grid' ? "text-primary" : "text-muted-foreground group-hover:text-foreground/50"
                        )}>
                            <GridMockup active={config.tiendaLayout === 'grid'} />
                        </div>
                        <div className="text-center">
                            <div className="flex items-center gap-1.5 justify-center">
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span className="text-xs font-black">Mosaico</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">2 columnas</p>
                        </div>
                    </button>

                    {/* List option */}
                    <button
                        onClick={() => setConfig({ ...config, tiendaLayout: 'list' })}
                        className={cn(
                            "relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group active:scale-[0.97]",
                            config.tiendaLayout === 'list'
                                ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20"
                                : "border-border hover:border-primary/30 hover:shadow-sm"
                        )}
                    >
                        {config.tiendaLayout === 'list' && (
                            <div className="absolute top-2.5 right-2.5">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                            </div>
                        )}
                        <div className={cn(
                            "w-full h-20 rounded-lg overflow-hidden transition-colors duration-200",
                            config.tiendaLayout === 'list' ? "text-primary" : "text-muted-foreground group-hover:text-foreground/50"
                        )}>
                            <ListMockup active={config.tiendaLayout === 'list'} />
                        </div>
                        <div className="text-center">
                            <div className="flex items-center gap-1.5 justify-center">
                                <Rows3 className="h-3.5 w-3.5" />
                                <span className="text-xs font-black">Lista</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">1 columna</p>
                        </div>
                    </button>
                </div>
            </section>

            {/* ── ELEMENTOS VISIBLES ── */}
            <section className={cn(
                "rounded-2xl border overflow-hidden transition-all duration-300",
                isLive ? "border-border bg-background" : "border-border/60 bg-muted/20"
            )}>
                <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
                    <Tag className={cn("h-3.5 w-3.5 transition-colors", isLive ? "text-primary" : "text-muted-foreground")} />
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Elementos</h3>
                </div>

                <div className={cn(
                    "divide-y divide-border/40 transition-opacity duration-300",
                    !isLive && "opacity-50 pointer-events-none"
                )}>
                    {/* Buscador */}
                    <div className="flex items-center justify-between px-5 py-3.5 group">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                                config.mostrarBuscador
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground/40"
                            )}>
                                <Search className="h-4 w-4" />
                            </div>
                            <div>
                                <Label className={cn(
                                    "text-sm font-bold cursor-pointer transition-colors",
                                    !config.mostrarBuscador && "text-muted-foreground"
                                )}>Barra de Búsqueda</Label>
                                <p className="text-[11px] text-muted-foreground/70">Buscar productos rápidamente</p>
                            </div>
                        </div>
                        <Switch
                            checked={config.mostrarBuscador}
                            onCheckedChange={(checked) => setConfig({ ...config, mostrarBuscador: checked })}
                        />
                    </div>

                    {/* Categorías */}
                    <div className="flex items-center justify-between px-5 py-3.5 group">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                                config.mostrarCategoriasEnHeader
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground/40"
                            )}>
                                <Tag className="h-4 w-4" />
                            </div>
                            <div>
                                <Label className={cn(
                                    "text-sm font-bold cursor-pointer transition-colors",
                                    !config.mostrarCategoriasEnHeader && "text-muted-foreground"
                                )}>Filtro de Categorías</Label>
                                <p className="text-[11px] text-muted-foreground/70">Chips de filtrado rápido</p>
                            </div>
                        </div>
                        <Switch
                            checked={config.mostrarCategoriasEnHeader}
                            onCheckedChange={(checked) => setConfig({ ...config, mostrarCategoriasEnHeader: checked })}
                        />
                    </div>

                    {/* Precios consignación */}
                    <div className="flex items-center justify-between px-5 py-3.5 group">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                                config.mostrarPreciosConsignacion
                                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                                    : "bg-muted text-muted-foreground/40"
                            )}>
                                <Percent className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Label className={cn(
                                        "text-sm font-bold cursor-pointer transition-colors",
                                        !config.mostrarPreciosConsignacion && "text-muted-foreground"
                                    )}>Costo de Consignación</Label>
                                    {config.mostrarPreciosConsignacion && (
                                        <Badge variant="secondary" className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-none h-4 px-1.5 rounded-md font-bold">Público</Badge>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground/70">Comisiones visibles a todos</p>
                            </div>
                        </div>
                        <Switch
                            checked={config.mostrarPreciosConsignacion}
                            onCheckedChange={(checked) => setConfig({ ...config, mostrarPreciosConsignacion: checked })}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}
