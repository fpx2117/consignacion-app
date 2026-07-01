"use client";

import * as React from "react";
import { ArrowRight, Package2, Layers3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductList } from "./product-list";
import type {
  PublicCatalogCategory,
  PublicCatalogConfig,
  PublicCatalogProduct,
} from "@/lib/types";
import { normalizeStorefrontContent } from "@/lib/storefront/storefront-content";

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">{title}</h2>
  );
}

export function StorefrontSections({
  config,
  products,
  categories,
  onSelectCategory,
  onScrollToCatalog,
  onOpenProduct,
  onAddToCart,
  isConsigne,
}: {
  config: PublicCatalogConfig;
  products: PublicCatalogProduct[];
  categories: PublicCatalogCategory[];
  onSelectCategory: (categoryId: number | null) => void;
  onScrollToCatalog: () => void;
  onOpenProduct: (product: PublicCatalogProduct) => void;
  onAddToCart: (product: PublicCatalogProduct, quantity?: number) => void;
  isConsigne: boolean;
}) {
  const content = React.useMemo(
    () => normalizeStorefrontContent(config.storefrontContent, { storeName: config.businessName }),
    [config.businessName, config.storefrontContent],
  );

  const featuredCategories = React.useMemo(() => {
    const preferred = content.featuredCategoryIds
      .map((id) => categories.find((category) => category.id === id))
      .filter((category): category is PublicCatalogCategory => Boolean(category));
    return (preferred.length > 0 ? preferred : categories.slice(0, 6)).slice(0, 6);
  }, [categories, content.featuredCategoryIds]);

  const availableProducts = React.useMemo(
    () => products.filter((product) => product.stockDisponibleUnits > 0),
    [products],
  );

  const featuredProducts = React.useMemo(() => {
    const discounted = availableProducts.filter((product) => product.descuentoEfectivo);
    return (discounted.length > 0 ? discounted : availableProducts).slice(0, 4);
  }, [availableProducts]);

  const stats = [
    { icon: Package2, label: "Productos", value: String(products.length), desc: "Stock actualizado" },
    { icon: Layers3, label: "Categorías", value: String(categories.length), desc: "Organización por rubro" },
    {
      icon: Sparkles,
      label: "Canal",
      value: config.tiendaPaymentMode === "mercadopago" ? "Pago online" : config.tiendaPaymentMode === "whatsapp" ? "Compra directa" : "Consulta guiada",
      desc: config.tiendaPaymentMode === "mercadopago" ? "Carrito + Mercado Pago" : config.tiendaPaymentMode === "whatsapp" ? "Carrito + WhatsApp" : "Vía WhatsApp",
    },
  ];

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Categories section */}
      <section>
        <SectionTitle title={content.categories.title} />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {featuredCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => { onSelectCategory(category.id); onScrollToCatalog(); }}
              className="group flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-gray-200"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ backgroundColor: config.primaryColor || "#111827" }}>
                <span className="text-sm font-bold">{category.nombre.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                {category.nombre}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Stats section */}
      <section>
        <SectionTitle title={content.highlights.title} />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                <item.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight text-gray-900">{item.value}</p>
              <p className="mt-1 text-sm font-medium text-gray-700">{item.label}</p>
              <p className="mt-0.5 text-xs text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      {featuredProducts.length > 0 && (
        <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle title={content.featuredProducts.title} />
            <Button type="button" variant="outline" onClick={onScrollToCatalog} className="rounded-full">
              {content.heroPrimaryCtaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-6">
            <ProductList
              products={featuredProducts}
              config={config}
              viewMode="grid"
              isConsigne={isConsigne}
              onAddToCart={onAddToCart}
              onViewProduct={onOpenProduct}
              compact
            />
          </div>
        </section>
      )}

      {/* Catalog intro */}
    </div>
  );
}
