# Diseño Técnico: Mejora Visual de Reportes PDF

## Sistema de Diseño

### Paleta de Colores

| Rol        | Color    | Hex     | Uso                                 |
| ---------- | -------- | ------- | ----------------------------------- |
| Primary    | Navy     | #0F172A | Headers, bordes superiores, acentos |
| Secondary  | Slate    | #334155 | Texto secundario, badges            |
| CTA        | Sky Blue | #0369A1 | Botones, links, highlights          |
| Background | White    | #FFFFFF | Fondo del documento                 |
| Surface    | Slate 50 | #F8FAFC | Fondos de secciones, tablas         |
| Success    | Emerald  | #059669 | Estados positivos, ganancias        |
| Warning    | Amber    | #D97706 | Estados de alerta                   |
| Danger     | Rose     | #E11D48 | Estados negativos, gastos           |

### Tipografía

```
Heading Font: Poppins
- h1: 700, 2rem (32px)
- h2: 700, 1.5rem (24px)
- h3: 700, 1.25rem (20px)
- h4: 600, 1rem (16px)

Body Font: Open Sans
- Regular: 400, 0.875rem (14px)
- Small: 400, 0.75rem (12px)
- Tiny: 400, 0.625rem (10px)
```

### CSS Base (tailwind-inline.ts)

```css
/* Google Fonts import */
@import url("https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap");

/* Font families */
body {
  font-family:
    "Open Sans",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  font-family:
    "Poppins",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

/* Fallback fonts */
.font-sans {
  font-family: "Open Sans", sans-serif;
}
.font-heading {
  font-family: "Poppins", sans-serif;
}
```

## Especificaciones por Template

### 1. Ticket de Venta (`venta-report-template.ts`)

**Cambios:**

- Padding: `p-12` → `p-8`
- Header: Logo 56px (w-14 → w-12), texto proportionally reducido
- Cajas de items: `min-h-` adaptativo
- Agregar sección de código QR (100x100px)
- Información cliente más completa

**Nueva estructura:**

```
┌─────────────────────────────────────────┐
│ [LOGO] Nombre del negocio        Serie │
│         Ticket de Venta           #-0001│
│         Dirección · Teléfono          │
├─────────────────────────────────────────┤
│ [Datos Cliente]           [TOTAL BOX]  │
│  Nombre                        $XXXX.XX │
│  Teléfono                      Método   │
├─────────────────────────────────────────┤
│ PRODUCTO    CANT   PRECIO   DESC   SUB  │
│ ─────────────────────────────────────── │
│ Item 1        2    $500    -$50   $950 │
│ Item 2        1    $300     -     $300 │
│ ─────────────────────────────────────── │
│                         Descuento: -$50 │
├─────────────────────────────────────────┤
│ [Código QR]                TOTAL: $1200 │
│                                     │
│         Gracias por su compra          │
└─────────────────────────────────────────┘
```

### 2. Reporte POS (`pos-report-template.ts`)

**Cambios:**

- Agregar sección de métodos de pago con chips visuales
- Agregar ticket promedio
- Mejorar tabla de tendencia

**Nueva estructura:**

```
┌─────────────────────────────────────────┐
│ Header con período y fecha              │
├─────────────────────────────────────────┤
│ KPIs: Ventas | Ganancia | Tickets      │
├─────────────────────────────────────────┤
│ Métodos de Pago:                       │
│ [Efectivo $XXX] [Tarjeta $XXX] [Trans] │
├─────────────────────────────────────────┤
│ Top Productos:                         │
│ 1. Producto A - 50u - $25,000         │
│ 2. Producto B - 30u - $15,000         │
├─────────────────────────────────────────┤
│ Tendencia Diaria (tabla mejorada)       │
└─────────────────────────────────────────┘
```

### 3. Reporte Consignaciones

**Cambios:**

- Agregar tasa de rotación por cliente
- Estado más detallado (Abierta/Cerrada/Vencida)
- Información de última liquidación

### 4. Reporte Dashboard

**Cambios:**

- Agregar badges visuales de estado a cada KPI
- Colores según rendimiento (verde/amarillo/rojo)
- Gráficos simples si es posible

### 5. Comprobante de Gasto

**Cambios:**

- Agregar código de barras (CODE128)
- Expandir información de categoría
- Mejorar diseño del monto total

### 6. Remito

**Cambios:**

- Logo más grande
- Tabla de productos con mejor spacing
- Información de cliente más visible

### 7. Inventario

**Cambios:**

- Destacar productos bajo stock mínimo
- Alertas visuales (borde amarillo/rojo)
- Mejor organización de columnas

## Componentes Reutilizables

### Función de código QR (nuevo)

```typescript
// src/lib/reports/qr-helper.ts
export function generateQRDataUrl(data: string): string {
  // Genera QR como data URL para embed en HTML
  // Usar librería qrcode o similar server-side
}
```

### Función de código de barras

```typescript
// src/lib/reports/barcode-helper.ts
export function generateBarcodeHTML(code: string): string {
  // Genera código de barras como SVG
  // Usar JsBarcode
}
```

## Validación Visual

### Checklist de rendering

- [ ] Fuentes se cargan correctamente
- [ ] No hay texto que exceda el container
- [ ] Espaciado uniforme (8px, 16px, 24px)
- [ ] Colores正确 (verificar contraste)
- [ ] Imágenes/logos no pixelados
- [ ] Código QR legible
- [ ] Barras de código scaneables

### Testing endev

1. Generar cada tipo de reporte
2. Abrir en Chrome y verificar render
3. Imprimir a PDF y verificar
4. Comparar con diseño original

## Dependencies Nuevas

| Paquete   | Versión | Uso                       |
| --------- | ------- | ------------------------- |
| qrcode    | ^1.5.3  | Generar códigos QR        |
| jsbarcode | ^3.11.6 | Generar códigos de barras |

Instalar con:

```bash
npm install qrcode jsbarcode @types/qrcode @types/jsbarcode
```

## Archivos a Modificar

```
src/lib/reports/
├── tailwind-inline.ts          [MODIFICAR] - Fuentes y CSS base
├── qr-helper.ts                [NUEVO] - Generador QR
├── barcode-helper.ts           [NUEVO] - Generador barcode
└── base/
    ├── venta-report-template.ts    [MODIFICAR]
    ├── pos-report-template.ts      [MODIFICAR]
    ├── consignacion-report-template.ts [MODIFICAR]
    ├── dashboard-report-template.ts    [MODIFICAR]
    ├── gasto-report-template.ts    [MODIFICAR]
    ├── remito-template.ts          [MODIFICAR]
    └── inventory-report-template.ts [MODIFICAR]
```
