# Propuesta: Mejora Visual de Reportes PDF

## Intencion

Mejorar la calidad visual de todos los reportes PDF del sistema POS (tickets, reportes de ventas, consignaciones, dashboard, gastos, remitos, inventario) para que tengan un aspecto profesional, moderno y corporativo. El objetivo es que los reportes transmitan confianza y autoridad, utilizando un sistema de diseño consistente con fuentes profesionales, mejor distribución del contenido y taille de cajas adaptadas al texto.

## Alcance

### Dentro del alcance

1. **Sistema de diseño unificado**
   - Implementar fuentes profesionales: **Poppins** (headings) + **Open Sans** (body)
   - Actualizar `tailwind-inline.ts` para incluir Google Fonts via CDN
   - Definir paleta de colores profesional: Navy (#0F172A) + Sky Blue CTA (#0369A1)

2. **Mejoras en todos los templates de reportes**
   - `venta-report-template.ts` (Ticket de Venta)
   - `pos-report-template.ts` (Reporte POS)
   - `consignacion-report-template.ts` (Reporte Consignaciones)
   - `dashboard-report-template.ts` (Reporte Dashboard)
   - `gasto-report-template.ts` (Comprobante de Gasto)
   - `remito-template.ts` (Remito)
   - `inventory-report-template.ts` (Inventario)

3. **Ajustes visuales específicos**
   - Reducir padding excesivo (p-12 → p-6 o p-8)
   - Ajustar taille de cajas al contenido (evitar texto que sobresale)
   - Mejorar spacing entre secciones
   - Unificar bordes, sombras y border-radius
   - Agregar gradientes sutiles donde corresponda

4. **Información adicional por reporte**

   | Reporte | Información a agregar |
   |---------|---------------------|
   | Ticket de Venta | Código QR de verificación, datos completos cliente |
   | POS | Desglose por método de pago, ticket promedio |
   | Consignaciones | Estado detallado, tasa de rotación por cliente |
   | Dashboard | KPIs con badges visuales de estado |
   | Gasto | Código de barras, detalles de categoría |
   | Remito | Logo más grande, tabla mejorada |
   | Inventario | Stock mínimo destacado, alertas visuales |

### Fuera del alcance

- Cambiar el motor de generación de PDFs (se mantiene Puppeteer)
- Modificar la lógica de negocio de los reportes
- Agregar charts/gráficos complejos (solo mejoras visuales simples)
- Exportar a otros formatos (PDF only)

## Enfoque

El enfoque es de **mejora visual incremental** manteniendo la estructura existente:

1. **Primero**: Actualizar el CSS base (fuentes y theme) en `tailwind-inline.ts`
2. **Segundo**: Ajustar cada template individualmente, verificando que el PDF renderice correctamente
3. **Tercero**: Testing visual y ajustes menores

Se utiliza el estilo "Trust & Authority" apropiado para documentos empresariales:
- Colores conservadores (navy, blues)
- Tipografía legible y profesional
- Espaciado generoso
- Jerarquía visual clara

## Areas afectadas

| Area | Impacto | Descripcion |
|------|---------|-------------|
| `src/lib/reports/tailwind-inline.ts` | Modificado | Agregar Google Fonts (Poppins + Open Sans), mejorar CSS base |
| `src/lib/reports/base/venta-report-template.ts` | Modificado | Ajustar padding, fuentes, agregar código QR |
| `src/lib/reports/base/pos-report-template.ts` | Modificado | Agregar desglose métodos de pago |
| `src/lib/reports/base/consignacion-report-template.ts` | Modificado | Mejorar visualización de estados |
| `src/lib/reports/base/dashboard-report-template.ts` | Modificado | Agregar badges visuales a KPIs |
| `src/lib/reports/base/gasto-report-template.ts` | Modificado | Agregar código de barras |
| `src/lib/reports/base/remito-template.ts` | Modificado | Mejorar layout y logo |
| `src/lib/reports/base/inventory-report-template.ts` | Modificado | Agregar alertas de stock |

## Risks

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|-------------|
| Google Fonts no carga en Railway (sin internet) | Baja | Alto | Usar fuentes del sistema como fallback |
| Templates se rompen al cambiar CSS | Media | Alto | Testing en dev antes de push |
| Tamaño de PDFs aumenta por fuentes | Baja | Bajo | Fuentes se cachean en Puppeteer |

## Success Criteria

- [ ] Todos los reportes usan fuentes Poppins + Open Sans
- [ ] Ningún texto sobresale de las cajas/containeres
- [ ] Padding consistente entre reportes (p-6 a p-8)
- [ ] Colores uniformes según el sistema de diseño
- [ ] Información adicional visible en cada tipo de reporte
- [ ] PDFs generan correctamente en entorno de production (Railway)
