# Sistema de Gestión de Inventario y Consignaciones (Backend)

Este repositorio contiene la definición del modelo de datos para un sistema de gestión comercial robusto, construido con **Prisma ORM** y **PostgreSQL**. El sistema está diseñado para manejar ventas directas, gestión de stock por unidades y un flujo completo de mercancía en consignación.

## 🚀 Características Principales

* **Gestión de Usuarios:** Soporte para roles de `ADMIN` y `EMPLEADO`.
* **Control de Stock Dual:** Seguimiento diferenciado entre stock físicamente disponible y stock entregado en consignación.
* **Módulo de Consignaciones:** Flujo completo desde la entrega de mercancía hasta la liquidación y devolución.
* **Sistema de Notificaciones:** Alertas automáticas por stock bajo o agotado con sistema de *fingerprinting* para evitar duplicados.
* **Cuentas Corrientes:** Seguimiento de saldos de clientes y registros de pagos (`Pago`).

---

## 🏗️ Arquitectura de Datos

### Modelos de Inventario
* **`Producto`**: El núcleo del sistema. Controla precios de costo/venta y umbrales de stock mínimo para alertas.
* **`Notification`**: Gestiona las alertas del sistema vinculadas a productos específicos mediante `NotificationType`.

### Flujo de Consignación
1.  **`Consignacion`**: Agrupa el proceso de entrega de mercadería a un cliente bajo un `numeroFolio`.
2.  **`ConsignacionDetalle`**: Registra las unidades entregadas, vendidas acumuladas y devueltas acumuladas.
3.  **`Liquidacion`**: El evento donde se rinden cuentas de lo vendido en una consignación abierta.
4.  **`LiquidacionItem`**: Captura un *snapshot* del precio al momento de liquidar para asegurar la integridad histórica.

### Ventas y Pagos
* **`Venta`**: Puede originarse de forma directa o estar vinculada a una `Liquidacion` (1:1).
* **`Cliente`**: Almacena datos de contacto y el `saldoCuenta` (donde un saldo positivo representa una deuda).
* **`Pago`**: Registra abonos a la cuenta corriente del cliente mediante diversos métodos (Efectivo, Transferencia, Tarjeta).

---

## 🛠️ Stack Tecnológico

* **Lenguaje:** TypeScript / JavaScript
* **ORM:** [Prisma](https://www.prisma.io/)
* **Base de Datos:** PostgreSQL
* **Motor de Consultas:** Prisma Client JS

---

## 📋 Reglas de Negocio Implementadas

| Concepto | Regla de Datos |
| :--- | :--- |
| **Stock Mínimo** | Si `stockMinUnits` es 0, las notificaciones automáticas están desactivadas. |
| **Folios** | Índice compuesto en `[clienteId, numeroFolio]` para rastrear entregas cronológicas por cliente. |
| **Saldos** | El campo `saldoCuenta` en `Cliente` centraliza la deuda total pendiente de cobro. |
| **Integridad** | Uso de `onDelete: Restrict` en productos para evitar pérdida de historial en ventas o consignaciones. |

---

## ⚙️ Configuración del Proyecto

1. **Instalar dependencias:**
   ```bash
   npm install