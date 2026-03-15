import fs from "fs";
import path from "path";

/**
 * tailwind-inline.ts
 *
 * CSS mínimo que reemplaza el CDN de Tailwind en los templates de reportes PDF.
 *
 * PROBLEMA: Puppeteer en Railway no tiene acceso confiable a internet.
 * cdn.tailwindcss.com falla intermitentemente → página en blanco.
 *
 * SOLUCIÓN: Subset de utilidades Tailwind + fuente Geist inlineada como base64,
 * todo inlineado como string CSS — sin dependencias externas en runtime.
 */

export const TAILWIND_INLINE_CSS = `
/* ── Reset ─────────────────────────────────────────────────────────────────── */
*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e2e8f0}
html{line-height:1.5;-webkit-text-size-adjust:100%;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
body{margin:0;padding:0}
h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit;margin:0}
p{margin:0}
table{border-collapse:separate;border-spacing:0}
img{display:block;max-width:100%}

/* ── Display / Layout ───────────────────────────────────────────────────────── */
.block{display:block}.inline{display:inline}.flex{display:flex}.grid{display:grid}.hidden{display:none}.table{display:table}
.flex-col{flex-direction:column}.flex-row{flex-direction:row}
.flex-wrap{flex-wrap:wrap}.flex-nowrap{flex-wrap:nowrap}
.items-start{align-items:flex-start}.items-center{align-items:center}.items-end{align-items:flex-end}
.justify-start{justify-content:flex-start}.justify-center{justify-content:center}.justify-end{justify-content:flex-end}.justify-between{justify-content:space-between}
.flex-1{flex:1 1 0%}.flex-none{flex:none}.flex-shrink-0{flex-shrink:0}.min-w-0{min-width:0}
.self-start{align-self:flex-start}.self-center{align-self:center}.self-end{align-self:flex-end}
.gap-1{gap:0.25rem}.gap-2{gap:0.5rem}.gap-3{gap:0.75rem}.gap-4{gap:1rem}.gap-6{gap:1.5rem}.gap-8{gap:2rem}
.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}
.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.col-span-2{grid-column:span 2/span 2}.col-span-3{grid-column:span 3/span 3}

/* ── Positioning ────────────────────────────────────────────────────────────── */
.relative{position:relative}.absolute{position:absolute}
.top-0{top:0}.bottom-0{bottom:0}.left-0{left:0}.right-0{right:0}
.-top-1{top:-0.25rem}.-right-1{right:-0.25rem}
.z-10{z-index:10}.z-20{z-index:20}.overflow-hidden{overflow:hidden}

/* ── Spacing — padding ──────────────────────────────────────────────────────── */
.p-0{padding:0}.p-1{padding:0.25rem}.p-2{padding:0.5rem}.p-3{padding:0.75rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.p-6{padding:1.5rem}.p-8{padding:2rem}.p-10{padding:2.5rem}
.px-1{padding-left:.25rem;padding-right:.25rem}.px-2{padding-left:.5rem;padding-right:.5rem}.px-3{padding-left:.75rem;padding-right:.75rem}.px-4{padding-left:1rem;padding-right:1rem}
.px-5{padding-left:1.25rem;padding-right:1.25rem}.px-6{padding-left:1.5rem;padding-right:1.5rem}
.py-0{padding-top:0;padding-bottom:0}.py-1{padding-top:.25rem;padding-bottom:.25rem}.py-1\\.5{padding-top:.375rem;padding-bottom:.375rem}
.py-2{padding-top:.5rem;padding-bottom:.5rem}.py-2\\.5{padding-top:.625rem;padding-bottom:.625rem}
.py-3{padding-top:.75rem;padding-bottom:.75rem}.py-4{padding-top:1rem;padding-bottom:1rem}.py-6{padding-top:1.5rem;padding-bottom:1.5rem}
.pt-1{padding-top:.25rem}.pt-2{padding-top:.5rem}.pt-3{padding-top:.75rem}.pt-4{padding-top:1rem}.pt-6{padding-top:1.5rem}.pt-8{padding-top:2rem}
.pb-2{padding-bottom:.5rem}.pb-4{padding-bottom:1rem}.pb-6{padding-bottom:1.5rem}.pb-8{padding-bottom:2rem}
.pl-1{padding-left:.25rem}.pl-2{padding-left:.5rem}.pl-3{padding-left:.75rem}.pl-4{padding-left:1rem}
.pr-1{padding-right:.25rem}.pr-2{padding-right:.5rem}.pr-3{padding-right:.75rem}.pr-4{padding-right:1rem}

/* ── Spacing — margin ───────────────────────────────────────────────────────── */
.m-0{margin:0}.mx-auto{margin-left:auto;margin-right:auto}.ml-1{margin-left:.25rem}.ml-2{margin-left:.5rem}.ml-auto{margin-left:auto}
.mt-0{margin-top:0}.mt-1{margin-top:.25rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}.mt-6{margin-top:1.5rem}.mt-8{margin-top:2rem}
.mb-1{margin-bottom:.25rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}.mb-8{margin-bottom:2rem}
.space-y-1>*+*{margin-top:.25rem}.space-y-2>*+*{margin-top:.5rem}.space-y-3>*+*{margin-top:.75rem}.space-y-4>*+*{margin-top:1rem}.space-y-6>*+*{margin-top:1.5rem}

/* ── Sizing ─────────────────────────────────────────────────────────────────── */
.w-full{width:100%}.w-5{width:1.25rem}.w-6{width:1.5rem}.w-8{width:2rem}.w-10{width:2.5rem}.w-12{width:3rem}.w-14{width:3.5rem}.w-20{width:5rem}
.h-full{height:100%}.h-3{height:.75rem}.h-4{height:1rem}.h-5{height:1.25rem}.h-6{height:1.5rem}.h-8{height:2rem}.h-10{height:2.5rem}.h-12{height:3rem}.h-14{height:3.5rem}.h-20{height:5rem}
.h-1{height:.25rem}.h-1\\.5{height:.375rem}
.max-w-\\[210mm\\]{max-width:210mm}.min-w-0{min-width:0}

/* ── Typography ─────────────────────────────────────────────────────────────── */
.text-\\[9px\\]{font-size:9px}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.text-\\[12px\\]{font-size:12px}
.text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}
.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}
.text-xl{font-size:1.25rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}
.text-3xl{font-size:1.875rem;line-height:2.25rem}
.font-normal{font-weight:400}.font-medium{font-weight:500}.font-semibold{font-weight:600}
.font-bold{font-weight:700}.font-black{font-weight:900}
.tracking-tight{letter-spacing:-.025em}.tracking-wide{letter-spacing:.025em}.tracking-wider{letter-spacing:.05em}.tracking-widest{letter-spacing:.1em}
.tracking-\\[0\\.2em\\]{letter-spacing:.2em}.tracking-\\[0\\.3em\\]{letter-spacing:.3em}
.uppercase{text-transform:uppercase}.capitalize{text-transform:capitalize}
.leading-none{line-height:1}.leading-tight{line-height:1.25}.leading-snug{line-height:1.375}.leading-relaxed{line-height:1.625}
.text-left{text-align:left}.text-center{text-align:center}.text-right{text-align:right}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.break-all{word-break:break-all}
.whitespace-nowrap{white-space:nowrap}
.underline{text-decoration-line:underline}
.line-through{text-decoration-line:line-through}

/* ── Colors — backgrounds ───────────────────────────────────────────────────── */
.bg-white{background-color:#fff}
.bg-slate-50{background-color:#f8fafc}.bg-slate-100{background-color:#f1f5f9}
.bg-slate-800{background-color:#1e293b}.bg-slate-900{background-color:#0f172a}
.bg-sky-700{background-color:#0369a1}
.bg-blue-600{background-color:#2563eb}.bg-blue-50{background-color:#eff6ff}
.bg-indigo-600{background-color:#4f46e5}.bg-indigo-50{background-color:#eef2ff}
.bg-emerald-600{background-color:#059669}.bg-emerald-100{background-color:#d1fae5}
.bg-rose-600{background-color:#e11d48}.bg-rose-50{background-color:#fff1f2}
.bg-amber-50{background-color:#fffbeb}.bg-orange-50{background-color:#fff7ed}
.bg-red-50{background-color:#fef2f2}.bg-red-100{background-color:#fee2e2}
.bg-green-50{background-color:#f0fdf4}.bg-green-100{background-color:#dcfce7}
.bg-violet-600{background-color:#7c3aed}.bg-teal-600{background-color:#0d9488}
.bg-transparent{background-color:transparent}

/* ── Colors — text ──────────────────────────────────────────────────────────── */
.text-white{color:#fff}
.text-slate-900{color:#0f172a}.text-slate-800{color:#1e293b}.text-slate-700{color:#334155}
.text-slate-600{color:#475569}.text-slate-500{color:#64748b}.text-slate-400{color:#94a3b8}.text-slate-300{color:#cbd5e1}
.text-sky-600{color:#0284c7}.text-sky-700{color:#0369a1}
.text-blue-700{color:#1d4ed8}
.text-indigo-700{color:#4338ca}
.text-emerald-600{color:#059669}.text-emerald-700{color:#047857}
.text-green-600{color:#16a34a}
.text-red-500{color:#ef4444}.text-red-600{color:#dc2626}.text-red-700{color:#b91c1c}
.text-rose-600{color:#e11d48}
.text-amber-600{color:#d97706}.text-orange-700{color:#c2410c}
.text-violet-600{color:#7c3aed}
.text-teal-600{color:#0d9488}

/* ── Borders ────────────────────────────────────────────────────────────────── */
.border{border-width:1px}.border-0{border-width:0}.border-t{border-top-width:1px}.border-b{border-bottom-width:1px}.border-l{border-left-width:1px}.border-r{border-right-width:1px}
.border-y{border-top-width:1px;border-bottom-width:1px}
.border-2{border-width:2px}.border-t-2{border-top-width:2px}.border-b-2{border-bottom-width:2px}
.border-t-\\[12px\\]{border-top-width:12px}
.border-slate-100{border-color:#f1f5f9}.border-slate-200{border-color:#e2e8f0}.border-slate-300{border-color:#cbd5e1}.border-slate-900{border-color:#0f172a}
.border-sky-700{border-color:#0369a1}.border-blue-600{border-color:#2563eb}
.border-indigo-700{border-color:#4338ca}.border-indigo-900{border-color:#312e81}
.border-emerald-200{border-color:#a7f3d0}
.border-red-200{border-color:#fecaca}
.border-white{border-color:#fff}

/* ── Border radius ───────────────────────────────────────────────────────────── */
.rounded{border-radius:.25rem}.rounded-sm{border-radius:.125rem}.rounded-md{border-radius:.375rem}
.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-3xl{border-radius:1.5rem}.rounded-full{border-radius:9999px}
.rounded-l-xl{border-radius:.75rem 0 0 .75rem}.rounded-r-xl{border-radius:0 .75rem .75rem 0}

/* ── Shadows ─────────────────────────────────────────────────────────────────── */
.shadow-sm{box-shadow:0 1px 2px 0 rgba(0,0,0,.05)}.shadow{box-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1)}
.shadow-lg{box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)}
.shadow-xl{box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)}

/* ── Misc ────────────────────────────────────────────────────────────────────── */
.opacity-60{opacity:.6}.opacity-80{opacity:.8}
.ring-1{box-shadow:0 0 0 1px rgba(0,0,0,.05)}
.blur-2xl{filter:blur(40px)}
.inline-block{display:inline-block}
.object-contain{object-fit:contain}
.cursor-default{cursor:default}
`;

/**
 * Reemplaza el bloque de CDN+Google Fonts por CSS inline + sistema de fuentes local.
 * Usar en todos los templates de reportes en vez de:
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   @import url('https://fonts.googleapis.com/...')
 */
// ── Fuente Geist inlineada como base64 ────────────────────────────────────────

function loadGeistBase64(): string {
  try {
    // En Railway y producción, la fuente está en node_modules de Next.js
    const candidates = [
      path.join(process.cwd(), "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2"),
      path.join(process.cwd(), "node_modules/next/dist/esm/next-devtools/server/font/geist-latin.woff2"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p).toString("base64");
      }
    }
  } catch {
    // silently fallback — sistema usará font stack de sistema
  }
  return "";
}

// Cargado una sola vez en startup (no en cada request)
const GEIST_B64 = loadGeistBase64();

const GEIST_FONT_CSS = GEIST_B64
  ? `@font-face {
    font-family: 'Geist';
    font-style: normal;
    font-weight: 100 900;
    src: url('data:font/woff2;base64,${GEIST_B64}') format('woff2');
  }`
  : "";

const FONT_STACK = GEIST_B64
  ? `'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  : `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export function getReportHeadAssets(extraCss = ""): string {
  return `
<style>
${GEIST_FONT_CSS}
${TAILWIND_INLINE_CSS}
${extraCss}
body {
  font-family: ${FONT_STACK};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
</style>`;
}
