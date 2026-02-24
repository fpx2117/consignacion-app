"use client";

import * as React from "react";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
    className?: string;
    showText?: boolean;
    size?: "sm" | "md" | "lg";
}

export function BrandLogo({ className, showText = false, size = "md" }: BrandLogoProps) {
    const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
    const [error, setError] = React.useState(false);

    React.useEffect(() => {
        // Intentar cargar el logo desde la API
        const checkLogo = async () => {
            try {
                const res = await fetch("/api/settings/branding/logo");
                if (res.ok) {
                    setLogoUrl("/api/settings/branding/logo");
                } else {
                    setError(true);
                }
            } catch {
                setError(true);
            }
        };
        checkLogo();
    }, []);

    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
    };

    const iconSizeClasses = {
        sm: "h-4 w-4",
        md: "h-5 w-5",
        lg: "h-6 w-6",
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div
                className={cn(
                    "flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg transition-all font-black tracking-tighter",
                    sizeClasses[size],
                    size === "sm" ? "text-[10px]" : size === "md" ? "text-xs" : "text-sm"
                )}
            >
                {!error && logoUrl ? (
                    <img
                        src={logoUrl}
                        alt="Logo"
                        className="h-full w-full object-contain p-1 rounded-xl"
                        onError={() => setError(true)}
                    />
                ) : (
                    "POS"
                )}
            </div>
        </div>
    );
}
