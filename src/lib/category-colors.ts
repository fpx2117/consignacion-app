// Shared palette for category colors
// Each key matches the `color` stored in DB (e.g. "sky", "rose")

export const CATEGORY_PALETTE = [
    { key: "sky", label: "Cielo", bg: "bg-sky-500/15", text: "text-sky-700 dark:text-sky-400", border: "border-sky-500/30", dot: "bg-sky-500", hex: "#0ea5e9" },
    { key: "rose", label: "Rosa", bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-400", border: "border-rose-500/30", dot: "bg-rose-500", hex: "#f43f5e" },
    { key: "amber", label: "Ámbar", bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/30", dot: "bg-amber-500", hex: "#f59e0b" },
    { key: "emerald", label: "Esmeralda", bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-500", hex: "#10b981" },
    { key: "violet", label: "Violeta", bg: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-400", border: "border-violet-500/30", dot: "bg-violet-500", hex: "#8b5cf6" },
    { key: "cyan", label: "Cian", bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-500/30", dot: "bg-cyan-500", hex: "#06b6d4" },
    { key: "pink", label: "Fucsia", bg: "bg-pink-500/15", text: "text-pink-700 dark:text-pink-400", border: "border-pink-500/30", dot: "bg-pink-500", hex: "#ec4899" },
    { key: "lime", label: "Lima", bg: "bg-lime-500/15", text: "text-lime-700 dark:text-lime-400", border: "border-lime-500/30", dot: "bg-lime-500", hex: "#84cc16" },
    { key: "orange", label: "Naranja", bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-400", border: "border-orange-500/30", dot: "bg-orange-500", hex: "#f97316" },
    { key: "teal", label: "Verde Azulado", bg: "bg-teal-500/15", text: "text-teal-700 dark:text-teal-400", border: "border-teal-500/30", dot: "bg-teal-500", hex: "#14b8a6" },
    { key: "indigo", label: "Índigo", bg: "bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-500/30", dot: "bg-indigo-500", hex: "#6366f1" },
    { key: "fuchsia", label: "Magenta", bg: "bg-fuchsia-500/15", text: "text-fuchsia-700 dark:text-fuchsia-400", border: "border-fuchsia-500/30", dot: "bg-fuchsia-500", hex: "#d946ef" },
] as const;

export type CategoryColorKey = typeof CATEGORY_PALETTE[number]["key"];

export function getCategoryColorByKey(key?: string | null) {
    return CATEGORY_PALETTE.find((c) => c.key === key) || CATEGORY_PALETTE[0];
}

// Fallback: hash-based assignment for categories without a stored color
export function getCategoryColorByName(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}
