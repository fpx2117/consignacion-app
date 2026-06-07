import { z } from "zod";

export const storeThemeConfigSchema = z.object({
  primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Color primario inválido").default("#111827"),
  secondaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Color secundario inválido").default("#3b82f6"),
  backgroundColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Color de fondo inválido").default("#ffffff"),
  headingFont: z.string().default("Inter"),
  bodyFont: z.string().default("Inter"),
});

export type StoreThemeConfig = z.infer<typeof storeThemeConfigSchema>;

// ============================================================
// ONLINE STORE SETTINGS SCHEMA
// ============================================================

const hexColor = z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Color hexadecimal inválido");

export const onlineStoreThemeSchema = z.object({
  primaryColor: hexColor.default("#007AFF"),
  secondaryColor: hexColor.default("#EAF3FF"),
  backgroundColor: hexColor.default("#F5F6F8"),
  surfaceColor: hexColor.default("#FFFFFF"),
  textColor: hexColor.default("#0F172A"),
  mutedTextColor: hexColor.default("#8A8F98"),
  whatsappColor: hexColor.default("#25D366"),
  mode: z.enum(["light", "dark", "system"]).default("light"),
  borderRadius: z.enum(["sm", "md", "lg", "xl", "2xl"]).default("2xl"),
  shadow: z.enum(["none", "soft", "medium", "strong"]).default("soft"),
  cardStyle: z.enum(["minimal", "elevated", "bordered"]).default("minimal"),
  buttonStyle: z.enum(["rounded", "pill", "soft-square"]).default("pill"),
});

export const onlineStoreCatalogSchema = z.object({
  showCategories: z.boolean().default(true),
  showProductImages: z.boolean().default(true),
  showPrices: z.boolean().default(true),
  showStock: z.boolean().default(false),
  showViewAll: z.boolean().default(true),
  initialCategoryId: z.string().optional(),
  productLayout: z.enum(["grid", "horizontal", "compact"]).default("grid"),
  maxProductsPerSection: z.number().int().min(1).max(50).default(6),
  addButtonPosition: z.enum(["floating", "below"]).default("floating"),
  featuredProductIds: z.array(z.number().int()).default([]),
  featuredSections: z.array(z.object({
    title: z.string().default("Destacados"),
    productIds: z.array(z.number().int()).default([]),
  })).default([]),
});

export const onlineStorePromoItemSchema = z.object({
  id: z.string(),
  icon: z.string().default("🎉"),
  title: z.string().default("Promoción"),
  description: z.string().default(""),
  backgroundColor: hexColor.optional(),
  textColor: hexColor.optional(),
  order: z.number().int().optional(),
  visible: z.boolean().default(true),
});

export const onlineStorePromoSchema = z.object({
  enabled: z.boolean().default(true),
  items: z.array(onlineStorePromoItemSchema).default([]),
});

export const onlineStoreCartMessageSchema = z.object({
  greeting: z.string().default("Hola"),
  intro: z.string().default("Quisiera realizar el siguiente pedido:"),
  subtotalLabel: z.string().default("Subtotal"),
  totalLabel: z.string().default("Total"),
  footer: z.string().default(""),
});

export const onlineStoreCartSchema = z.object({
  displayMode: z.enum(["bottom-sheet", "modal", "drawer"]).default("bottom-sheet"),
  showWhatsappPreview: z.boolean().default(true),
  whatsappButtonText: z.string().default("Enviar pedido por WhatsApp"),
  messageTemplate: onlineStoreCartMessageSchema,
});

export const onlineStoreResponsiveSchema = z.object({
  desktopLayout: z.enum(["mobile-centered", "wide-ecommerce", "with-cart-sidebar"]).default("mobile-centered"),
});

export const onlineStoreSettingsSchema = z.object({
  storeName: z.string().default("Mi tienda"),
  storeLogoUrl: z.string().nullable().optional(),
  storeBannerUrl: z.string().nullable().optional(),
  description: z.string().default(""),
  openingHours: z.string().default(""),
  addressText: z.string().default(""),
  theme: onlineStoreThemeSchema,
  catalog: onlineStoreCatalogSchema,
  promotions: onlineStorePromoSchema,
  cart: onlineStoreCartSchema,
  responsive: onlineStoreResponsiveSchema,
});

export type OnlineStoreSettingsValidated = z.infer<typeof onlineStoreSettingsSchema>;
