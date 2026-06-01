import * as React from "react";
import { LayoutTemplate, Layers3, ShoppingBag, Tags } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizeStorefrontContent,
  type StorefrontContent,
  type StorefrontSectionContent,
} from "@/lib/storefront-content";
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

function SectionFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: StorefrontSectionContent;
  onChange: (next: StorefrontSectionContent) => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border/40 bg-muted/20 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Eyebrow</Label>
          <Input
            value={value.eyebrow}
            onChange={(event) => onChange({ ...value, eyebrow: event.target.value })}
            className="h-10 rounded-lg border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Titulo</Label>
          <Input
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            className="h-10 rounded-lg border-border/60"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Descripcion</Label>
        <Textarea
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          className="min-h-24 rounded-lg border-border/60"
        />
      </div>
    </div>
  );
}

export function HomeTab({ branding, setBranding, categoriesPreview }: HomeTabProps) {
  const storefrontContent = React.useMemo<StorefrontContent>(() => {
    return normalizeStorefrontContent(branding.storefrontContent, { storeName: branding.businessName });
  }, [branding.businessName, branding.storefrontContent]);

  const updateStorefront = React.useCallback(
    (next: StorefrontContent) => {
      setBranding((prev) => ({ ...prev, storefrontContent: next }));
    },
    [setBranding],
  );

  const toggleCategory = (categoryId: number, checked: boolean) => {
    const nextIds = checked
      ? [...storefrontContent.featuredCategoryIds, categoryId]
      : storefrontContent.featuredCategoryIds.filter((id) => id !== categoryId);

    updateStorefront({
      ...storefrontContent,
      featuredCategoryIds: Array.from(new Set(nextIds)).slice(0, 8),
    });
  };

  return (
    <div className="space-y-8">
      <SectionCard
        icon={LayoutTemplate}
        title="Hero y mensajes superiores"
        description="Edita los textos principales que abren la tienda publica."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Franja superior</Label>
            <Input
              value={storefrontContent.announcementText}
              onChange={(event) =>
                updateStorefront({ ...storefrontContent, announcementText: event.target.value })
              }
              className="h-10 rounded-lg border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Badge del hero</Label>
            <Input
              value={storefrontContent.heroBadge}
              onChange={(event) =>
                updateStorefront({ ...storefrontContent, heroBadge: event.target.value })
              }
              className="h-10 rounded-lg border-border/60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Titulo principal</Label>
          <Textarea
            value={storefrontContent.heroTitle}
            onChange={(event) =>
              updateStorefront({ ...storefrontContent, heroTitle: event.target.value })
            }
            className="min-h-24 rounded-lg border-border/60"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Descripcion principal</Label>
          <Textarea
            value={storefrontContent.heroDescription}
            onChange={(event) =>
              updateStorefront({ ...storefrontContent, heroDescription: event.target.value })
            }
            className="min-h-28 rounded-lg border-border/60"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Boton principal</Label>
            <Input
              value={storefrontContent.heroPrimaryCtaLabel}
              onChange={(event) =>
                updateStorefront({ ...storefrontContent, heroPrimaryCtaLabel: event.target.value })
              }
              className="h-10 rounded-lg border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Boton secundario</Label>
            <Input
              value={storefrontContent.heroSecondaryCtaLabel}
              onChange={(event) =>
                updateStorefront({ ...storefrontContent, heroSecondaryCtaLabel: event.target.value })
              }
              className="h-10 rounded-lg border-border/60"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Tags}
        title="Categorias visibles"
        description="Selecciona hasta 8 categorias reales para las tarjetas redondas de la home."
      >
        <SectionFields
          title="Encabezado de categorias"
          value={storefrontContent.categories}
          onChange={(categories) => updateStorefront({ ...storefrontContent, categories })}
        />

        <div className="grid gap-3 md:grid-cols-2">
          {categoriesPreview.map((category) => {
            const checked = storefrontContent.featuredCategoryIds.includes(category.id);
            return (
              <label
                key={category.id}
                className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background px-4 py-3"
              >
                <Checkbox checked={checked} onCheckedChange={(value) => toggleCategory(category.id, Boolean(value))} />
                <div>
                  <p className="text-sm font-semibold">{category.nombre}</p>
                  <p className="text-xs text-muted-foreground">ID real: {category.id}</p>
                </div>
              </label>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon={Layers3}
        title="Bloques y secciones comerciales"
        description="Ajusta los textos que enmarcan los bloques destacados y las grillas de producto."
      >
        <SectionFields
          title="Bloques destacados"
          value={storefrontContent.highlights}
          onChange={(highlights) => updateStorefront({ ...storefrontContent, highlights })}
        />
        <SectionFields
          title="Grilla destacada"
          value={storefrontContent.featuredProducts}
          onChange={(featuredProducts) => updateStorefront({ ...storefrontContent, featuredProducts })}
        />
        <SectionFields
          title="Catalogo general"
          value={storefrontContent.catalog}
          onChange={(catalog) => updateStorefront({ ...storefrontContent, catalog })}
        />
      </SectionCard>

      <SectionCard
        icon={ShoppingBag}
        title="Textos de apoyo y footer"
        description="Mensajes cortos que acompanan los indicadores y el cierre comercial."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Label productos</Label>
            <Input
              value={storefrontContent.stats.products.label}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  stats: {
                    ...storefrontContent.stats,
                    products: { ...storefrontContent.stats.products, label: event.target.value },
                  },
                })
              }
              className="h-10 rounded-lg border-border/60"
            />
            <Textarea
              value={storefrontContent.stats.products.description}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  stats: {
                    ...storefrontContent.stats,
                    products: { ...storefrontContent.stats.products, description: event.target.value },
                  },
                })
              }
              className="min-h-24 rounded-lg border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Label categorias</Label>
            <Input
              value={storefrontContent.stats.categories.label}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  stats: {
                    ...storefrontContent.stats,
                    categories: { ...storefrontContent.stats.categories, label: event.target.value },
                  },
                })
              }
              className="h-10 rounded-lg border-border/60"
            />
            <Textarea
              value={storefrontContent.stats.categories.description}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  stats: {
                    ...storefrontContent.stats,
                    categories: { ...storefrontContent.stats.categories, description: event.target.value },
                  },
                })
              }
              className="min-h-24 rounded-lg border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Label canal</Label>
            <Input
              value={storefrontContent.stats.channel.label}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  stats: {
                    ...storefrontContent.stats,
                    channel: { ...storefrontContent.stats.channel, label: event.target.value },
                  },
                })
              }
              className="h-10 rounded-lg border-border/60"
            />
            <Textarea
              value={storefrontContent.stats.channel.description}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  stats: {
                    ...storefrontContent.stats,
                    channel: { ...storefrontContent.stats.channel, description: event.target.value },
                  },
                })
              }
              className="min-h-24 rounded-lg border-border/60"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Titulo del footer</Label>
            <Input
              value={storefrontContent.footer.title}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  footer: { ...storefrontContent.footer, title: event.target.value },
                })
              }
              className="h-10 rounded-lg border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Descripcion del footer</Label>
            <Textarea
              value={storefrontContent.footer.description}
              onChange={(event) =>
                updateStorefront({
                  ...storefrontContent,
                  footer: { ...storefrontContent.footer, description: event.target.value },
                })
              }
              className="min-h-24 rounded-lg border-border/60"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
