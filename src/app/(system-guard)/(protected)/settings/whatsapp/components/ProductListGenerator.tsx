"use client";

import * as React from "react";
import { List, RefreshCw, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";

interface ProductListGeneratorProps {
    value: string;
    onChange: (val: string) => void;
}

export function ProductListGenerator({ value, onChange }: ProductListGeneratorProps) {
    const [fetching, setFetching] = React.useState(false);

    const generateProductListText = async () => {
        setFetching(true);
        try {
            const products = await apiService.getProductos() || [];
            const branding = await apiService.getBranding();

            // Filter products with stock
            const availableProducts = products.filter((p: any) => p.stockDisponibleUnits > 0);

            // Group by Category -> Subcategory
            const grouped: any = {};
            availableProducts.forEach((p: any) => {
                const catName = p.categoria?.nombre || "Otros";
                const subName = p.subcategoria?.nombre || "General";

                if (!grouped[catName]) grouped[catName] = {};
                if (!grouped[catName][subName]) grouped[catName][subName] = [];

                grouped[catName][subName].push(p);
            });

            // Format Text
            let text = `🧴✨ ${branding?.businessName?.toUpperCase() || 'CATÁLOGO'} - STOCK ACTUAL ✨🧴\n\n`;
            text += `🔥 Todos nuevos, originales y sellados 🔥\n\n`;
            text += `📦 Entregas inmediatas / Envíos / Retiro.\n\n`;

            const categories = Object.keys(grouped).sort();

            categories.forEach(cat => {
                text += `💎 ${cat.toUpperCase()}\n`;

                const subcategories = Object.keys(grouped[cat]).sort();
                subcategories.forEach(sub => {
                    // Only show subcategory header if it's not "General" or if there are multiple subcategories
                    if (sub !== "General" || subcategories.length > 1) {
                        text += `  🔸 ${sub}\n`;
                    }

                    grouped[cat][sub].forEach((p: any) => {
                        const priceFormatted = new Intl.NumberFormat('es-AR', {
                            style: 'currency',
                            currency: 'ARS',
                            maximumFractionDigits: 0
                        }).format(p.precioVenta).replace('$', '$ ');

                        text += `  * ${p.nombre} — ${priceFormatted}\n`;
                    });
                    text += `\n`;
                });
            });

            text += `📲 Consultas, fotos y stock actualizado al privado\n\n`;
            text += `💳 Aceptamos transferencias y efectivo.\n\n`;
            text += `🚚 Envíos en el día (consultá zona).`;

            onChange(text);
            toast.success("¡Lista de productos generada con éxito!");
        } catch (e: any) {
            toast.error("Error al generar lista: " + e.message);
        } finally {
            setFetching(false);
        }
    };

    const copyToClipboard = () => {
        if (!value) return;
        navigator.clipboard.writeText(value);
        toast.success("Copiado al portapapeles");
    };

    return (
        <Card className="rounded-[2.5rem] p-8 border hover:border-emerald-500/30 transition-all bg-card/50 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <List className="h-24 w-24 text-emerald-600" />
            </div>

            <div className="relative z-10 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-black uppercase tracking-widest text-emerald-600/80">
                            Generador de Texto para WhatsApp
                        </label>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Categorías y Subcategorías</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={generateProductListText}
                            disabled={fetching}
                            className="h-9 px-4 rounded-xl border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/40 gap-2 transition-all active:scale-95"
                        >
                            <RefreshCw className={cn("h-4 w-4", fetching && "animate-spin")} />
                            <span className="font-bold">Generar</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!value}
                            onClick={copyToClipboard}
                            className="h-9 px-4 rounded-xl border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/40 gap-2 transition-all active:scale-95"
                        >
                            <Copy className="h-4 w-4" />
                            <span className="font-bold">Copiar</span>
                        </Button>
                    </div>
                </div>

                <Textarea
                    value={value}
                    readOnly
                    placeholder="Haz clic en 'Generar' para cargar la lista de productos agrupada por categorías y subcategorías..."
                    className="min-h-[400px] text-sm leading-relaxed bg-background/30 border-none focus-visible:ring-0 resize-none p-0 overflow-y-auto"
                />
            </div>
        </Card>
    );
}
