/* eslint-disable */
// @ts-nocheck
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
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
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
                POS
            </div>
        </div>
    );
}
