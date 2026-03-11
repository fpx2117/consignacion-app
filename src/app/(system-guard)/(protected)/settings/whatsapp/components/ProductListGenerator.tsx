"use client";

import * as React from "react";
import { RefreshCw, Copy, ClipboardCheck, PackageSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";

interface ProductListGeneratorProps {
    value: string;
    onChange: (val: string) => void;
}

type ProductForList = {
    nombre: string;
    precioVenta: number | string;
    stockDisponibleUnits?: number;
    categoria?: { nombre?: string | null } | null;
    subcategoria?: { nombre?: string | null } | null;
};

export function ProductListGenerator({ value, onChange }: ProductListGeneratorProps) {
    const [fetching, setFetching] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const generateProductListText = async () => {
        setFetching(true);
        try {
            const products = (await apiService.getProductos()) as ProductForList[];
            const branding = await apiService.getBranding();

            const availableProducts = products.filter((p) => (p.stockDisponibleUnits ?? 0) > 0);

            const grouped: Record<string, Record<string, ProductForList[]>> = {};
            availableProducts.forEach((p) => {
                const catName = p.categoria?.nombre || "Otros";
                const subName = p.subcategoria?.nombre || "General";

                if (!grouped[catName]) grouped[catName] = {};
                if (!grouped[catName][subName]) grouped[catName][subName] = [];

                grouped[catName][subName].push(p);
            });

            let text = `🧴✨ ${branding?.businessName?.toUpperCase() || "CATÁLOGO"} - STOCK ACTUAL ✨🧴\n\n`;
            text += `🔥 Todos nuevos, originales y sellados 🔥\n\n`;
            text += `📦 Entregas inmediatas / Envíos / Retiro.\n\n`;

            const categories = Object.keys(grouped).sort();

            categories.forEach((cat) => {
                text += `💎 ${cat.toUpperCase()}\n\n`;

                const subcategories = Object.keys(grouped[cat]).sort();
                subcategories.forEach((sub) => {
                    if (sub !== "General" || subcategories.length > 1) {
                        text += `  🔸 ${sub}\n\n`;
                    }

                    grouped[cat][sub].forEach((p) => {
                        const priceFormatted = new Intl.NumberFormat("es-AR", {
                            style: "currency",
                            currency: "ARS",
                            maximumFractionDigits: 0,
                        })
                            .format(Number(p.precioVenta))
                            .replace(/\$\s+/u, "$");

                        text += `  ${p.nombre} — ${priceFormatted}\n`;
                    });
                    text += `\n`;
                });
            });

            text += `📲 Consultas, fotos y stock actualizado al privado\n`;
            text += `💳 Aceptamos transferencias y efectivo.\n`;
            text += `🚚 Envíos en el día (consultá zona).`;

            onChange(text);
            toast.success("Lista de productos generada");
        } catch {
            toast.error("Error al generar la lista");
        } finally {
            setFetching(false);
        }
    };

    const copyToClipboard = async () => {
        if (!value) return;
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copiado al portapapeles");
        setTimeout(() => setCopied(false), 2000);
    };

    const lineCount = value ? value.split("\n").length : 0;

    return (
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-3.5">
                <div className="flex items-center gap-3">
                    <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold text-xs"
                    >
                        Generador de lista
                    </Badge>
                    {value && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {lineCount} líneas
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={generateProductListText}
                        disabled={fetching}
                        className="h-8 cursor-pointer gap-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
                        <span className="text-xs font-semibold">{fetching ? "Generando…" : "Generar"}</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={!value}
                        onClick={copyToClipboard}
                        className="h-8 cursor-pointer gap-1.5 rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                    >
                        {copied ? (
                            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                            <Copy className="h-3.5 w-3.5" />
                        )}
                        <span className="text-xs font-semibold">{copied ? "Copiado" : "Copiar"}</span>
                    </Button>
                </div>
            </div>

            <CardContent className="p-0">
                {!value ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
                            <PackageSearch className="h-7 w-7 text-muted-foreground/60" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">Sin lista generada</p>
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                Hacé click en &quot;Generar&quot; para crear una lista de productos con precios, agrupada por categorías.
                            </p>
                        </div>
                        <Button
                            onClick={generateProductListText}
                            disabled={fetching}
                            className="mt-2 h-9 cursor-pointer gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
                            Generar lista de productos
                        </Button>
                    </div>
                ) : (
                    <Textarea
                        value={value}
                        readOnly
                        className="min-h-[380px] resize-none rounded-none border-0 bg-transparent px-5 py-4 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus-visible:ring-0"
                    />
                )}
            </CardContent>
        </Card>
    );
}
