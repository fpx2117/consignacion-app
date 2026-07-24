"use client";

import { cn } from "@/lib/utils";
import { DockIcon } from "@/components/ui/dock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ElementType } from "react";

import type { SidebarNavItem } from "@/components/sidebar/types";

interface SidebarDropdownGroupProps {
  label: string;
  icon: ElementType;
  items: SidebarNavItem[];
  isActive: (href: string) => boolean;
  onNavigate: (href: string) => void;
  getBadgeCount?: (item: SidebarNavItem) => number;
}

export function SidebarDropdownGroup({
  label,
  icon: GroupIcon,
  items,
  isActive,
  onNavigate,
  getBadgeCount,
}: SidebarDropdownGroupProps) {
  const groupActive = items.some((item) => isActive(item.href));
  const totalBadge = getBadgeCount
    ? items.reduce((sum, item) => sum + getBadgeCount(item), 0)
    : 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <DockIcon>
          <button
            aria-label={label}
            aria-haspopup="menu"
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              groupActive
                ? "bg-primary text-primary-foreground shadow-lg scale-110"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <GroupIcon className="size-5" />
            {totalBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-destructive text-[9px] font-black text-destructive-foreground flex items-center justify-center leading-none animate-pulse">
                {totalBadge > 9 ? "9+" : totalBadge}
              </span>
            )}
          </button>
        </DockIcon>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="right"
        align="center"
        sideOffset={12}
        className="w-[228px] rounded-2xl border border-border/70 bg-background/95 p-1.5 shadow-2xl"
      >
        <DropdownMenuLabel className="px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground/80">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-2 my-1" />

        {items.map((item) => {
          const ItemIcon = item.icon;
          const active = isActive(item.href);
          const badgeCount = getBadgeCount ? getBadgeCount(item) : 0;

          return (
            <DropdownMenuItem
              key={item.href}
              onSelect={() => onNavigate(item.href)}
              className={cn(
                "cursor-pointer rounded-xl px-3 py-2.5 data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
                active && "bg-primary/10 text-primary",
              )}
            >
              <ItemIcon
                className={cn(
                  "h-4 w-4",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              {badgeCount > 0 && (
                <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black leading-none text-destructive-foreground">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
