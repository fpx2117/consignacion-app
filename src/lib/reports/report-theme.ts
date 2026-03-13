import { COLOR_TOKENS } from "@/lib/theme/color-tokens";

export const REPORT_COLORS = {
  paper: COLOR_TOKENS.reportPaper,
  surface: COLOR_TOKENS.reportSurface,
  line: COLOR_TOKENS.reportLine,
  lineSoft: COLOR_TOKENS.reportLineSoft,
  text: COLOR_TOKENS.reportText,
  textStrong: COLOR_TOKENS.reportTextStrong,
  textMuted: COLOR_TOKENS.reportTextMuted,
  textSubtle: COLOR_TOKENS.reportTextSubtle,
  success: COLOR_TOKENS.statusSuccess,
  successStrong: COLOR_TOKENS.statusSuccessStrong,
  danger: COLOR_TOKENS.statusDanger,
  warning: COLOR_TOKENS.statusWarning,
  info: COLOR_TOKENS.themeOceanPrimary,
  accentBlue: COLOR_TOKENS.reportAccentBlue,
  accentViolet: COLOR_TOKENS.swatch11,
  accentAmber: COLOR_TOKENS.reportAccentAmber,
  rose: COLOR_TOKENS.reportRose,
  ownBg: COLOR_TOKENS.reportOwnBg,
  ownText: COLOR_TOKENS.reportOwnText,
  sharedBg: COLOR_TOKENS.reportSharedBg,
  sharedText: COLOR_TOKENS.reportSharedText,
  brandDefault: COLOR_TOKENS.brandDefaultPrimary,
} as const;

export function reportThemeCss(primaryColor?: string): string {
  const c = primaryColor || REPORT_COLORS.brandDefault;
  return `
    :root {
      --report-paper: ${REPORT_COLORS.paper};
      --report-surface: ${REPORT_COLORS.surface};
      --report-line: ${REPORT_COLORS.line};
      --report-line-soft: ${REPORT_COLORS.lineSoft};
      --report-text: ${REPORT_COLORS.text};
      --report-text-strong: ${REPORT_COLORS.textStrong};
      --report-text-muted: ${REPORT_COLORS.textMuted};
      --report-text-subtle: ${REPORT_COLORS.textSubtle};
      --report-primary: ${c};
      --report-success: ${REPORT_COLORS.success};
      --report-success-strong: ${REPORT_COLORS.successStrong};
      --report-danger: ${REPORT_COLORS.danger};
      --report-warning: ${REPORT_COLORS.warning};
      --report-info: ${REPORT_COLORS.info};
      --report-violet: ${REPORT_COLORS.accentViolet};
      --report-blue: ${REPORT_COLORS.accentBlue};
      --report-amber: ${REPORT_COLORS.accentAmber};
      --report-rose: ${REPORT_COLORS.rose};
      --report-own-bg: ${REPORT_COLORS.ownBg};
      --report-own-text: ${REPORT_COLORS.ownText};
      --report-shared-bg: ${REPORT_COLORS.sharedBg};
      --report-shared-text: ${REPORT_COLORS.sharedText};
    }

    .bg-white{background-color:var(--report-paper)!important}
    .bg-slate-50{background-color:var(--report-surface)!important}
    .bg-slate-100{background-color:var(--report-line-soft)!important}
    .bg-slate-900{background-color:var(--report-text)!important}
    .bg-emerald-600{background-color:var(--report-success)!important}
    .bg-indigo-700{background-color:var(--report-primary)!important}
    .bg-sky-700{background-color:var(--report-blue)!important}
    .bg-red-50{background-color:var(--report-own-bg)!important}
    .bg-red-100{background-color:var(--report-own-bg)!important}
    .bg-orange-50,.bg-amber-50{background-color:var(--report-shared-bg)!important}
    .bg-emerald-100{background-color:color-mix(in srgb,var(--report-success) 18%, white)!important}

    .text-slate-900{color:var(--report-text)!important}
    .text-slate-800{color:var(--report-text-strong)!important}
    .text-slate-700{color:var(--report-text-muted)!important}
    .text-slate-600{color:var(--report-text-muted)!important}
    .text-slate-500,.text-slate-400,.text-slate-300{color:var(--report-text-subtle)!important}
    .text-emerald-600,.text-emerald-700{color:var(--report-success)!important}
    .text-red-700,.text-red-600,.text-red-500{color:var(--report-danger)!important}
    .text-rose-600{color:var(--report-rose)!important}
    .text-sky-600{color:var(--report-blue)!important}
    .text-amber-600,.text-orange-700{color:var(--report-warning)!important}
    .text-indigo-700{color:var(--report-primary)!important}

    .border-slate-100{border-color:var(--report-line-soft)!important}
    .border-slate-200{border-color:var(--report-line)!important}
    .border-slate-900{border-color:var(--report-text)!important}
    .border-emerald-200{border-color:color-mix(in srgb,var(--report-success) 35%, white)!important}
    .border-red-200{border-color:color-mix(in srgb,var(--report-danger) 25%, white)!important}
    .border-indigo-700{border-color:var(--report-primary)!important}
    .border-sky-700{border-color:var(--report-blue)!important}
  `;
}
