"use client";

import { PackageOpen } from "lucide-react";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

interface ProductListProps {
    products: any[];
    config: any;
    viewMode: "grid" | "list";
    isConsigne: boolean;
    onAddToCart: (p: any) => void;
    onViewProduct: (p: any) => void; // Agregamos esto
}

export function ProductList({ products, config, viewMode, isConsigne, onAddToCart, onViewProduct }: ProductListProps) {
    const isGrid = viewMode === "grid";

    if (!products || products.length === 0) {
        return (
            <div className="py-24 flex flex-col items-center text-center opacity-40">
                <PackageOpen className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium">No encontramos productos con esos filtros</p>
            </div>
        );
    }

    return (
        <div className={cn(
            "grid animate-in fade-in duration-500",
            isGrid
                ? "grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6"
                : "grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4"
        )}>
            {products.map((product, idx) => (
                <ProductCard
                    key={product.id}
                    product={product}
                    index={idx}
                    config={config}
                    viewMode={viewMode}
                    isConsigne={isConsigne}
                    onAddToCart={onAddToCart}
                    onViewProduct={onViewProduct} // Y se lo pasamos a la tarjeta acá
                />
            ))}
        </div>
    );
}