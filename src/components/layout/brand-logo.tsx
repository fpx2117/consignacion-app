"use client";
import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { LOGOS } from "@/theme/know-design-system";
interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}
const SIZE_PX = { sm: 32, md: 40, lg: 48 } as const;
// El CSS (.dark) elige la variante visible; hacerlo en JS via useTheme()
// desincroniza SSR/CSR (el tema real solo se conoce en el cliente) y rompe la hidratacion.
const VARIANTS = [
  { src: LOGOS.light, css: "dark:hidden" },
  { src: LOGOS.dark, css: "hidden dark:block" },
] as const;
export function BrandLogo({ className, size = "md" }: BrandLogoProps) {
  const px = SIZE_PX[size];
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      {VARIANTS.map(({ src, css }) => (
        <Image
          key={src}
          src={src}
          alt="KNOWLEDGE,cloud"
          width={px}
          height={px}
          className={css}
        />
      ))}
    </div>
  );
}
