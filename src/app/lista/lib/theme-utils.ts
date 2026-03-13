type StoreTheme =
  | "modern"
  | "nature"
  | "ocean"
  | "sunset"
  | "luxury"
  | "minimal"
  | "barbie"
  | "tech";

type ThemeStyles = {
  theme: StoreTheme;
  radiusClass: string;
  buttonRadiusClass: string;
  inputRadiusClass: string;
  buttonHoverClass: string;
  pageBgClass: string;
  cardBgClass: string;
  headerBgClass: string;
};

const THEME_ALIASES: Record<string, StoreTheme> = {
  modern: "modern",
  moderno: "modern",
  nature: "nature",
  natural: "nature",
  ocean: "ocean",
  oceano: "ocean",
  sunset: "sunset",
  atardecer: "sunset",
  luxury: "luxury",
  lujo: "luxury",
  minimal: "minimal",
  minimalista: "minimal",
  barbie: "barbie",
  pop: "barbie",
  tech: "tech",
  tecnologia: "tech",
};

const RADII: Record<StoreTheme, Pick<ThemeStyles, "radiusClass" | "buttonRadiusClass" | "inputRadiusClass">> = {
  modern: {
    radiusClass: "rounded-[2rem]",
    buttonRadiusClass: "rounded-full",
    inputRadiusClass: "rounded-full",
  },
  nature: {
    radiusClass: "rounded-2xl",
    buttonRadiusClass: "rounded-2xl",
    inputRadiusClass: "rounded-xl",
  },
  ocean: {
    radiusClass: "rounded-[2rem]",
    buttonRadiusClass: "rounded-full",
    inputRadiusClass: "rounded-full",
  },
  sunset: {
    radiusClass: "rounded-2xl",
    buttonRadiusClass: "rounded-2xl",
    inputRadiusClass: "rounded-xl",
  },
  luxury: {
    radiusClass: "rounded-none",
    buttonRadiusClass: "rounded-none",
    inputRadiusClass: "rounded-none",
  },
  minimal: {
    radiusClass: "rounded-none",
    buttonRadiusClass: "rounded-none",
    inputRadiusClass: "rounded-none",
  },
  barbie: {
    radiusClass: "rounded-[2rem]",
    buttonRadiusClass: "rounded-full",
    inputRadiusClass: "rounded-full",
  },
  tech: {
    radiusClass: "rounded-lg",
    buttonRadiusClass: "rounded-md",
    inputRadiusClass: "rounded-md",
  },
};

const HOVERS: Record<StoreTheme, string> = {
  modern: "hover:scale-[1.05]",
  nature: "hover:scale-[1.05]",
  ocean: "hover:scale-[1.05]",
  sunset: "hover:scale-[1.05]",
  barbie: "hover:scale-[1.05]",
  minimal: "hover:bg-foreground/90 transition-colors",
  luxury: "hover:bg-transparent hover:text-primary border-2 border-primary transition-all",
  tech: "hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] transition-shadow",
};

const SURFACES: Record<StoreTheme, Pick<ThemeStyles, "pageBgClass" | "cardBgClass" | "headerBgClass">> = {
  modern: {
    pageBgClass: "bg-[linear-gradient(180deg,var(--secondary)_0%,var(--store-canvas)_65%)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[color:rgba(var(--store-surface-rgb),0.9)]",
  },
  nature: {
    pageBgClass:
      "bg-[radial-gradient(circle_at_top_right,rgba(var(--primary-rgb),0.14),transparent_42%),linear-gradient(180deg,var(--secondary)_0%,var(--store-canvas)_72%)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[linear-gradient(180deg,var(--secondary)_0%,rgba(var(--store-surface-rgb),0.95)_100%)]",
  },
  ocean: {
    pageBgClass:
      "bg-[radial-gradient(circle_at_top_right,rgba(var(--primary-rgb),0.16),transparent_44%),linear-gradient(180deg,var(--secondary)_0%,var(--store-canvas)_70%)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[linear-gradient(180deg,var(--secondary)_0%,rgba(var(--store-surface-rgb),0.95)_100%)]",
  },
  sunset: {
    pageBgClass:
      "bg-[radial-gradient(circle_at_top_right,rgba(var(--primary-rgb),0.15),transparent_45%),linear-gradient(180deg,var(--secondary)_0%,var(--store-canvas)_74%)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[linear-gradient(180deg,var(--secondary)_0%,rgba(var(--store-surface-rgb),0.95)_100%)]",
  },
  luxury: {
    pageBgClass:
      "bg-[linear-gradient(180deg,var(--secondary)_0%,var(--store-canvas)_55%),radial-gradient(circle_at_top,rgba(var(--primary-rgb),0.08),transparent_55%)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[color:rgba(var(--store-surface-rgb),0.95)]",
  },
  minimal: {
    pageBgClass: "bg-[color:var(--store-canvas)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[color:rgba(var(--store-surface-rgb),0.95)]",
  },
  barbie: {
    pageBgClass:
      "bg-[radial-gradient(circle_at_top_right,rgba(var(--primary-rgb),0.14),transparent_40%),linear-gradient(180deg,var(--secondary)_0%,var(--store-canvas)_70%)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[linear-gradient(180deg,var(--secondary)_0%,rgba(var(--store-surface-rgb),0.95)_100%)]",
  },
  tech: {
    pageBgClass:
      "bg-[radial-gradient(circle_at_top_right,rgba(var(--primary-rgb),0.18),transparent_48%),linear-gradient(180deg,var(--secondary)_0%,var(--store-canvas)_75%)]",
    cardBgClass: "bg-[color:var(--store-surface)]",
    headerBgClass: "bg-[linear-gradient(180deg,var(--secondary)_0%,rgba(var(--store-surface-rgb),0.94)_100%)]",
  },
};

function normalizeThemeIdentifier(input: string | undefined | null): string {
  return (input || "modern")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_-]+/g, "");
}

function resolveTheme(themeIdentifier: string | undefined | null): StoreTheme {
  const normalized = normalizeThemeIdentifier(themeIdentifier);
  return THEME_ALIASES[normalized] || "modern";
}

export function getThemeStyles(themeIdentifier: string | undefined | null): ThemeStyles {
  const theme = resolveTheme(themeIdentifier);

  return {
    theme,
    ...RADII[theme],
    buttonHoverClass: HOVERS[theme],
    ...SURFACES[theme],
  };
}
