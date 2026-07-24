export type StorefrontStatContent = {
  label: string;
  description: string;
};

export type StorefrontSectionContent = {
  eyebrow: string;
  title: string;
  description: string;
};

export type StorefrontContent = {
  announcementText: string;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  heroPrimaryCtaLabel: string;
  heroSecondaryCtaLabel: string;
  categories: StorefrontSectionContent;
  highlights: StorefrontSectionContent;
  featuredProducts: StorefrontSectionContent;
  catalog: StorefrontSectionContent;
  footer: {
    title: string;
    description: string;
  };
  stats: {
    products: StorefrontStatContent;
    categories: StorefrontStatContent;
    channel: StorefrontStatContent;
  };
  featuredCategoryIds: number[];
};

type StorefrontContext = {
  storeName?: string | null;
};

const DEFAULT_SECTION = {
  eyebrow: "",
  title: "",
  description: "",
} satisfies StorefrontSectionContent;

function cleanString(value: unknown, fallback: string) {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : fallback;
}

function normalizeSection(
  value: unknown,
  fallback: StorefrontSectionContent,
): StorefrontSectionContent {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    eyebrow: cleanString(source.eyebrow, fallback.eyebrow),
    title: cleanString(source.title, fallback.title),
    description: cleanString(source.description, fallback.description),
  };
}

function normalizeStat(
  value: unknown,
  fallback: StorefrontStatContent,
): StorefrontStatContent {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    label: cleanString(source.label, fallback.label),
    description: cleanString(source.description, fallback.description),
  };
}

export function createDefaultStorefrontContent(
  context: StorefrontContext = {},
): StorefrontContent {
  const storeName = context.storeName?.trim() || "tu tienda";

  return {
    announcementText:
      "Envíos a todo el país · Atención personalizada · Nuevos ingresos cada semana",
    heroBadge: "Tienda online",
    heroTitle: `Bienvenido a ${storeName}`,
    heroDescription:
      "Explorá nuestro catálogo completo con productos seleccionados y los mejores precios.",
    heroPrimaryCtaLabel: "Ver productos",
    heroSecondaryCtaLabel: "Explorar categorías",
    categories: {
      eyebrow: "Categorías",
      title: "Categorías",
      description: "",
    },
    highlights: {
      eyebrow: "Ventajas",
      title: "Ventajas",
      description: "",
    },
    featuredProducts: {
      eyebrow: "Destacados",
      title: "Productos destacados",
      description: "",
    },
    catalog: {
      eyebrow: "Catálogo",
      title: "Catálogo",
      description: "",
    },
    footer: {
      title: "Contacto",
      description: "Compartí tus canales de contacto, dirección y redes.",
    },
    stats: {
      products: {
        label: "Productos",
        description: "Stock actualizado",
      },
      categories: {
        label: "Categorías",
        description: "Organización por rubro",
      },
      channel: {
        label: "Canal",
        description: "Compra directa o consulta",
      },
    },
    featuredCategoryIds: [],
  };
}

export function normalizeStorefrontContent(
  value: unknown,
  context: StorefrontContext = {},
): StorefrontContent {
  const fallback = createDefaultStorefrontContent(context);
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const featuredCategoryIds = Array.isArray(source.featuredCategoryIds)
    ? source.featuredCategoryIds
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
        .slice(0, 8)
    : fallback.featuredCategoryIds;

  const footerSource =
    source.footer && typeof source.footer === "object"
      ? (source.footer as Record<string, unknown>)
      : {};
  const statsSource =
    source.stats && typeof source.stats === "object"
      ? (source.stats as Record<string, unknown>)
      : {};

  return {
    announcementText: cleanString(
      source.announcementText,
      fallback.announcementText,
    ),
    heroBadge: cleanString(source.heroBadge, fallback.heroBadge),
    heroTitle: cleanString(source.heroTitle, fallback.heroTitle),
    heroDescription: cleanString(
      source.heroDescription,
      fallback.heroDescription,
    ),
    heroPrimaryCtaLabel: cleanString(
      source.heroPrimaryCtaLabel,
      fallback.heroPrimaryCtaLabel,
    ),
    heroSecondaryCtaLabel: cleanString(
      source.heroSecondaryCtaLabel,
      fallback.heroSecondaryCtaLabel,
    ),
    categories: normalizeSection(source.categories, fallback.categories),
    highlights: normalizeSection(source.highlights, fallback.highlights),
    featuredProducts: normalizeSection(
      source.featuredProducts,
      fallback.featuredProducts,
    ),
    catalog: normalizeSection(source.catalog, fallback.catalog),
    footer: {
      title: cleanString(footerSource.title, fallback.footer.title),
      description: cleanString(
        footerSource.description,
        fallback.footer.description,
      ),
    },
    stats: {
      products: normalizeStat(statsSource.products, fallback.stats.products),
      categories: normalizeStat(
        statsSource.categories,
        fallback.stats.categories,
      ),
      channel: normalizeStat(statsSource.channel, fallback.stats.channel),
    },
    featuredCategoryIds,
  };
}

export const EMPTY_STOREFRONT_SECTION = DEFAULT_SECTION;
