# Propuesta de Feature: pedidos-programados

## Contexto

El sistema POS de Consignacion gestiona stock por sucursal mediante el modelo StockSucursal y registra
movimientos en MovimientoStock. Actualmente no existe ningun mecanismo para anticipar entradas de stock:
los ingresos se registran de forma manual y reactiva a traves de AjustarStockDialog en /productos.

No existen modelos de Pedido, OrdenCompra ni Proveedor en el schema actual. El sistema ya cuenta con un
mecanismo de Notification in-app que puede usarse para alertar al usuario cuando una fecha de llegada
estimada se aproxima o vence.

## Objetivo

Permitir al usuario registrar pedidos esperados de reposicion de stock, con una fecha estimada de llegada,
y gestionar su confirmacion (total o parcial) o postergacion cuando esa fecha se alcanza. Al confirmar,
el stock se actualiza automaticamente via MovimientoStock con tipo ENTRADA y motivo COMPRA, manteniendo
el historial consistente con el flujo existente.

## Alcance Propuesto

### MVP (prioridad alta)

- Crear pedido esperado: seleccion de productos existentes del catalogo (sin alta de nuevos productos),
  cantidad esperada por item, fecha estimada de llegada, sucursal destino.
- Estado del pedido: PROGRAMADO -> PARCIAL -> CONFIRMADO | POSTERGADO | CANCELADO.
- Notificacion in-app al alcanzar (o superar) la fecha estimada de llegada, usando el sistema de
  Notification ya existente en el schema.
- Pantalla de validacion: el usuario puede confirmar la llegada total, confirmar llegada parcial
  (ingresa la cantidad real recibida por item), o postergar la fecha.
- Al confirmar (total o parcial): se generan movimientos MovimientoStock tipo ENTRADA, motivo COMPRA,
  por cada item confirmado, actualizando StockSucursal de la sucursal correspondiente.
- Llegada parcial: los items no recibidos quedan en estado pendiente; el usuario puede postergar la
  fecha del pedido (o de los items pendientes) o cancelarlos individualmente.
- Postergacion: accion principal cuando el pedido no llega en la fecha estimada; permite fijar una
  nueva fecha sin cerrar ni rechazar el pedido definitivamente.
- Vista de pedidos programados en /pedidos (nueva ruta) con filtros por estado y sucursal.

### Fuera de MVP (online-only inicialmente)

- Integracion con proveedores (modelo Proveedor) para asociar pedidos a un contacto externo.
- Envio de alertas por email o WhatsApp al acercarse la fecha.
- Pedidos recurrentes o plantillas de pedido.
- Aprobacion en dos pasos (solicitud → aprobacion → confirmacion de llegada).
- Reportes de cumplimiento de proveedores (tasa de llegada en fecha, desviacion de cantidades).
- Importacion de pedidos desde archivo CSV o factura del proveedor.

## Estrategia Tecnica Recomendada

### Modelo de datos nuevos

Agregar al schema de Prisma:

```
model PedidoEsperado {
  id              String              @id @default(cuid())
  sucursalId      String
  sucursal        Sucursal            @relation(fields: [sucursalId], references: [id])
  fechaEstimada   DateTime
  estado          EstadoPedido        @default(PROGRAMADO)
  notas           String?
  creadoEn        DateTime            @default(now())
  actualizadoEn   DateTime            @updatedAt
  items           PedidoEsperadoItem[]
}

model PedidoEsperadoItem {
  id              String          @id @default(cuid())
  pedidoId        String
  pedido          PedidoEsperado  @relation(fields: [pedidoId], references: [id])
  productoId      String
  producto        Producto        @relation(fields: [productoId], references: [id])
  cantidadEsperada Int
  cantidadRecibida Int            @default(0)
  estado          EstadoItemPedido @default(PENDIENTE)
}

enum EstadoPedido {
  PROGRAMADO
  PARCIAL
  CONFIRMADO
  POSTERGADO
  CANCELADO
}

enum EstadoItemPedido {
  PENDIENTE
  RECIBIDO
  PARCIAL
  CANCELADO
}
```

### Flujo de confirmacion

1. Job o cron (o consulta al cargar /pedidos) detecta pedidos con fechaEstimada <= hoy y estado
   PROGRAMADO o POSTERGADO.
2. Se genera una Notification in-app por pedido vencido, vinculada a la sucursal correspondiente.
3. El usuario abre la pantalla de validacion del pedido, ingresa las cantidades reales recibidas
   por item y confirma.
4. Por cada item con cantidadRecibida > 0, se crea un MovimientoStock:
   - tipo: ENTRADA
   - motivo: COMPRA
   - productoId, sucursalId
   - cantidad: cantidadRecibida
   - stockPrevio y stockPosterior calculados en el momento de confirmacion
   - StockSucursal.stockDisponibleUnits se incrementa en cantidadRecibida
5. El estado del pedido se actualiza segun el resultado:
   - Todos los items recibidos completos -> CONFIRMADO
   - Al menos un item parcial o sin recibir -> PARCIAL (pedido sigue abierto para postergacion)
   - Si el usuario posterga -> POSTERGADO con nueva fechaEstimada

### Integracion de notificaciones

Usar el modelo Notification existente. Al detectar pedidos vencidos, insertar una notificacion por
pedido con referencia al PedidoEsperado.id, tipo PEDIDO_VENCIDO (agregar al enum NotificationType
si no existe), visible en la campana de alertas del header.

### Nueva ruta

- /pedidos: lista de pedidos programados con filtros por estado (PROGRAMADO, POSTERGADO, PARCIAL) y
  sucursal. Acciones: crear pedido, ver detalle, confirmar llegada, postergar.
- /pedidos/nuevo: formulario de creacion con buscador de productos del catalogo existente.
- /pedidos/[id]: detalle del pedido con historial de postergaciones y acciones de validacion.

## Riesgos y Mitigaciones

| Riesgo | Mitigacion |
|---|---|
| El stock esperado no debe afectar el stock actual hasta la confirmacion | Los campos cantidadEsperada y cantidadRecibida viven solo en PedidoEsperadoItem; StockSucursal no se toca hasta confirmar. |
| Confirmacion duplicada (doble clic o reenvio de formulario) | Transaccion Prisma atomica; verificar estado del pedido antes de procesar; idempotencia por pedidoId. |
| Pedidos olvidados sin confirmar acumulan notificaciones | Agrupar notificaciones por pedido; no generar duplicados si ya existe una notificacion activa para ese pedido. |
| Datos inconsistentes si la confirmacion falla a mitad | Toda la operacion de confirmacion (update items + insert MovimientoStock + update StockSucursal + update pedido) en una sola transaccion Prisma. |
| Productos eliminados o desactivados referenciados en pedidos | Soft-delete en Producto; PedidoEsperadoItem conserva el productoId aunque el producto este inactivo; mostrar advertencia en UI. |

## Roadmap de Implementacion

### Fase 0 - Modelo de datos y migracion

- Agregar PedidoEsperado, PedidoEsperadoItem, EstadoPedido, EstadoItemPedido al schema de Prisma.
- Agregar relacion inversa en Producto (pedidoItems PedidoEsperadoItem[]).
- Agregar tipo PEDIDO_VENCIDO al enum NotificationType si no existe.
- Generar y aplicar migracion Prisma.

### Fase 1 - API (Server Actions o Route Handlers)

- createPedidoEsperado: validacion, creacion del pedido con sus items.
- getPedidosProgramados: lista con filtros por estado y sucursal.
- getPedidoById: detalle con items y producto.
- confirmarPedido: recibe cantidades reales, ejecuta transaccion de confirmacion.
- postergarPedido: actualiza fechaEstimada y estado a POSTERGADO.
- cancelarPedido / cancelarItem: marcado logico.
- checkPedidosVencidos: detecta pedidos vencidos y genera notificaciones (puede llamarse desde
  middleware, layout o cron job ligero).

### Fase 2 - UI base

- Pagina /pedidos con tabla de pedidos, filtros y acciones.
- Formulario /pedidos/nuevo con buscador de productos (reutilizar componentes existentes de /productos).
- Pagina /pedidos/[id] con detalle e historial.

### Fase 3 - Flujo de validacion y notificaciones

- Dialog de confirmacion de llegada con inputs de cantidad por item.
- Integracion de notificaciones in-app: badge en header, lista de alertas de pedidos vencidos.
- Accion de postergacion con selector de nueva fecha.

### Fase 4 - Pulido y casos borde

- Manejo de productos inactivos en pedidos abiertos.
- Historial de postergaciones por pedido (campo o tabla auxiliar).
- Tests de la transaccion de confirmacion.
- Validaciones de negocio: cantidad recibida no puede superar cantidad esperada sin advertencia.

## Areas del Repo a Impactar (referencia inicial)

- prisma/schema.prisma: nuevos modelos y enums.
- prisma/migrations/: nueva migracion generada.
- src/app/(dashboard)/pedidos/: nueva seccion de UI.
- src/actions/ o src/app/api/pedidos/: server actions o route handlers del modulo.
- src/components/pedidos/: componentes especificos (tabla, formulario, dialog de confirmacion).
- src/types/: tipos derivados de Prisma para PedidoEsperado e items.
- El modelo Notification y su enum en schema.prisma si se necesita agregar PEDIDO_VENCIDO.

## Criterios de Aceptacion Iniciales (MVP)

- Un usuario puede crear un pedido esperado seleccionando productos existentes, cantidades y fecha
  estimada, asociado a una sucursal.
- El sistema genera una notificacion in-app cuando la fecha estimada de un pedido PROGRAMADO o
  POSTERGADO es alcanzada o superada.
- El usuario puede confirmar la llegada total de un pedido: el stock de cada producto en la sucursal
  se incrementa en la cantidad confirmada y se registra un MovimientoStock tipo ENTRADA motivo COMPRA.
- El usuario puede confirmar llegada parcial: solo los items con cantidad recibida > 0 generan
  movimiento de stock; el pedido queda en estado PARCIAL.
- El usuario puede postergar un pedido indicando una nueva fecha estimada; el pedido cambia a estado
  POSTERGADO y puede volver a generar notificacion al alcanzar la nueva fecha.
- El stock actual (StockSucursal) no se modifica en ningun momento antes de la confirmacion.
- Toda la operacion de confirmacion es atomica: si falla alguna parte, ningun cambio persiste.

## Estado
Feature candidata para planificacion y priorizacion en roadmap.
