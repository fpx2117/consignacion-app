# Tasks: Mejora Visual de Reportes PDF

> **Última revisión:** 2026-03-16 — Incorpora bugs críticos detectados en auditoría previa a implementación.

---

## Fase 0: Saneamiento de Base (BUGS CRÍTICOS — hacer ANTES de cualquier mejora visual)

> Bugs descubiertos en auditoría del código actual. Afectan el rendering hoy en producción.

| #   | Task | Status                                                          | Descripción                                                                                                                                                              |
| --- | ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 | [ ]  | Agregar clases faltantes en `tailwind-inline.ts` — lote 1       | `grid-cols-5`, `w-72`, `rounded-l-2xl`, `rounded-r-2xl`                                                                                                                  |
| 0.2 | [ ]  | Agregar clases faltantes en `tailwind-inline.ts` — lote 2       | `bg-rose-100`, `bg-rose-900`, `text-rose-700`, `border-rose-200`                                                                                                         |
| 0.3 | [ ]  | Agregar clases faltantes en `tailwind-inline.ts` — lote 3       | `text-amber-700`, `bg-amber-200`, `border-amber-100`                                                                                                                     |
| 0.4 | [ ]  | Agregar clases faltantes en `tailwind-inline.ts` — lote 4       | `bg-orange-100`, `text-orange-600`, `border-orange-200`, `text-[8px]`                                                                                                    |
| 0.5 | [ ]  | Centralizar helpers duplicados                                  | Reemplazar `e()`, `fmt()`, `fmtN()`, `brandInitials()` locales en `pos`, `consignacion`, `remito`, `inventory`, `history-inventory` por imports de `template-helpers.ts` |
| 0.6 | [ ]  | Corregir footer hardcodeado en `remito-template.ts`             | "Powered by AllData" → usar `branding.footerText` o nombre de empresa                                                                                                    |
| 0.7 | [ ]  | Corregir footer hardcodeado en `gasto-report-template.ts`       | "Antigravity POS" → usar branding dinámico                                                                                                                               |
| 0.8 | [ ]  | Migrar `dashboard-report-template.ts` a `getReportHeadAssets()` | Es el único template sin Tailwind inline; usar `TAILWIND_INLINE_CSS` para consistencia                                                                                   |
| 0.9 | [ ]  | Build de verificación post-saneamiento                          | `npm run build` sin errores — baseline limpio antes de Fase 1                                                                                                            |

---

## Fase 1: Setup y CSS Base

| #   | Task | Status                                                          | Descripción                                                                                                                                                          |
| --- | ---- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | [ ]  | Instalar dependencias (qrcode, jsbarcode)                       | `npm install qrcode jsbarcode @types/qrcode @types/jsbarcode`                                                                                                        |
| 1.2 | [ ]  | Resolver estrategia de fuentes para Railway                     | Railway no tiene acceso a CDN de Google Fonts en Puppeteer; evaluar: (a) embeber en base64 en `tailwind-inline.ts`, (b) usar fuentes del sistema con stack confiable |
| 1.3 | [ ]  | Actualizar `tailwind-inline.ts` con fuentes Poppins + Open Sans | Si se elige base64: agregar `@font-face` con fuente embebida; si se elige sistema: definir stack con Poppins como first choice y fallback robusto                    |
| 1.4 | [ ]  | Crear `src/lib/reports/qr-helper.ts`                            | Helper `generateQRDataUrl(data: string): Promise<string>` usando librería `qrcode`                                                                                   |
| 1.5 | [ ]  | Crear `src/lib/reports/barcode-helper.ts`                       | Helper `generateBarcodeHTML(code: string): string` usando `jsbarcode` — output SVG como data URL                                                                     |
| 1.6 | [ ]  | Testing CSS base en dev                                         | Verificar que las fuentes se renderizan correctamente en Puppeteer local                                                                                             |
| 1.7 | [ ]  | Build de verificación                                           | `npm run build` pasa sin errores                                                                                                                                     |

---

## Fase 2: Templates Principales

| #   | Task | Status                                                         | Descripción                                                                                                          |
| --- | ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 2.1 | [ ]  | Mejorar `venta-report-template.ts` — layout y spacing          | Reducir `p-12` → `p-8`, ajustar cajas de items, mejorar separación de secciones                                      |
| 2.2 | [ ]  | Agregar QR al ticket de venta                                  | Usar `generateQRDataUrl()` con `Venta-${id}-${timestamp}`; insertar imagen 100×100px en el footer                    |
| 2.3 | [ ]  | Unificar color primario en `venta-report-template.ts`          | Reemplazar `bg-indigo-600`/`border-indigo-900` hardcodeados por variables CSS del branding (`var(--report-primary)`) |
| 2.4 | [ ]  | Mejorar `pos-report-template.ts` — chips de métodos de pago    | Rediseñar chips con ícono SVG inline por método (efectivo/tarjeta/transferencia)                                     |
| 2.5 | [ ]  | Unificar helpers en `pos-report-template.ts`                   | Eliminar helpers locales duplicados; importar de `template-helpers.ts`                                               |
| 2.6 | [ ]  | Mejorar `consignacion-report-template.ts` — estados y rotación | Visualizar tasa de rotación con barra de progreso SVG; mejorar badges de estado (Abierta/Cerrada/Vencida)            |
| 2.7 | [ ]  | Unificar helpers en `consignacion-report-template.ts`          | Eliminar helpers locales duplicados                                                                                  |
| 2.8 | [ ]  | Testing templates Fase 2                                       | Generar PDFs de venta, POS y consignación; verificar visualmente fuentes, colores y QR                               |

---

## Fase 3: Templates Secundarios

| #   | Task | Status                                                           | Descripción                                                                                                                             |
| --- | ---- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | [ ]  | Mejorar `dashboard-report-template.ts` — badges visuales en KPIs | Agregar badge de estado por KPI (verde/amarillo/rojo según umbral); mantener arquitectura de inline styles ya unificada en Fase 0       |
| 3.2 | [ ]  | Mejorar `gasto-report-template.ts` — código de barras            | Usar `generateBarcodeHTML()` con `data.id`; insertar SVG en sección inferior del comprobante                                            |
| 3.3 | [ ]  | Mejorar `remito-template.ts` — layout y logo                     | Logo `w-16 h-16` (ya ok); mejorar tabla productos con spacing uniforme; tipado fuerte en `detalles` (reemplazar `unknown[]` + `as any`) |
| 3.4 | [ ]  | Unificar helpers en `remito-template.ts`                         | Eliminar helpers locales duplicados                                                                                                     |
| 3.5 | [ ]  | Mejorar `inventory-report-template.ts` — alertas de stock        | Destacar filas con stock bajo mínimo con borde rojo/naranja; barcode visual para `codigoBarra` con `generateBarcodeHTML()`              |
| 3.6 | [ ]  | Unificar helpers en `inventory-report-template.ts`               | Eliminar helpers locales duplicados; tipado fuerte reemplazando `(p as any)`                                                            |
| 3.7 | [ ]  | Mejorar `history-inventory-report.template.ts` — filas y badges  | Verificar que `rounded-l-2xl`/`rounded-r-2xl` y `bg-rose-900` ahora funcionen (saneados en Fase 0); ajustar si hay regresión visual     |
| 3.8 | [ ]  | Unificar helpers en `history-inventory-report.template.ts`       | Eliminar helpers locales duplicados                                                                                                     |
| 3.9 | [ ]  | Testing templates Fase 3                                         | Generar PDFs de dashboard, gasto, remito, inventario e historial; verificar visualmente                                                 |

---

## Fase 4: Testing y QA Final

| #   | Task | Status                                     | Descripción                                                                                  |
| --- | ---- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 4.1 | [ ]  | Testing end-to-end en dev con datos reales | Generar cada tipo de reporte desde la UI y abrir el PDF resultante                           |
| 4.2 | [ ]  | Verificar fuentes en Puppeteer headless    | Confirmar que las fuentes elegidas (base64 o sistema) se renderizan igual en local y Railway |
| 4.3 | [ ]  | Verificar tiempos de generación            | Cada reporte debe generar en < 4s (incluye QR/barcode); medir con `console.time`             |
| 4.4 | [ ]  | Checklist visual completo                  | Ver sección de checklist al pie de este archivo                                              |
| 4.5 | [ ]  | Ajustes finales                            | Corregir cualquier issue visual detectado en QA                                              |
| 4.6 | [ ]  | Commit final                               | `git commit -m "feat(reports): improve PDF visual design and fix CSS bugs"`                  |

---

## Checklist de Calidad Visual

### Bugs críticos saneados (Fase 0)

- [ ] `grid-cols-5` funciona — panel de productos en consignación visible
- [ ] `rounded-l-2xl` / `rounded-r-2xl` funciona — filas redondeadas en historial
- [ ] Badges "Salida" con estilos correctos (rose)
- [ ] Bloque de recurrencia en gastos con fondo amber visible
- [ ] Badges de stock crítico con fondo naranja visible
- [ ] Panel de totales en remito con ancho fijo (`w-72`)
- [ ] Footers dinámicos (no más "AllData" ni "Antigravity POS" hardcodeados)

### Fuentes

- [ ] Fuente heading (Poppins o stack equivalente) carga en Puppeteer
- [ ] Fuente body (Open Sans o stack equivalente) carga en Puppeteer
- [ ] Fallback funciona sin acceso a internet (Railway)

### Layout

- [ ] Ningún texto sobresale de las cajas
- [ ] Padding consistente (`p-6` a `p-10` según template)
- [ ] Márgenes uniformes
- [ ] Logos no pixelados

### Colores

- [ ] Color primario respeta `branding.primaryColor` (no hardcodeado)
- [ ] Colores de estado correctos (success/warning/danger)

### Contenido enriquecido

- [ ] Código QR legible en Ticket de Venta
- [ ] Código de barras scaneable en Gasto e Inventario
- [ ] KPIs del dashboard con badges de estado visual
- [ ] Tasa de rotación con barra de progreso en Consignaciones

---

## Notas de Implementación

### Estrategia de fuentes en Railway (IMPORTANTE)

Railway ejecuta Puppeteer en un contenedor sin acceso a `fonts.googleapis.com`.
**Opción recomendada:** Definir `@font-face` con las fuentes embebidas en base64 directamente en `tailwind-inline.ts`. Alternativa más simple: usar stack de sistema con fuentes garantizadas en Linux:

```css
body {
  font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
}
h1,
h2,
h3,
h4 {
  font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
  font-weight: 700;
}
```

### Generación de QR

```typescript
// src/lib/reports/qr-helper.ts
import QRCode from "qrcode";

export async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 100,
    margin: 1,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  });
}
```

### Generación de Código de Barras (server-side SVG)

```typescript
// src/lib/reports/barcode-helper.ts
// JsBarcode genera en DOM; para server-side usar con jsdom o svgdom
import JsBarcode from "jsbarcode";
import { createSVGWindow } from "svgdom"; // alternativa: xmldom

export function generateBarcodeSVG(code: string): string {
  const window = createSVGWindow();
  const document = window.document;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, code, {
    format: "CODE128",
    width: 1.5,
    height: 40,
    displayValue: true,
  });
  return svg.outerHTML;
}
```

> ⚠️ `jsbarcode` requiere entorno DOM. Evaluar usar `svgdom` o `@xmldom/xmldom` como peer. Alternativa: generar barcode como imagen PNG con librería `bwip-js` que no requiere DOM.

### Testing Local

```bash
# Generar PDF de prueba — ajustar endpoint según tipo de reporte
curl "http://localhost:3000/api/ver/pos/today/pdf?code=TU_CODE" -o test-pos.pdf
curl "http://localhost:3000/api/ver/venta/[ID]/pdf" -o test-venta.pdf
```

### Clases CSS faltantes a agregar en `tailwind-inline.ts` (Fase 0 — referencia)

```
grid-cols-5, w-72,
rounded-l-2xl, rounded-r-2xl,
bg-rose-100, bg-rose-900, text-rose-700, border-rose-200,
text-amber-700, bg-amber-200, border-amber-100,
bg-orange-100, text-orange-600, border-orange-200,
text-[8px]
```
