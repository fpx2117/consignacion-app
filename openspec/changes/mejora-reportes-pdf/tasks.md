# Tasks: Mejora Visual de Reportes PDF

## Fase 1: Setup y CSS Base

| # | Task | Status | Descripción |
|---|------|--------|-------------|
| 1.1 | [ ] | Instalar dependencias (qrcode, jsbarcode) | `npm install qrcode jsbarcode @types/qrcode @types/jsbarcode` |
| 1.2 | [ ] | Actualizar tailwind-inline.ts con Google Fonts | Agregar import de Poppins + Open Sans al CSS base |
| 1.3 | [ ] | Agregar fallback fonts del sistema | Asegurar que si Google Fonts falla, Use fuentes del sistema |
| 1.4 | [ ] | Testing CSS base en dev | Verificar que las fuentes se cargan |
| 1.5 | [ ] | Build para verificar | `npm run build` pasa sin errores |

## Fase 2: Templates Principales

| # | Task | Status | Descripción |
|---|------|--------|-------------|
| 2.1 | [ ] | Mejorar venta-report-template.ts | Reducir padding, ajustar cajas, mejorar spacing |
| 2.2 | [ ] | Agregar QR al ticket de venta | Generar QR con ID de venta + timestamp |
| 2.3 | [ ] | Mejorar pos-report-template.ts | Agregar sección métodos de pago |
| 2.4 | [ ] | Agregar ticket promedio al POS | Calcular y mostrar ticket promedio |
| 2.5 | [ ] | Mejorar consignacion-report-template.ts | Estados detallados, tasa de rotación |
| 2.6 | [ ] | Testing templates Fase 2 | Generar PDFs y verificar visualmente |

## Fase 3: Templates Secundarios

| # | Task | Status | Descripción |
|---|------|--------|-------------|
| 3.1 | [ ] | Mejorar dashboard-report-template.ts | Badges visuales en KPIs |
| 3.2 | [ ] | Mejorar gasto-report-template.ts | Agregar código de barras |
| 3.3 | [ ] | Mejorar remito-template.ts | Logo más grande, mejor tabla |
| 3.4 | [ ] | Mejorar inventory-report-template.ts | Alertas de stock mínimo |
| 3.5 | [ ] | Testing templates Fase 3 | Generar PDFs y verificar |

## Fase 4: Testing y QA

| # | Task | Status | Descripción |
|---|------|--------|-------------|
| 4.1 | [ ] | Testing en producción (Railway) | Verificar PDFs en entorno real |
| 4.2 | [ ] | Verificar tiempos de generación | No debe aumentar >2s por reporte |
| 4.3 | [ ] | Ajustes finales | Corregir cualquier issue visual |
| 4.4 | [ ] | Commit final | `git commit -m "feat(reports): improve PDF visual design"` |
| 4.5 | [ ] | Push a producción | `git push` |

---

## Checklist de Calidad Visual

### Fuentes
- [ ] Poppins carga para headings
- [ ] Open Sans carga para body
- [ ] Fallback fonts funcionan si no hay internet

### Layout
- [ ] Ningún texto sobresale de las cajas
- [ ] Padding consistente (8px, 16px, 24px, 32px)
- [ ] Márgenes uniformes
- [ ] Imágenes/logos no pixelados

### Colores
- [ ] Primary Navy (#0F172A) en headers
- [ ] Sky Blue (#0369A1) en CTAs
- [ ] Colores de estado正确 (success/warning/danger)

### Contenido
- [ ] Información adicional visible según specs
- [ ] Código QR legible
- [ ] Códigos de barras scaneables

---

## Notas de Implementación

### Generación de QR
```typescript
import QRCode from 'qrcode';

const qrDataUrl = await QRCode.toDataURL(`Venta-${id}-${timestamp}`, {
  width: 100,
  margin: 1,
  color: { dark: '#0F172A', light: '#FFFFFF' }
});
```

### Generación de Código de Barras
```javascript
// En el template HTML, usar JsBarcode:
<img src="data:image/svg+xml;base64,..." />
// O generar server-side con jsbarcode
```

### Testing Local
```bash
# Generar PDF de prueba
curl "http://localhost:3000/api/ver/pos/today/pdf?code=TU_CODE" -o test-pos.pdf

# Comparar con anterior
# (usar herramienta visual de comparación de PDFs)
```
