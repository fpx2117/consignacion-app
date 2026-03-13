"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { DockIcon } from "@/components/ui/dock";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { SidebarNavItem } from "@/components/sidebar/types";

interface SidebarIconLinkProps {
  item: SidebarNavItem;
  active: boolean;
  isMobile?: boolean;
  badgeCount?: number;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export function SidebarIconLink({
  item,
  active,
  isMobile = false,
  badgeCount = 0,
  tooltipSide = "right",
}: SidebarIconLinkProps) {
  const Icon = item.icon;

  return (
    <DockIcon>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center justify-center rounded-full transition-all duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isMobile ? "h-9 w-9" : "h-10 w-10",
                active
                  ? "bg-primary text-primary-foreground shadow-lg scale-110"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={isMobile ? "h-4 w-4" : "size-5"} />
              {badgeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-destructive text-[9px] font-black text-destructive-foreground flex items-center justify-center leading-none animate-pulse">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>{item.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </DockIcon>
  );
}
