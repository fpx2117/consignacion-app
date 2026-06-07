"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Store, Search, Tag, Percent, ShoppingCart, Monitor, Star, Loader2,
    Image, Eye, DollarSign, Package, Grid, List, ChevronDown, CheckCircle2,
    Smartphone, MonitorSmartphone, PanelRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";
import type { StoreLayoutConfig } from "./types";

type LayoutTabProps = { config: StoreLayoutConfig; setConfig: React.Dispatch<React.SetStateAction<StoreLayoutConfig>> };

// ─── Helpers de UI ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
    return (
        <div className="flex items-center gap-2.5 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
            </div>
        </div>
    );
}

function ToggleCard({ icon: Icon, label, desc, checked, onChange, disabled }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; desc: string;
    checked: boolean; onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <div className={cn(
            "flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors",
            disabled && "opacity-50 pointer-events-none"
        )}>
            <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

function SelectCard({ icon: Icon, label, desc, value, onChange, options }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; desc: string;
    value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
            <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
            </div>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}

// ─── Editor de secciones destacadas ───
type FeaturedSection = { title: string; productIds: number[] };

function FeaturedSectionsEditor({ sections, onChange }: { sections: FeaturedSection[]; onChange: (s: FeaturedSection[]) => void }) {
    const [products, setProducts] = React.useState<Array<{ id: number; nombre: string }>>([]);
    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        if (loaded) return;
        fetch("/api/productos?sucursalId=0")
            .then(r => r.ok ? r.json() : [])
            .then((res: any) => {
                const list = Array.isArray(res) ? res : (res?.data || res?.productos || []);
                setProducts(list.map((p: any) => ({ id: p.id, nombre: p.nombre })));
                setLoaded(true);
            }).catch(() => setLoaded(true));
    }, [loaded]);

    const addSection = () => onChange([...sections, { title: "", productIds: [] }]);
    const removeSection = (idx: number) => onChange(sections.filter((_, i) => i !== idx));
    const updateSection = (idx: number, u: Partial<FeaturedSection>) => onChange(sections.map((s, i) => i === idx ? { ...s, ...u } : s));
    const toggleProduct = (sectionIdx: number, productId: number) => {
        const section = sections[sectionIdx];
        const has = section.productIds.includes(productId);
        updateSection(sectionIdx, { productIds: has ? section.productIds.filter(id => id !== productId) : [...section.productIds, productId] });
    };
    const total = sections.reduce((acc, s) => acc + s.productIds.length, 0);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-foreground">Secciones Destacadas</span>
                    {total > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 rounded-full">{total} prod.</Badge>}
                </div>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={addSection}>+ Sección</Button>
            </div>
            {sections.length === 0 && (
                <p className="text-xs text-muted-foreground py-3 text-center border rounded-xl border-dashed">
                    Agregá secciones como &ldquo;Perfumes&rdquo; o &ldquo;Ofertas&rdquo;
                </p>
            )}
            {sections.map((section, idx) => <SectionEditor key={idx} section={section} products={products} onUpdate={u => updateSection(idx, u)} onToggle={id => toggleProduct(idx, id)} onRemove={() => removeSection(idx)} />)}
        </div>
    );
}

function SectionEditor({ section, products, onUpdate, onToggle, onRemove }: {
    section: FeaturedSection; products: Array<{ id: number; nombre: string }>;
    onUpdate: (u: Partial<FeaturedSection>) => void; onToggle: (id: number) => void; onRemove: () => void;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const filtered = search.trim() ? products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase())) : products.slice(0, 50);

    return (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center gap-2 p-3">
                <button onClick={() => setExpanded(!expanded)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform", expanded && "rotate-180")} />
                    <Input value={section.title} onChange={e => onUpdate({ title: e.target.value })} placeholder="Nombre de la sección" className="h-7 text-sm border-0 bg-transparent px-1 focus-visible:ring-0 font-semibold flex-1" onClick={e => e.stopPropagation()} />
                </button>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 rounded-full flex-shrink-0">{section.productIds.length}</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 flex-shrink-0" onClick={onRemove}><X className="h-3.5 w-3.5" /></Button>
            </div>
            {expanded && (
                <div className="border-t border-border/50 px-3 pb-3 space-y-2">
                    <div className="relative pt-2"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-xs" /></div>
                    <div className="max-h-40 overflow-y-auto">
                        {filtered.map(p => {
                            const isSel = section.productIds.includes(p.id);
                            return (
                                <button key={p.id} onClick={() => onToggle(p.id)}
                                    className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors",
                                        isSel ? "bg-amber-50 text-amber-900 font-medium" : "hover:bg-muted/50"
                                    )}>
                                    <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all", isSel ? "bg-amber-500 border-amber-500" : "border-gray-300")}>
                                        {isSel && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                                    </div>
                                    <span className="truncate flex-1">{p.nombre}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────────

export function LayoutTab({ config, setConfig }: LayoutTabProps) {
    const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
    const isLive = config.convertirTienda;
    const catalogoHref = activeSucursalId ? `/lista?sucursalId=${activeSucursalId}` : "/lista";

    return (
        <div className="space-y-6">

            {/* ═══════════════════════════════════════════
                 1. TIENDA (ON/OFF + DISTRIBUCIÓN)
            ═══════════════════════════════════════════ */}
            <section>
                <SectionHeader icon={Store} title="Tienda" subtitle="Activación y tipo de catálogo" />
                <div className="space-y-2">
                    {/* Activar/Desactivar */}
                    <div className={cn(
                        "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                        isLive ? "border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-border/50 bg-card"
                    )}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                isLive ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                            )}>
                                <Store className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                    Catálogo Público
                                    {isLive && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" /></span>}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{isLive ? "Visible para todos" : "Solo visible para vos"}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" className="text-xs" asChild>
                                <a href={catalogoHref} target="_blank" rel="noopener noreferrer">Ver tienda</a>
                            </Button>
                            <Switch checked={isLive} onCheckedChange={(v) => setConfig({ ...config, convertirTienda: v })} />
                        </div>
                    </div>

                    {/* Buscador + Categorías + Consignación */}
                    <div className="flex flex-wrap gap-2">
                        <BadgeButton icon={Tag} label="Categorías" active={config.mostrarCategoriasEnHeader}
                            onClick={() => setConfig({ ...config, mostrarCategoriasEnHeader: !config.mostrarCategoriasEnHeader })} />
                        <BadgeButton icon={Percent} label="Precio Consig." active={config.mostrarPreciosConsignacion}
                            onClick={() => setConfig({ ...config, mostrarPreciosConsignacion: !config.mostrarPreciosConsignacion })} />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                 2. CATÁLOGO (VISIBILIDAD + LAYOUT)
            ═══════════════════════════════════════════ */}
            <section>
                <SectionHeader icon={Package} title="Catálogo de Productos" subtitle="Qué se ve en cada producto" />
                <div className="space-y-2">
                    <ToggleCard icon={Image} label="Imágenes" desc="Fotos de los productos" checked={config.showProductImages} onChange={(v) => setConfig({ ...config, showProductImages: v })} />
                    <ToggleCard icon={DollarSign} label="Precios" desc="Precio visible en cada tarjeta" checked={config.showPrices} onChange={(v) => setConfig({ ...config, showPrices: v })} />
                    <ToggleCard icon={Eye} label="Stock" desc="Cantidad disponible" checked={config.showStock} onChange={(v) => setConfig({ ...config, showStock: v })} />
                    <ToggleCard icon={Search} label='Botón "Ver todo"' desc="Link para ver más por categoría" checked={config.showViewAll} onChange={(v) => setConfig({ ...config, showViewAll: v })} />

                    <SelectCard icon={Grid} label="Layout de productos" desc="Cómo se ordenan las tarjetas"
                        value={config.productLayout}
                        onChange={(v) => setConfig({ ...config, productLayout: v as any })}
                        options={[
                            { value: "grid", label: "Grilla 2 cols" },
                            { value: "horizontal", label: "Carrusel horizontal" },
                            { value: "compact", label: "Listado compacto" },
                        ]} />

                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Tag className="h-4 w-4 text-muted-foreground" /></div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">Máximo por sección</p>
                                <p className="text-[11px] text-muted-foreground">Productos visibles por categoría</p>
                            </div>
                        </div>
                        <Input type="number" min={1} max={50} value={config.maxProductsPerSection}
                            onChange={(e) => setConfig({ ...config, maxProductsPerSection: Number(e.target.value) })}
                            className="w-20 h-8 text-center text-sm" />
                    </div>

                    <SelectCard icon={ShoppingCart} label="Botón agregar" desc="Posición del botón + en la tarjeta"
                        value={config.addButtonPosition}
                        onChange={(v) => setConfig({ ...config, addButtonPosition: v as any })}
                        options={[
                            { value: "floating", label: "Sobre la imagen" },
                            { value: "below", label: "Debajo del producto" },
                        ]} />
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                 3. CARRITO Y WHATSAPP
            ═══════════════════════════════════════════ */}
            <section>
                <SectionHeader icon={ShoppingCart} title="Carrito y WhatsApp" subtitle="Checkout del pedido" />
                <div className="space-y-2">
                    <SelectCard icon={Smartphone} label="Tipo de carrito" desc="Cómo se muestra en el teléfono"
                        value={config.cartDisplayMode}
                        onChange={(v) => setConfig({ ...config, cartDisplayMode: v as any })}
                        options={[
                            { value: "bottom-sheet", label: "Bottom sheet" },
                            { value: "modal", label: "Modal centrado" },
                            { value: "drawer", label: "Drawer lateral" },
                        ]} />

                    <ToggleCard icon={Eye} label="Preview de WhatsApp" desc="Simulación del mensaje en el carrito"
                        checked={config.showWhatsappPreview} onChange={(v) => setConfig({ ...config, showWhatsappPreview: v })} />

                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Tag className="h-4 w-4 text-muted-foreground" /></div>
                            <div className="min-w-0 flex-1 mr-3">
                                <p className="text-sm font-semibold text-foreground">Texto del botón final</p>
                                <p className="text-[11px] text-muted-foreground">Botón verde de envío</p>
                            </div>
                        </div>
                        <Input value={config.whatsappButtonText}
                            onChange={(e) => setConfig({ ...config, whatsappButtonText: e.target.value })}
                            className="h-8 text-sm w-44" />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════
                 4. PRODUCTOS DESTACADOS
            ═══════════════════════════════════════════ */}
            <FeaturedSectionsEditor
                sections={config.featuredSections || []}
                onChange={(sections) => setConfig({ ...config, featuredSections: sections })}
            />

            {/* ─── VISTA PREVIA RÁPIDA ─── */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-foreground">¿Cómo se ve?</p>
                    <p className="text-[11px] text-muted-foreground">Abrí la vista previa para ver los cambios</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs" asChild>
                    <a href={catalogoHref} target="_blank" rel="noopener noreferrer">Ver tienda en vivo →</a>
                </Button>
            </div>
        </div>
    );
}

// ─── Badge toggle (píldora) ────────────────────────────────────────────────────────

function BadgeButton({ icon: Icon, label, active, onClick }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string; active: boolean; onClick: () => void;
}) {
    return (
        <button onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border/50 hover:bg-accent"
            )}>
            <Icon className="h-3 w-3" />
            {label}
        </button>
    );
}
