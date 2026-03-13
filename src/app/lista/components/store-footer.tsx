/* eslint-disable */
// @ts-nocheck
"use client";

import { PackageOpen, Instagram, Facebook, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function normalizeUrl(url?: string | null) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function normalizeWhatsApp(value?: string | null) {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
}

export function StoreFooter({ config }: { config: any }) {
  const theme = config.themeIdentifier || "modern";
  const instagramHref = normalizeUrl(config.instagramUrl);
  const facebookHref = normalizeUrl(config.facebookUrl);
  const youtubeHref = normalizeUrl(config.youtubeUrl);
  const tiktokHref = normalizeUrl(config.tiktokUrl);
  const mapsHref = normalizeUrl(config.googleMapsUrl);
  const whatsappNumber = normalizeWhatsApp(config.whatsappNumber);
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : "";


  return (
    <footer className={cn(
      "mt-12 sm:mt-20 border-t border-border py-10 sm:py-16 text-center text-foreground",
      theme === 'modern' ? "bg-[color:var(--store-surface)]" :
        theme === 'minimal' ? "bg-[color:var(--store-canvas)] sm:py-24" :
          "bg-gradient-to-b from-primary/10 to-secondary/10 border-t-4 border-primary/20"
    )}>
      <div className="container mx-auto px-4 flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          {config.logoData ? (
            <img src={`data:${config.logoMime};base64,${config.logoData}`} className="h-8 w-auto opacity-80" alt="Logo corporativo" />
          ) : (
            <PackageOpen className="h-8 w-8 text-primary/40" />
          )}
          <span className="font-black text-xl tracking-tighter text-foreground">{config.businessName}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {instagramHref && (
            <a href={instagramHref} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[color:var(--store-surface)] border border-border shadow-sm flex items-center justify-center text-[color:var(--brand-instagram)] hover:scale-110 transition-transform" aria-label="Instagram">
              <Instagram className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          )}
          {facebookHref && (
            <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[color:var(--store-surface)] border border-border shadow-sm flex items-center justify-center text-[color:var(--theme-ocean-primary)] hover:scale-110 transition-transform" aria-label="Facebook">
              <Facebook className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          )}
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[color:var(--store-surface)] border border-border shadow-sm flex items-center justify-center text-[color:var(--status-success-strong)] hover:scale-110 transition-transform" aria-label="WhatsApp">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          )}
          {tiktokHref && (
            <a href={tiktokHref} target="_blank" rel="noopener noreferrer" className="h-10 px-3 sm:h-12 sm:px-4 rounded-2xl bg-[color:var(--store-surface)] border border-border shadow-sm flex items-center justify-center text-foreground text-[11px] sm:text-xs font-bold hover:scale-105 transition-transform" aria-label="TikTok">
              TikTok
            </a>
          )}
          {youtubeHref && (
            <a href={youtubeHref} target="_blank" rel="noopener noreferrer" className="h-10 px-3 sm:h-12 sm:px-4 rounded-2xl bg-[color:var(--store-surface)] border border-border shadow-sm flex items-center justify-center text-[color:var(--status-danger)] text-[11px] sm:text-xs font-bold hover:scale-105 transition-transform" aria-label="YouTube">
              YouTube
            </a>
          )}
          {mapsHref && (
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="h-10 px-3 sm:h-12 sm:px-4 rounded-2xl bg-[color:var(--store-surface)] border border-border shadow-sm flex items-center justify-center text-foreground text-[11px] sm:text-xs font-bold hover:scale-105 transition-transform" aria-label="Ubicacion">
              Ubicacion
            </a>
          )}
        </div>

        {config.address && (
          <div className="max-w-md space-y-2">
            <p className="text-sm font-bold leading-relaxed text-foreground">
              {config.address && <span>{config.address}</span>}
            </p>
          </div>
        )}
        <div className="max-w-xs space-y-2">
          <p className="text-[10px] uppercase font-black tracking-widest text-foreground">{config.footerText || `© 2026 ${config.businessName}`}</p>
        </div>
      </div>
    </footer>
  );
}
