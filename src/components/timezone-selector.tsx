"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Globe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TIMEZONE_LIST,
  getTimezonesByRegion,
  getCurrentTimeInTz,
  type TimezoneOption,
} from "@/lib/timezone-list";

type Props = {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
};

export function TimezoneSelector({ value, onChange, disabled }: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [currentTime, setCurrentTime] = React.useState(() =>
    getCurrentTimeInTz(value),
  );
  const [suggestedTz, setSuggestedTz] = React.useState<string | null>(null);

  // Actualizar preview de hora cada minuto
  React.useEffect(() => {
    setCurrentTime(getCurrentTimeInTz(value));
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeInTz(value));
    }, 60_000);
    return () => clearInterval(interval);
  }, [value]);

  // El navegador solo aporta una sugerencia UX, nunca la timezone operativa.
  React.useEffect(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz && browserTz !== value) {
        const exists = TIMEZONE_LIST.some((tz) => tz.value === browserTz);
        if (exists) setSuggestedTz(browserTz);
        else setSuggestedTz(null);
        return;
      }

      setSuggestedTz(null);
    } catch {
      setSuggestedTz(null);
    }
  }, [value]);

  const selectedOption = TIMEZONE_LIST.find((tz) => tz.value === value);

  const filteredByRegion = React.useMemo(() => {
    const groups = getTimezonesByRegion();
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    const filtered: Record<string, TimezoneOption[]> = {};
    for (const [region, options] of Object.entries(groups)) {
      const matches = options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          o.offsetLabel.toLowerCase().includes(q),
      );
      if (matches.length > 0) filtered[region] = matches;
    }
    return filtered;
  }, [search]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-11 rounded-xl border-border/50 bg-background font-normal"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate text-sm">
                {selectedOption?.label ?? value}
              </span>
              {selectedOption && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {selectedOption.offsetLabel}
                </span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[480px] max-w-[90vw] p-0 rounded-xl shadow-xl"
          align="start"
          sideOffset={6}
        >
          {/* Search box */}
          <div className="p-3 border-b border-border/50">
            <Input
              placeholder="Buscar zona horaria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-lg border-border/50"
              autoFocus
            />
          </div>

          {/* Scrollable list */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1">
            {Object.entries(filteredByRegion).map(([region, options]) => (
              <div key={region}>
                <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {region}
                </p>
                {options.map((tz) => (
                  <button
                    key={tz.value}
                    onClick={() => {
                      onChange(tz.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      value === tz.value &&
                        "bg-primary/10 text-primary font-semibold",
                    )}
                  >
                    <span className="truncate">{tz.label}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {tz.offsetLabel}
                      </span>
                      {value === tz.value && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}

            {Object.keys(filteredByRegion).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin resultados para &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Preview de hora actual */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>
          Hora actual en esta zona:{" "}
          <span className="font-semibold text-foreground">{currentTime}</span>
        </span>
      </div>

      {/* Badge de sugerencia del navegador */}
      {suggestedTz && suggestedTz !== value && (
        <div className="flex items-center gap-2 px-1 flex-wrap">
          <Badge
            variant="outline"
            className="text-[10px] font-semibold border-primary/30 text-primary bg-primary/5 px-2 py-0.5 h-auto"
          >
            Sugerido por tu navegador
          </Badge>
          <span className="text-xs text-muted-foreground">
            {TIMEZONE_LIST.find((t) => t.value === suggestedTz)?.label ??
              suggestedTz}
          </span>
          <span className="text-[11px] text-muted-foreground/80">
            Solo como sugerencia visual.
          </span>
          <button
            onClick={() => {
              onChange(suggestedTz);
              setSuggestedTz(null);
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
