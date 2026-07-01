"use client";

import Image from "next/image";
import { Store, Instagram, Facebook, MessageCircle, Phone, MapPin } from "lucide-react";
import type { PublicCatalogConfig } from "@/lib/types";
import { normalizeStorefrontContent } from "@/lib/storefront/storefront-content";

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

export function StoreFooter({ config }: { config: PublicCatalogConfig }) {
    const logoSrc = config.logoUrl || (config.logoData ? `data:${config.logoMime};base64,${config.logoData}` : null);
    const year = new Date().getFullYear();
    const content = normalizeStorefrontContent(config.storefrontContent, { storeName: config.businessName });
    const footerTitle = content.footer?.title || config.businessName || "Tienda";
    const footerDesc = content.footer?.description || "Productos seleccionados con los mejores precios y atención personalizada.";

    const instagramHref = normalizeUrl(config.instagramUrl);
    const facebookHref = normalizeUrl(config.facebookUrl);
    const whatsappNumber = normalizeWhatsApp(config.whatsappNumber);
    const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : "";
    const hasSocialLinks = instagramHref || facebookHref || whatsappHref;
    const hasContact = config.phone || config.address || config.whatsappNumber;

    return (
        <footer className="border-t border-gray-200 bg-gray-50 mt-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid gap-8 sm:grid-cols-3">
                    {/* Brand */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            {logoSrc ? (
                                <Image src={logoSrc} alt="Logo" width={36} height={36} unoptimized className="h-8 w-8 rounded-lg object-contain" />
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white">
                                    <Store className="h-4 w-4" />
                                </div>
                            )}
                            <span className="text-base font-bold text-gray-900">{footerTitle}</span>
                        </div>
                        <p className="text-sm text-gray-500 max-w-xs">{footerDesc}</p>
                    </div>

                    {/* Contact */}
                    {hasContact && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">Contacto</h4>
                            <div className="space-y-2">
                                {config.phone && (
                                    <a href={`tel:${config.phone}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                        {config.phone}
                                    </a>
                                )}
                                {whatsappHref && (
                                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                                        <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                        WhatsApp
                                    </a>
                                )}
                                {config.address && (
                                    <div className="flex items-start gap-2 text-sm text-gray-500">
                                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                        {config.address}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Social + Copyright */}
                    <div className="space-y-4">
                        {hasSocialLinks && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">Seguinos</h4>
                                <div className="flex items-center gap-2">
                                    {instagramHref && (
                                        <a href={instagramHref} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors">
                                            <Instagram className="h-4 w-4" />
                                        </a>
                                    )}
                                    {facebookHref && (
                                        <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors">
                                            <Facebook className="h-4 w-4" />
                                        </a>
                                    )}
                                    {whatsappHref && (
                                        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors">
                                            <MessageCircle className="h-4 w-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {!hasContact && (
                            <p className="text-xs text-gray-400">
                                &copy; {year} {config.businessName || "Tienda"}
                            </p>
                        )}
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="text-xs text-gray-400">
                        &copy; {year} {config.businessName || "Tienda"}. Todos los derechos reservados.
                    </p>
                    <div className="flex items-center gap-3">
                        {config.footerText && (
                            <p className="text-xs text-gray-400">{config.footerText}</p>
                        )}
                        <a href="/login" className="text-xs text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-4">
                            Panel Administrador
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
