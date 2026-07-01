import React from "react";
import { StoreThemeConfig } from "@/lib/validators/settings";

interface ThemeInjectorProps {
  theme?: StoreThemeConfig | null;
}

export function ThemeInjector({ theme }: ThemeInjectorProps) {
  if (!theme) return null;

  // Formatear fuentes para la URL de Google Fonts
  const formatFontForUrl = (font: string) => font.replace(/\s+/g, "+");

  const headingFontQuery = formatFontForUrl(theme.headingFont);
  const bodyFontQuery = formatFontForUrl(theme.bodyFont);

  // Evitar duplicar la misma fuente en la URL si heading y body usan la misma
  const fontsToLoad = Array.from(new Set([headingFontQuery, bodyFontQuery]));
  const fontFamiliesString = fontsToLoad
    .map((font) => `family=${font}:wght@300;400;500;600;700`)
    .join("&");

  const googleFontsUrl = `https://fonts.googleapis.com/css2?${fontFamiliesString}&display=swap`;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={googleFontsUrl} rel="stylesheet" />
      
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --color-primary: ${theme.primaryColor};
              --color-secondary: ${theme.secondaryColor};
              --color-background: ${theme.backgroundColor};
              --font-main: "${theme.bodyFont}", sans-serif;
              --font-heading: "${theme.headingFont}", sans-serif;
            }
          `,
        }}
      />
    </>
  );
}
