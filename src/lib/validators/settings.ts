import { z } from "zod";

export const storeThemeConfigSchema = z.object({
  primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Color primario inválido").default("#111827"),
  secondaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Color secundario inválido").default("#3b82f6"),
  backgroundColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, "Color de fondo inválido").default("#ffffff"),
  headingFont: z.string().default("Inter"),
  bodyFont: z.string().default("Inter"),
});

export type StoreThemeConfig = z.infer<typeof storeThemeConfigSchema>;
