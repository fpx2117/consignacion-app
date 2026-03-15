/**
 * timezone-list.ts — Lista curada de zonas horarias IANA.
 *
 * ~80 entradas priorizando Latinoamérica con cobertura global.
 * offsetLabel es informativo; el offset real se calcula dinámicamente con Intl.
 */

export type TimezoneOption = {
  value: string;
  label: string;
  region: string;
  offsetLabel: string;
};

export const TIMEZONE_LIST: TimezoneOption[] = [
  // ── Sudamérica ──────────────────────────────────────────────────────────────
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (Argentina)",      region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Argentina/Cordoba",      label: "Córdoba (Argentina)",           region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Argentina/Mendoza",      label: "Mendoza (Argentina)",           region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Argentina/Salta",        label: "Salta (Argentina)",             region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Argentina/Tucuman",      label: "Tucumán (Argentina)",           region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Argentina/Jujuy",        label: "Jujuy (Argentina)",             region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Argentina/Rio_Gallegos", label: "Río Gallegos (Argentina)",      region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Argentina/Ushuaia",      label: "Ushuaia (Argentina)",           region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Santiago",               label: "Santiago (Chile)",              region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Punta_Arenas",           label: "Punta Arenas (Chile)",          region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Montevideo",             label: "Montevideo (Uruguay)",          region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Sao_Paulo",             label: "São Paulo (Brasil)",            region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Fortaleza",              label: "Fortaleza (Brasil)",            region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Recife",                 label: "Recife (Brasil)",               region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Manaus",                 label: "Manaus (Brasil)",               region: "Sudamérica",    offsetLabel: "UTC-4" },
  { value: "America/Belem",                  label: "Belém (Brasil)",                region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/La_Paz",                 label: "La Paz (Bolivia)",              region: "Sudamérica",    offsetLabel: "UTC-4" },
  { value: "America/Asuncion",               label: "Asunción (Paraguay)",           region: "Sudamérica",    offsetLabel: "UTC-4" },
  { value: "America/Bogota",                 label: "Bogotá (Colombia)",             region: "Sudamérica",    offsetLabel: "UTC-5" },
  { value: "America/Lima",                   label: "Lima (Perú)",                   region: "Sudamérica",    offsetLabel: "UTC-5" },
  { value: "America/Guayaquil",              label: "Guayaquil (Ecuador)",           region: "Sudamérica",    offsetLabel: "UTC-5" },
  { value: "America/Caracas",                label: "Caracas (Venezuela)",           region: "Sudamérica",    offsetLabel: "UTC-4" },
  { value: "America/Guyana",                 label: "Georgetown (Guyana)",           region: "Sudamérica",    offsetLabel: "UTC-4" },
  { value: "America/Paramaribo",             label: "Paramaribo (Surinam)",          region: "Sudamérica",    offsetLabel: "UTC-3" },
  { value: "America/Cayenne",                label: "Cayena (Guayana Francesa)",     region: "Sudamérica",    offsetLabel: "UTC-3" },
  // ── Centroamérica y Caribe ─────────────────────────────────────────────────
  { value: "America/Mexico_City",            label: "Ciudad de México (México Centro)", region: "Centroamérica", offsetLabel: "UTC-6" },
  { value: "America/Monterrey",              label: "Monterrey (México Norte)",      region: "Centroamérica", offsetLabel: "UTC-6" },
  { value: "America/Cancun",                 label: "Cancún (México Este)",          region: "Centroamérica", offsetLabel: "UTC-5" },
  { value: "America/Tijuana",                label: "Tijuana (México Noroeste)",     region: "Centroamérica", offsetLabel: "UTC-8" },
  { value: "America/Guatemala",              label: "Ciudad de Guatemala",           region: "Centroamérica", offsetLabel: "UTC-6" },
  { value: "America/El_Salvador",            label: "San Salvador",                  region: "Centroamérica", offsetLabel: "UTC-6" },
  { value: "America/Tegucigalpa",            label: "Tegucigalpa (Honduras)",        region: "Centroamérica", offsetLabel: "UTC-6" },
  { value: "America/Managua",               label: "Managua (Nicaragua)",           region: "Centroamérica", offsetLabel: "UTC-6" },
  { value: "America/Costa_Rica",             label: "San José (Costa Rica)",         region: "Centroamérica", offsetLabel: "UTC-6" },
  { value: "America/Panama",                 label: "Ciudad de Panamá",              region: "Centroamérica", offsetLabel: "UTC-5" },
  { value: "America/Havana",                 label: "La Habana (Cuba)",              region: "Centroamérica", offsetLabel: "UTC-5" },
  { value: "America/Santo_Domingo",          label: "Santo Domingo (Rep. Dom.)",     region: "Centroamérica", offsetLabel: "UTC-4" },
  { value: "America/Port-au-Prince",         label: "Puerto Príncipe (Haití)",       region: "Centroamérica", offsetLabel: "UTC-5" },
  { value: "America/Puerto_Rico",            label: "San Juan (Puerto Rico)",        region: "Centroamérica", offsetLabel: "UTC-4" },
  // ── Norteamérica ───────────────────────────────────────────────────────────
  { value: "America/New_York",               label: "Nueva York (EEUU Este)",        region: "Norteamérica",  offsetLabel: "UTC-5" },
  { value: "America/Chicago",                label: "Chicago (EEUU Central)",        region: "Norteamérica",  offsetLabel: "UTC-6" },
  { value: "America/Denver",                 label: "Denver (EEUU Montaña)",         region: "Norteamérica",  offsetLabel: "UTC-7" },
  { value: "America/Los_Angeles",            label: "Los Ángeles (EEUU Pacífico)",   region: "Norteamérica",  offsetLabel: "UTC-8" },
  { value: "America/Phoenix",                label: "Phoenix (Arizona, EEUU)",       region: "Norteamérica",  offsetLabel: "UTC-7" },
  { value: "America/Anchorage",              label: "Anchorage (Alaska)",            region: "Norteamérica",  offsetLabel: "UTC-9" },
  { value: "Pacific/Honolulu",               label: "Honolulú (Hawái)",              region: "Norteamérica",  offsetLabel: "UTC-10" },
  { value: "America/Toronto",                label: "Toronto (Canadá Este)",         region: "Norteamérica",  offsetLabel: "UTC-5" },
  { value: "America/Vancouver",              label: "Vancouver (Canadá Pacífico)",   region: "Norteamérica",  offsetLabel: "UTC-8" },
  // ── Europa ─────────────────────────────────────────────────────────────────
  { value: "Europe/Madrid",                  label: "Madrid (España)",               region: "Europa",        offsetLabel: "UTC+1" },
  { value: "Atlantic/Canary",                label: "Canarias (España)",             region: "Europa",        offsetLabel: "UTC+0" },
  { value: "Europe/Lisbon",                  label: "Lisboa (Portugal)",             region: "Europa",        offsetLabel: "UTC+0" },
  { value: "Europe/London",                  label: "Londres (Reino Unido)",         region: "Europa",        offsetLabel: "UTC+0" },
  { value: "Europe/Paris",                   label: "París (Francia)",               region: "Europa",        offsetLabel: "UTC+1" },
  { value: "Europe/Berlin",                  label: "Berlín (Alemania)",             region: "Europa",        offsetLabel: "UTC+1" },
  { value: "Europe/Rome",                    label: "Roma (Italia)",                 region: "Europa",        offsetLabel: "UTC+1" },
  { value: "Europe/Moscow",                  label: "Moscú (Rusia)",                 region: "Europa",        offsetLabel: "UTC+3" },
  { value: "Europe/Istanbul",                label: "Estambul (Turquía)",            region: "Europa",        offsetLabel: "UTC+3" },
  // ── Asia / Pacífico ────────────────────────────────────────────────────────
  { value: "Asia/Dubai",                     label: "Dubái (Emiratos Árabes)",       region: "Asia/Pacífico", offsetLabel: "UTC+4" },
  { value: "Asia/Kolkata",                   label: "Mumbai/Delhi (India)",          region: "Asia/Pacífico", offsetLabel: "UTC+5:30" },
  { value: "Asia/Dhaka",                     label: "Daca (Bangladés)",              region: "Asia/Pacífico", offsetLabel: "UTC+6" },
  { value: "Asia/Bangkok",                   label: "Bangkok (Tailandia)",           region: "Asia/Pacífico", offsetLabel: "UTC+7" },
  { value: "Asia/Singapore",                 label: "Singapur",                      region: "Asia/Pacífico", offsetLabel: "UTC+8" },
  { value: "Asia/Shanghai",                  label: "Shanghái (China)",              region: "Asia/Pacífico", offsetLabel: "UTC+8" },
  { value: "Asia/Tokyo",                     label: "Tokio (Japón)",                 region: "Asia/Pacífico", offsetLabel: "UTC+9" },
  { value: "Asia/Seoul",                     label: "Seúl (Corea del Sur)",          region: "Asia/Pacífico", offsetLabel: "UTC+9" },
  { value: "Australia/Sydney",               label: "Sídney (Australia Este)",       region: "Asia/Pacífico", offsetLabel: "UTC+11" },
  { value: "Australia/Perth",                label: "Perth (Australia Oeste)",       region: "Asia/Pacífico", offsetLabel: "UTC+8" },
  // ── África ─────────────────────────────────────────────────────────────────
  { value: "Africa/Cairo",                   label: "El Cairo (Egipto)",             region: "África",        offsetLabel: "UTC+2" },
  { value: "Africa/Johannesburg",            label: "Johannesburgo (Sudáfrica)",     region: "África",        offsetLabel: "UTC+2" },
  { value: "Africa/Lagos",                   label: "Lagos (Nigeria)",               region: "África",        offsetLabel: "UTC+1" },
  { value: "Africa/Nairobi",                 label: "Nairobi (Kenia)",               region: "África",        offsetLabel: "UTC+3" },
  { value: "Africa/Casablanca",              label: "Casablanca (Marruecos)",        region: "África",        offsetLabel: "UTC+1" },
  // ── Universal ──────────────────────────────────────────────────────────────
  { value: "UTC",                            label: "UTC (Universal)",               region: "Universal",     offsetLabel: "UTC+0" },
];

/** Retorna el offset actual de una timezone como string "UTC±X" calculado dinámicamente */
export function getOffsetLabel(tz: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";
  } catch {
    return "UTC";
  }
}

/** Retorna la hora actual en una timezone como string "HH:MM" */
export function getCurrentTimeInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "--:--";
  }
}

/** Retorna las opciones agrupadas por región */
export function getTimezonesByRegion(): Record<string, TimezoneOption[]> {
  const groups: Record<string, TimezoneOption[]> = {};
  for (const tz of TIMEZONE_LIST) {
    if (!groups[tz.region]) groups[tz.region] = [];
    groups[tz.region].push(tz);
  }
  return groups;
}
