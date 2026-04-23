# Diseño: Carrito de compra y checkout por WhatsApp en tienda pública

## Objetivo

Agregar un carrito funcional en la tienda pública (`/lista`) para que el usuario pueda:

1. agregar múltiples productos,
2. revisar cantidades y total,
3. completar datos mínimos,
4. finalizar el pedido abriendo WhatsApp al número configurado,
5. enviar un mensaje prearmado con los productos elegidos.

Este documento define la línea de implementación antes de editar código.

## Estado Actual

- La tienda pública ya existe y renderiza catálogo, filtros, cards, modal y footer.
- Ya existe un `CartDrawer`, pero hoy no es realmente utilizable porque el header no expone un botón visible para abrirlo.
- El flujo actual del drawer termina en Mercado Pago, no en WhatsApp.
- WhatsApp existe hoy solo para consulta de producto individual.
- El catálogo público ya trae `descuentoEfectivo`, por lo que el carrito puede reflejar precios con descuento sin recalcular desde cero.

## Problema a Resolver

Hoy la tienda tiene piezas sueltas, pero no un flujo de compra completo orientado a WhatsApp.

Faltan estos bloques:

- entrada visible al carrito,
- persistencia del carrito,
- mensaje multi-producto para WhatsApp,
- unificación del cálculo de precios,
- validaciones básicas de stock,
- una UX liviana para cerrar pedido sin pasar por un checkout pesado.

## Enfoque Técnico

La propuesta es reutilizar la base actual del catálogo y del drawer, pero cambiar el objetivo del flujo:

- dejar el carrito como contenedor principal de selección,
- reemplazar o complementar el cierre por Mercado Pago con un cierre por WhatsApp,
- centralizar el cálculo de precios para que tienda, drawer y mensaje final usen la misma lógica,
- soportar descuento activo y modo consignación sin inconsistencias.

## Decisiones de Arquitectura

### Decisión 1: Reutilizar el `CartDrawer` existente

**Elección**: extender el drawer actual en vez de crear un carrito nuevo.

**Alternativas consideradas**:
- crear un checkout nuevo desde cero,
- crear una página separada de carrito.

**Justificación**:
- ya existe estado, estructura visual y navegación por pasos,
- reduce costo de implementación,
- preserva la experiencia actual del catálogo.

### Decisión 2: Mantener WhatsApp por producto y agregar WhatsApp por carrito

**Elección**: convivir con ambos flujos.

**Alternativas consideradas**:
- reemplazar el botón por producto,
- eliminar el CTA individual.

**Justificación**:
- el CTA individual sirve para consultas rápidas,
- el carrito sirve para intención de compra real,
- ambos usos resuelven necesidades distintas.

### Decisión 3: Unificar el cálculo de precios en una utilidad compartida

**Elección**: crear una función reutilizable para obtener precio unitario efectivo, subtotal por ítem y total del carrito.

**Alternativas consideradas**:
- seguir calculando en cada componente,
- recalcular en el mensaje de WhatsApp con lógica inline.

**Justificación**:
- hoy el drawer mezcla precio base y precio con descuento,
- el catálogo muestra una cosa y el checkout puede usar otra,
- una sola fuente de verdad reduce errores.

### Decisión 4: Persistir carrito en `localStorage`

**Elección**: guardar el carrito por sucursal en almacenamiento local del navegador.

**Alternativas consideradas**:
- no persistir,
- persistir en backend.

**Justificación**:
- es suficiente para el caso de uso,
- evita perder selección al refrescar,
- no obliga a crear modelo de pedido todavía.

### Decisión 5: Checkout por WhatsApp como primer entregable

**Elección**: implementar primero el mensaje a WhatsApp y dejar Mercado Pago fuera del alcance inmediato de este cambio.

**Alternativas consideradas**:
- soportar Mercado Pago y WhatsApp al mismo tiempo en esta misma fase,
- rehacer todo el checkout actual.

**Justificación**:
- el requerimiento actual es claro: finalizar por WhatsApp,
- MP hoy tiene inconsistencias de pricing con descuentos y consignación,
- dividir por fases baja riesgo.

## Flujo Propuesto

```text
Usuario entra a /lista
   │
   ├─ agrega productos desde card o modal
   │
   ├─ abre carrito desde header o botón flotante
   │
   ├─ ajusta cantidades
   │
   ├─ completa datos mínimos
   │     - nombre
   │     - teléfono
   │     - método de entrega
   │     - dirección (si corresponde)
   │
   ├─ confirma pedido
   │
   ├─ frontend arma mensaje multi-item
   │
   └─ abre wa.me/<numero>?text=<mensaje>
```

## Alcance Funcional del Primer Entregable

### Incluye

- botón visible para abrir carrito,
- contador de ítems en header o botón flotante,
- persistencia del carrito,
- agregar, quitar y modificar cantidades,
- límite por stock disponible,
- total correcto contemplando descuento activo,
- generación de mensaje de WhatsApp con múltiples productos,
- uso del número configurado en settings,
- formulario liviano orientado a WhatsApp.

### No incluye en esta fase

- creación de pedido interno en base de datos,
- reserva de stock,
- pago online por Mercado Pago dentro del mismo flujo,
- seguimiento posterior del pedido,
- panel backoffice de pedidos WhatsApp.

## Contrato del Mensaje de WhatsApp

Formato propuesto:

```text
Hola! Quiero hacer un pedido desde la tienda.

Cliente: Juan Perez
Telefono: 11XXXXXXXX
Entrega: Retiro en local

Productos:
- 2 x Shampoo X - $12.000 c/u = $24.000
- 1 x Acondicionador Y - $8.500 c/u = $8.500

Total estimado: $32.500

Link tienda: https://.../lista
```

### Reglas del mensaje

- usar precio efectivo del carrito, no `precioVenta` crudo,
- si hay descuento, el precio unitario debe ser el final,
- no incluir datos vacíos,
- si el método es `RETIRO_LOCAL`, no pedir dirección obligatoria,
- si el método es envío, incluir dirección y código postal,
- si no hay número de WhatsApp configurado, bloquear la acción con mensaje claro.

## Datos mínimos sugeridos para el flujo WhatsApp

### Paso 1: Carrito
- productos,
- cantidades,
- subtotal,
- total.

### Paso 2: Datos del cliente
- nombre,
- teléfono,
- observaciones opcionales.

### Paso 3: Entrega
- retiro en local,
- envío a domicilio,
- retiro en sucursal.

Para la fase WhatsApp, conviene simplificar el formulario actual y no exigir email salvo que el negocio lo necesite.

## Cambios en Archivos

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/lista/catalog-client.tsx` | Modificar | Persistencia del carrito, apertura/cierre, helpers de carrito y callback final a WhatsApp |
| `src/app/lista/components/store-header.tsx` | Modificar | Mostrar CTA visible del carrito con contador |
| `src/app/lista/components/cart-drawer.tsx` | Modificar | Reorientar flujo del drawer a pedido por WhatsApp y simplificar formulario |
| `src/app/lista/components/product-card.tsx` | Modificar | Mantener agregar al carrito y eventualmente reforzar feedback de cantidad/stock |
| `src/app/lista/components/product-modal.tsx` | Modificar | Mantener agregar al carrito con misma lógica de pricing/stock |
| `src/lib/types.ts` | Modificar | Ajustar tipos del carrito y, si hace falta, tipar payload del mensaje WhatsApp |
| `src/lib/` | Crear | Utilidad compartida para cálculo de precios del carrito y util de mensaje WhatsApp |
| `src/app/(system-guard)/(protected)/settings/whatsapp/page.tsx` | Modificar | Opcional: agregar plantilla específica para pedido por carrito |
| `src/app/(system-guard)/(protected)/settings/whatsapp/components/TemplateEditor.tsx` | Modificar | Opcional: soportar variables del pedido por carrito |

## Nuevas Utilidades Recomendadas

### `src/lib/catalog-cart-pricing.ts`

Responsabilidad:
- resolver precio unitario efectivo,
- aplicar descuento efectivo,
- contemplar modo consignación si corresponde,
- devolver subtotal por ítem y total general.

Interfaz sugerida:

```ts
type CatalogCartPricingContext = {
  isConsigne: boolean;
  porcentajeAumentoConsignacion?: number;
};

type CatalogCartLine = {
  id: number;
  nombre: string;
  precioVenta: number | string | { toString(): string };
  quantity: number;
  descuentoEfectivo?: {
    precioFinal: number;
  } | null;
};

type CatalogCartLinePricing = {
  unitPrice: number;
  subtotal: number;
};

export function getCatalogCartLinePricing(
  item: CatalogCartLine,
  context: CatalogCartPricingContext,
): CatalogCartLinePricing;
```

### `src/lib/catalog-whatsapp.ts`

Responsabilidad:
- normalizar número,
- construir mensaje,
- devolver URL `wa.me`.

Interfaz sugerida:

```ts
type CatalogWhatsappCheckoutInput = {
  businessName?: string | null;
  whatsappNumber?: string | null;
  customerName: string;
  customerPhone?: string;
  deliveryMethod: "DOMICILIO" | "SUCURSAL" | "RETIRO_LOCAL";
  address?: string;
  postalCode?: string;
  notes?: string;
  items: Array<{
    nombre: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  total: number;
};

export function buildCatalogWhatsappUrl(input: CatalogWhatsappCheckoutInput): string | null;
```

## Riesgos y Edge Cases

### Riesgo 1: Inconsistencia de precios
- hoy la UI pública y el drawer no usan exactamente la misma lógica,
- si no se centraliza, el mensaje puede salir con totales distintos a lo que el usuario vio.

### Riesgo 2: Stock insuficiente
- hoy no hay tope fuerte al incrementar cantidad en carrito,
- el usuario podría intentar pedir más de lo disponible.

### Riesgo 3: Número de WhatsApp mal formateado
- `wa.me` requiere número limpio,
- si se usa el valor crudo con `+`, espacios o guiones puede fallar.

### Riesgo 4: Formulario demasiado pesado
- el flujo actual pide email y dirección demasiado temprano,
- para un pedido por WhatsApp eso agrega fricción innecesaria.

### Riesgo 5: Coexistencia con Mercado Pago
- si no se separa bien el alcance, se mezcla pedido por WhatsApp con checkout online y se duplica complejidad.

## Estrategia de Implementación por Fases

### Fase 1: Hacer visible y persistente el carrito
- agregar botón de carrito al header,
- persistir `cart` en `localStorage`,
- restaurar carrito al cargar,
- mostrar contador correcto.

### Fase 2: Unificar precios y stock
- crear util compartida de pricing,
- usarla en drawer y mensaje final,
- limitar cantidad por stock disponible,
- mostrar subtotales correctos.

### Fase 3: Checkout por WhatsApp
- simplificar pasos del drawer,
- pedir datos mínimos,
- construir URL de WhatsApp,
- abrir mensaje con items y total.

### Fase 4: Ajustes de configuración
- opcionalmente crear plantilla específica para carrito,
- dejar variables futuras para personalización.

## Estrategia de Pruebas

| Capa | Qué Probar | Enfoque |
|------|------------|---------|
| Unitaria | cálculo de precios del carrito | tests a utilidad de pricing |
| Unitaria | generación de URL/mensaje WhatsApp | tests a utilidad de formateo |
| Integración | agregar/quitar/cambiar cantidad | prueba desde `CatalogClient` + `CartDrawer` |
| Integración | persistencia de carrito | verificar restauración desde `localStorage` |
| Integración | stock máximo | impedir cantidad mayor al disponible |
| Manual/E2E | flujo completo hasta abrir WhatsApp | probar en `/lista` con productos con y sin descuento |

## Recomendación Final

La mejor línea para implementar este cambio es:

1. aprovechar el carrito actual,
2. desacoplarlo de Mercado Pago para esta fase,
3. cerrar por WhatsApp con mensaje multi-item,
4. centralizar pricing antes de tocar la UX final.

Así resolvemos el objetivo real del usuario sin arrastrar toda la complejidad del checkout online actual.

## Próximo Paso

Si este documento le cierra, el siguiente paso es implementar la **Fase 1 + Fase 2 + Fase 3** en ese orden.
