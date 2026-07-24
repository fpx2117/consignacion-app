# Roadmap de Futuras Funcionalidades

Este documento describe las posibles expansiones y mejoras para el sistema POS & Consignaciones, organizadas por prioridad y área de impacto.

## ✅ Hitos Recientemente Completados

_Funcionalidades mayores lanzadas en las últimas versiones._

- **Soporte para Gastos de Sucursal**: Módulo funcional para registrar gastos recurrentes, pagos y comprobantes.
- **Tienda Pública / Catálogo Propio**: Despliegue de un catálogo on-line independiente para que los clientes finales puedan explorar el inventario y sus fotos.
- **Multi-tenancy / Modelo SaaS**: El sistema ahora es capaz de soportar múltiples sucursales con configuraciones gráficas y facturación (Planes) independientes.
- **Centro de Notificaciones en Tiempo Real**: Notificaciones de sistema para eventos críticos, stock y suscripciones.

---

## 🟢 Corto Plazo: Mejoras Operativas

_Mejoras directas sobre el flujo actual para optimizar la usabilidad._

### 1. Transferencias entre Sucursales

- Permitir mover stock de una sucursal a otra con un documento de "Envío Interno".
- Confirmación de validación de recepción en la sucursal de destino.

### 2. Programa de Fidelización (Puntos)

- Sistema básico donde cada compra genera puntos (Cashback/Puntos) para el cliente recurrente.
- Canje de puntos por descuentos porcentuales en futuras ventas casuales.

## 🟡 Mediano Plazo: Expansión de Canales

_Nuevas formas de interactuar con el sistema y los clientes._

### 1. Aplicación Móvil Nativa

- Versión optimizada y nativa (iOS/Android) enfocada en:
  - Uso intensivo del escáner con la cámara del teléfono y portabilidad en depósitos.
  - Consulta rápida de stock y precios de forma ágil desde el salón de ventas.
  - Visualización de gráficas y reportes clave (KPI).

### 2. Integración con Marketplaces y E-commerce

- Sincronización bidireccional de stock y ventas con plataformas masivas como Tiendanube, Shopify o MercadoLibre.
- Unificación del embudo de ventas en el POS de Consignaciones.

### 3. Impresión Universal de Etiquetas Térmicas

- Generador masivo de etiquetas con código de barras y QR adaptativo.
- Soporte para integración transparente por red de impresoras térmicas ESC/POS e industriales (Zebra, Brother).

## 🔵 Largo Plazo: Inteligencia y Automatización

_Uso de tecnologías avanzadas para dar valor estratégico._

### 1. Predicción de Stock por IA

- Análisis histórico de ventas para sugerir cuándo comprar productos específicos.
- Alertas de "Stock Crítico" basadas en la velocidad de venta, no solo en un número fijo.

### 2. Modo Offline (Resiliencia)

- Permitir que el POS siga funcionando (venta casual) aunque se pierda la conexión a internet.
- Sincronización automática con la base de datos central al recuperar la conexión.

### 3. Asistente de Liquidación Inteligente

- Sugerencia automática de productos para "retirar" de una consignación basada en nula rotación durante X días.

---

## 🛠️ Mejoras Técnicas Propuestas

- **Testing E2E Continuo**: Implementación extensa de casos de test con Playwright para blindar regresiones sobre el pipeline de ventas de caja.
- **Log de Auditoría Avanzado**: Mejoras en el visualizador dentro del panel de administrador para trazabilidad absoluta de movimientos de stock manuales.
- **Exportación Contable (AFIP/Tango/Bejerman)**: Generación de salidas planas estructuradas para importar directamente en software contable gubernamental.
