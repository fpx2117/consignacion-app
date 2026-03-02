"use client";

import { PackageOpen, Instagram, Facebook, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function StoreFooter({ config }: { config: any }) {
  const theme = config.themeIdentifier || "modern";

  return (
    <footer className={cn(
      "mt-12 sm:mt-20 border-t py-10 sm:py-16 text-center",
      theme === 'modern' ? "bg-white text-neutral-900" :
        theme === 'minimal' ? "bg-zinc-50 sm:py-24" :
          "bg-gradient-to-b from-primary/10 to-secondary/10 border-t-4 border-primary/20"
    )}>
      <div className="container mx-auto px-4 flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          {config.logoData ? (
            <img src={`data:${config.logoMime};base64,${config.logoData}`} className="h-8 w-auto opacity-80" alt="Logo corporativo" />
          ) : (
            <PackageOpen className="h-8 w-8 text-primary/40" />
          )}
          <span className="font-black text-xl tracking-tighter">{config.businessName}</span>
        </div>

        <div className="flex gap-4">
          {config.instagramUrl && (
            <a href={config.instagramUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white border shadow-sm flex items-center justify-center text-pink-500 hover:scale-110 transition-transform">
              <Instagram className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          )}
          {config.facebookUrl && (
            <a href={config.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white border shadow-sm flex items-center justify-center text-blue-600 hover:scale-110 transition-transform">
              <Facebook className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          )}
          {config.whatsappNumber && (
            <a href={`https://wa.me/${config.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white border shadow-sm flex items-center justify-center text-emerald-500 hover:scale-110 transition-transform">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          )}
        </div>

        {(config.phone || config.address) && (
          <div className="max-w-md space-y-2 opacity-80">
            <p className="text-sm font-bold leading-relaxed">
              {config.phone && <span>{config.phone}</span>}
              {config.phone && config.address && <span className="mx-2 opacity-50">•</span>}
              {config.address && <span>{config.address}</span>}
            </p>
          </div>
        )}
        <div className="max-w-xs space-y-2 opacity-60">
          <p className="text-[10px] uppercase font-black tracking-widest">{config.footerText || `© 2026 ${config.businessName}`}</p>
        </div>
      </div>
    </footer>
  );
}