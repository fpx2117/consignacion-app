# Roadmap de Futuras Funcionalidades

Este documento describe las posibles expansiones y mejoras para el sistema POS & Consignaciones, organizadas por prioridad y área de impacto.

## 🟢 Corto Plazo: Mejoras Operativas
*Mejoras directas sobre el flujo actual para optimizar la usabilidad.*

### 1. Transferencias entre Sucursales
- Permitir mover stock de una sucursal a otra con un documento de "Envío Interno".
- Confirmación de recepción en la sucursal de destino.

### 2. Soporte para Gastos de Sucursal
- Módulo para registrar gastos (alquiler, servicios, sueldos) dentro de la sesión de caja.
- Reporte consolidado de Ganancia Neta (Ventas - Costos - Gastos).

### 3. Programa de Fidelización (Puntos)
- Sistema básico donde cada compra genera puntos para el cliente.
- Canje de puntos por descuentos en futuras ventas casuales.

---

## 🟡 Mediano Plazo: Expansión de Canales
*Nuevas formas de interactuar con el sistema y los clientes.*

### 1. Aplicación Móvil (PWA o Nativa)
- Versión optimizada para celulares enfocada en:
    - Lectura de códigos con la cámara del teléfono.
    - Consulta rápida de stock y precios en el salón de ventas.
    - Visualización de KPI para el dueño desde cualquier lugar.

### 2. Integración con E-commerce (Tienda Online)
- Sincronización automática de stock con plataformas como Tiendanube, Shopify o catálogo propio.
- Recepción de pedidos online directamente en el panel de ventas del POS.

### 3. Impresión de Etiquetas
- Generador de etiquetas con código de barras y precios para productos que no traen código de fábrica.
- Soporte para impresoras térmicas de etiquetas (Zebra, Brother).

---

## 🔵 Largo Plazo: Inteligencia y Automatización
*Uso de tecnologías avanzadas para dar valor estratégico.*

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

- **Multi-tenancy**: Preparar el sistema de base de datos para manejar múltiples empresas independientes (SaaS).
- **Log de Auditoría Avanzado**: Visualizador en el panel de admin para ver exactamente quién cambió un precio o stock y cuándo.
- **Exportación masiva**: Generación de reportes contables listos para importar en sistemas como Bejerman o Tango.
