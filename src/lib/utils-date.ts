/**
 * Timezone-safe date utilities.
 *
 * Dates stored as "YYYY-MM-DD HH:mm:ss" in the DB are parsed as UTC by
 * JavaScript.  These helpers treat them as **calendar dates** (no TZ shift)
 * so "2026-02-21 00:00:00" always renders as 21 feb, regardless of the
 * user's local offset.
 */

/** Days between a UTC date and today (positive = future). */
export function diffDaysUTC(dateStr: string | Date): number {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    const now = new Date();
    const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const targetUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.ceil((targetUTC - todayUTC) / 86_400_000);
}

/** Is the date in the past? */
export function isExpired(dateStr: string | Date): boolean {
    return diffDaysUTC(dateStr) < 0;
}

/** Will it expire within `days` days (default 7)? */
export function isExpiringSoon(dateStr: string | Date, days = 7): boolean {
    const diff = diffDaysUTC(dateStr);
    return diff >= 0 && diff <= days;
}

/**
 * Format a date string for display in es-AR, timezone-safe.
 *
 * @param dateStr  ISO / DB date string or Date object
 * @param opts     Intl.DateTimeFormatOptions overrides
 */
export function formatDateSafe(
    dateStr: string | Date | null | undefined,
    opts?: Intl.DateTimeFormatOptions,
): string {
    if (!dateStr) return "";
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
        ...opts,
    });
}

/**
 * Full date+time formatter for reports / timestamps.
 * Uses the user's local timezone (not UTC) because these represent real
 * moments in time, not calendar-only dates.
 */
export function formatDateTimeAR(
    dateStr: string | Date | null | undefined,
    includeTime = true,
): string {
    if (!dateStr) return "—";
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return "—";

    const base: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    };

    if (includeTime) {
        base.hour = "2-digit";
        base.minute = "2-digit";
    }

    return d.toLocaleDateString("es-AR", base);
}
