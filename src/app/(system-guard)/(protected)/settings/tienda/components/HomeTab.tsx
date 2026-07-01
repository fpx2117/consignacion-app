"use client";

import * as React from "react";
import { LayoutTemplate, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeStorefrontContent, type StorefrontContent } from "@/lib/storefront/storefront-content";
import type { Categoria } from "@/lib/types";
import type { BrandingPreviewSettings } from "./types";

type HomeTabProps = {
  branding: BrandingPreviewSettings;
  setBranding: React.Dispatch<React.SetStateAction<BrandingPreviewSettings>>;
  categoriesPreview: Categoria[];
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/50">
      <div className="border-b border-border/30 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        <p className="ml-[26px] mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-5 p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function HomeTab({ branding, setBranding, categoriesPreview: _categoriesPreview }: HomeTabProps) {
  const storefrontContent = React.useMemo<StorefrontContent>(() => {
    return normalizeStorefrontContent(branding.storefrontContent, { storeName: branding.businessName });
  }, [branding.businessName, branding.storefrontContent]);

  const updateStorefront = React.useCallback(
    (next: StorefrontContent) => {
      setBranding((prev) => ({ ...prev, storefrontContent: next }));
    },
    [setBranding],
  );

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════
            HERO Y TEXTOS PRINCIPALES
      ═══════════════════════════════════════════ */}
      <SectionCard
        icon={LayoutTemplate}
        title="Hero y textos principales"
        description="Textos que se muestran en el encabezado de la tienda."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Franja de anuncio</Label>
            <Input
              value={storefrontContent.announcementText}
              onChange={(event) => updateStorefront({ ...storefrontContent, announcementText: event.target.value })}
              placeholder="Envíos a todo el país · Atención personalizada"
              className="h-10 rounded-lg border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Badge</Label>
            <Input
              value={storefrontContent.heroBadge}
              onChange={(event) => updateStorefront({ ...storefrontContent, heroBadge: event.target.value })}
              placeholder="Tienda online"
              className="h-10 rounded-lg border-border/60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Título del banner</Label>
          <Input
            value={storefrontContent.heroTitle}
            onChange={(event) => updateStorefront({ ...storefrontContent, heroTitle: event.target.value })}
            placeholder="Bienvenido a tu tienda"
            className="h-10 rounded-lg border-border/60"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Descripción</Label>
          <Textarea
            value={storefrontContent.heroDescription}
            onChange={(event) => updateStorefront({ ...storefrontContent, heroDescription: event.target.value })}
            placeholder="Breve descripción de tu comercio"
            className="min-h-24 rounded-lg border-border/60"
          />
        </div>
      </SectionCard>

      {/* ═══════════════════════════════════════════
            FOOTER
      ═══════════════════════════════════════════ */}
      <SectionCard
        icon={ShoppingBag}
        title="Footer"
        description="Textos que aparecen al final de la tienda."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Título del footer</Label>
            <Input
              value={storefrontContent.footer.title}
              onChange={(event) =>
                updateStorefront({ ...storefrontContent, footer: { ...storefrontContent.footer, title: event.target.value } })
              }
              placeholder="Nombre de tu marca"
              className="h-10 rounded-lg border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Descripción del footer</Label>
            <Textarea
              value={storefrontContent.footer.description}
              onChange={(event) =>
                updateStorefront({ ...storefrontContent, footer: { ...storefrontContent.footer, description: event.target.value } })
              }
              placeholder="Productos seleccionados con los mejores precios."
              className="min-h-24 rounded-lg border-border/60"
            />
          </div>
        </div>
      </SectionCard>

    </div>
  );
}
