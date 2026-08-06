import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/layout/brand-logo";

interface BrandLockupProps {
  className?: string;
}

/** Cabecera de producto: "KNOWLEDGE | CLOUD". La firma institucional con
 * coma ("KNOWLEDGE,cloud") vive aparte (alt del logo, comentarios del
 * sistema de diseño) y no se toca acá. */
export function BrandLockup({ className }: BrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandLogo size="sm" />
      <div className="flex items-center text-sm tracking-wide">
        <span className="font-medium text-foreground">KNOWLEDGE</span>
        <span aria-hidden="true" className="mx-2 h-4 w-px bg-border" />
        <span className="font-medium text-[color:var(--primary)]">CLOUD</span>
      </div>
    </div>
  );
}
