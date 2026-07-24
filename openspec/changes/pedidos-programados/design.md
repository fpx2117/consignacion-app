# Diseno: Pedidos Programados

## Enfoque Tecnico

Agregar un subsistema de pedidos de reposicion programados por fecha dentro del POS de Consignacion. El sistema permite crear "pedidos esperados" con fecha estimada de llegada y una lista de productos con cantidades esperadas. Al llegar la fecha, se genera una notificacion in-app. El usuario luego valida la llegada real del stock, momento en el que se ejecutan los movimientos de inventario correspondientes.

El stock fisico (StockSucursal) NO se modifica al crear el pedido; unicamente se modifica en el momento de la confirmacion explicitada por el usuario. Esto preserva la integridad del inventario real y evita inconsistencias por pedidos que no llegan o llegan parcialmente.

La feature se integra con modelos existentes: StockSucursal, MovimientoStock (motivo COMPRA, tipo ENTRADA) y Notification. Se agregan dos modelos nuevos al schema Prisma: PedidoEsperado y PedidoEsperadoItem, junto con dos enums de estado.

La deteccion de pedidos vencidos se implementa como un chequeo in-app al cargar la seccion de pedidos (lazy check), complementado con un endpoint de verificacion que puede ser invocado por un cron externo o desde el middleware de autenticacion de la app.

## Decisiones de Arquitectura

### Decision: Stock no se toca hasta confirmacion explicita

**Eleccion**: El campo stockDisponibleUnits de StockSucursal permanece inalterado al crear o programar un pedido. Solo se actualiza cuando el usuario confirma la llegada (total o parcial) a traves del dialog de confirmacion.

**Alternativas consideradas**:

- Reservar stock esperado en un campo separado (stockEsperadoUnits) para mostrar proyecciones
- Actualizar el stock inmediatamente al crear el pedido (stock optimista)

**Justificacion**: El stock esperado no es stock real. Actualizar antes de la confirmacion genera inconsistencias si el pedido no llega, llega tarde o llega parcialmente. La separacion entre "stock esperado" y "stock real" es un invariante de negocio critico para un POS de consignacion. Agregar un campo de proyeccion puede hacerse en el futuro sin romper nada.

---

### Decision: Postergacion in-place con historial en observaciones

**Eleccion**: Al postergar, se actualiza la fechaEsperada del PedidoEsperado original en lugar de crear un nuevo registro. El estado cambia a POSTERGADO. La fecha anterior y el motivo se registran en el campo observaciones (texto libre, append con timestamp).

**Alternativas consideradas**:

- Crear un nuevo PedidoEsperado con la nueva fecha y marcar el original como CANCELADO
- Tabla separada de historial de postergaciones

**Justificacion**: Actualizar in-place simplifica la UI (el usuario siempre ve "el mismo pedido"), reduce la cantidad de registros en la base de datos y evita confusion sobre cual es el pedido "vigente". El campo observaciones sirve como log ligero de cambios sin necesidad de una tabla de auditoria adicional. Si en el futuro se necesita trazabilidad completa, se puede agregar una tabla de historial sin afectar la estructura actual.

---

### Decision: Notificacion usando el modelo Notification existente

**Eleccion**: Cuando un pedido pasa a estado VENCIDO (fechaEsperada <= hoy y estado PROGRAMADO), se crea un registro en el modelo Notification existente. La UI muestra un badge con el conteo de notificaciones no leidas, incluyendo las de tipo PEDIDO_VENCIDO.

**Alternativas consideradas**:

- Sistema de alertas propio separado del modelo Notification
- Polling desde el cliente directamente a la tabla PedidoEsperado

**Justificacion**: El modelo Notification ya existe y tiene la infraestructura de badge/lectura. Reutilizarlo evita duplicar logica de UI. Agregar un tipo PEDIDO_VENCIDO al enum de Notification es un cambio minimo y no rompe nada existente.

---

### Decision: Confirmacion parcial deja el pedido en estado PARCIAL sin cerrar los items restantes

**Eleccion**: Si el usuario reporta cantidadRecibida < cantidadEsperada en al menos un item, ese item queda en estado PARCIAL y el pedido pasa a estado PARCIAL. El usuario puede volver a abrir el pedido para confirmar o cancelar los items restantes.

**Alternativas consideradas**:

- Cancelar automaticamente los items no recibidos al confirmar parcialmente
- Crear un pedido derivado con los items faltantes

**Justificacion**: Forzar una decision sobre los items faltantes en el mismo momento de la confirmacion parcial puede no ser lo que el negocio necesita (el resto puede llegar al dia siguiente). Dejar el pedido en PARCIAL permite re-confirmar sin perder el contexto del pedido original. La cancelacion siempre queda disponible como accion explicita.

---

### Decision: Integracion con MovimientoStock usando motivo COMPRA existente

**Eleccion**: Al confirmar un pedido (total o parcialmente), se crea un registro MovimientoStock por cada item con cantidad recibida > 0, usando tipo ENTRADA y motivo COMPRA. Estos son los valores ya existentes en los enums del schema.

**Alternativas consideradas**:

- Agregar un nuevo motivo REPOSICION_PROGRAMADA al enum MotivoMovimientoStock
- Registrar un unico MovimientoStock por pedido en lugar de uno por item

**Justificacion**: COMPRA es semanticamente correcto para una entrada de stock por reposicion. Agregar un nuevo motivo requiere migracion del enum en produccion y no aporta diferenciacion funcional en reportes. Un MovimientoStock por item mantiene la trazabilidad a nivel de producto, coherente con el comportamiento actual del modulo de stock.

---

### Decision: Deteccion de pedidos vencidos via chequeo lazy + endpoint de cron

**Eleccion**: Al cargar la seccion de pedidos esperados, el frontend llama a GET /api/pedidos-esperados que en el servidor actualiza el estado de pedidos PROGRAMADOS cuya fechaEsperada ya paso. Adicionalmente, se expone un endpoint GET /api/pedidos-esperados/check-vencidos que puede ser invocado por un cron externo (ej. Vercel Cron Jobs) para ejecutar el mismo chequeo periodicamente sin necesidad de que el usuario abra la seccion.

**Alternativas consideradas**:

- Cron job interno con node-cron o similar
- Calcular el estado vencido dinamicamente en cada query sin escribir en la DB

**Justificacion**: Next.js no tiene soporte nativo para crons persistentes en produccion. El chequeo lazy garantiza que la UI siempre muestre el estado correcto cuando el usuario la abre. El endpoint de cron es opcional y permite integracion con infraestructura externa sin cambios de arquitectura. Persistir el estado VENCIDO en la DB permite filtrar y notificar sin recalcular en cada request.

## Flujo de Datos

```
[Usuario]
    |
    | POST /api/pedidos-esperados
    v
[PedidoEsperado] estado=PROGRAMADO
[PedidoEsperadoItem x N] estado=PENDIENTE
    |
    | (tiempo pasa, fechaEsperada <= hoy)
    |
    | GET /api/pedidos-esperados (lazy check al abrir seccion)
    | o GET /api/pedidos-esperados/check-vencidos (cron)
    v
[PedidoEsperado] estado=VENCIDO
[Notification] tipo=PEDIDO_VENCIDO creada
    |
    | [Usuario ve badge en UI, abre notificacion o lista de pedidos]
    |
    +----> [Dialog de confirmacion]
    |           |
    |           | cantidadRecibida == cantidadEsperada (todos los items)
    |           v
    |       POST /api/pedidos-esperados/[id]/confirmar { items: [{id, cantidadRecibida}] }
    |           |
    |           v
    |       [MovimientoStock ENTRADA/COMPRA x item] → [StockSucursal updated]
    |       [PedidoEsperadoItem] estado=CONFIRMADO
    |       [PedidoEsperado] estado=CONFIRMADO
    |
    +----> [Dialog de confirmacion - parcial]
    |           |
    |           | cantidadRecibida < cantidadEsperada en algun item
    |           v
    |       POST /api/pedidos-esperados/[id]/confirmar { items: [{id, cantidadRecibida}] }
    |           |
    |           v
    |       [MovimientoStock ENTRADA/COMPRA] solo por items con cantidadRecibida > 0
    |       [PedidoEsperadoItem] estado=CONFIRMADO | PARCIAL segun cantidad
    |       [PedidoEsperado] estado=PARCIAL
    |           |
    |           | (usuario puede re-confirmar o cancelar items restantes)
    |
    +----> [Dialog de postergacion]
                |
                | POST /api/pedidos-esperados/[id]/postergar { nuevaFecha, motivo? }
                v
            [PedidoEsperado] fechaEsperada=nuevaFecha, estado=POSTERGADO
            observaciones append: "Postergado el [fecha] desde [fechaAnterior]: [motivo]"
            [Notification nueva] programada para nuevaFecha
```

## Cambios en Archivos

| Archivo                                                                        | Accion    | Descripcion                                                                                                                                                        |
| ------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| prisma/schema.prisma                                                           | Modificar | Agregar modelos PedidoEsperado, PedidoEsperadoItem y enums EstadoPedidoEsperado, EstadoItemPedido. Agregar tipo PEDIDO_VENCIDO al enum TipoNotificacion si existe. |
| prisma/migrations/YYYYMMDD_pedidos_programados/migration.sql                   | Crear     | Migracion generada por prisma migrate dev                                                                                                                          |
| src/app/api/pedidos-esperados/route.ts                                         | Crear     | GET (lista por sucursal + lazy check de vencidos) y POST (crear pedido con items)                                                                                  |
| src/app/api/pedidos-esperados/[id]/route.ts                                    | Crear     | GET (detalle del pedido con items) y PATCH (actualizar observaciones, cancelar)                                                                                    |
| src/app/api/pedidos-esperados/[id]/confirmar/route.ts                          | Crear     | POST: recibe cantidades recibidas por item, ejecuta MovimientoStock, actualiza estados                                                                             |
| src/app/api/pedidos-esperados/[id]/postergar/route.ts                          | Crear     | POST: actualiza fechaEsperada y estado, appends a observaciones, crea Notification                                                                                 |
| src/app/api/pedidos-esperados/check-vencidos/route.ts                          | Crear     | GET: endpoint para cron, actualiza pedidos PROGRAMADOS vencidos y crea Notifications                                                                               |
| src/app/(system-guard)/(protected)/pedidos-esperados/page.tsx                  | Crear     | Pagina principal de la seccion, lista de pedidos con filtros por estado                                                                                            |
| src/app/(system-guard)/(protected)/pedidos-esperados/PedidosEsperadosView.tsx  | Crear     | Componente principal con tabla/tarjetas de pedidos y acciones                                                                                                      |
| src/app/(system-guard)/(protected)/pedidos-esperados/CreatePedidoDialog.tsx    | Crear     | Dialog de creacion: seleccion de productos del catalogo, cantidades, fecha                                                                                         |
| src/app/(system-guard)/(protected)/pedidos-esperados/ConfirmarPedidoDialog.tsx | Crear     | Dialog de confirmacion: tabla de items con input de cantidad recibida por item                                                                                     |
| src/app/(system-guard)/(protected)/pedidos-esperados/PostergarPedidoDialog.tsx | Crear     | Dialog de postergacion: datepicker para nueva fecha y campo de motivo opcional                                                                                     |
| src/components/nav/Sidebar.tsx (o equivalente)                                 | Modificar | Agregar enlace a /pedidos-esperados en el menu de navegacion                                                                                                       |
| src/lib/pedidos-esperados.ts                                                   | Crear     | Funciones de servidor reutilizables: checkAndUpdateVencidos, confirmarItems, crearMovimientosStock                                                                 |
| src/types/pedidos-esperados.ts                                                 | Crear     | Tipos TypeScript compartidos entre frontend y API                                                                                                                  |

## Interfaces / Contratos Sugeridos

### Tipos TypeScript

```typescript
// src/types/pedidos-esperados.ts

export type EstadoPedidoEsperado =
  | "PROGRAMADO"
  | "VENCIDO"
  | "PARCIAL"
  | "CONFIRMADO"
  | "POSTERGADO"
  | "CANCELADO";

export type EstadoItemPedido =
  "PENDIENTE" | "CONFIRMADO" | "PARCIAL" | "CANCELADO";

export interface PedidoEsperadoItem {
  id: number;
  pedidoId: number;
  productoId: number;
  cantidadEsperada: number;
  cantidadRecibida: number;
  estado: EstadoItemPedido;
  producto: {
    id: number;
    nombre: string;
    stockDisponibleUnits: number;
  };
}

export interface PedidoEsperado {
  id: number;
  sucursalId: number;
  fechaEsperada: string; // ISO 8601
  observaciones: string | null;
  estado: EstadoPedidoEsperado;
  creadoPor: number;
  createdAt: string;
  updatedAt: string;
  items: PedidoEsperadoItem[];
}

// POST /api/pedidos-esperados
export interface CreatePedidoEsperadoRequest {
  sucursalId: number;
  fechaEsperada: string; // ISO 8601
  observaciones?: string;
  items: {
    productoId: number;
    cantidadEsperada: number;
  }[];
}

// POST /api/pedidos-esperados/[id]/confirmar
export interface ConfirmarPedidoRequest {
  items: {
    itemId: number;
    cantidadRecibida: number;
  }[];
}

// POST /api/pedidos-esperados/[id]/postergar
export interface PostergarPedidoRequest {
  nuevaFecha: string; // ISO 8601
  motivo?: string;
}

// PATCH /api/pedidos-esperados/[id]
export interface UpdatePedidoRequest {
  observaciones?: string;
  estado?: Extract<EstadoPedidoEsperado, "CANCELADO">;
}
```

### Ejemplos JSON de Request / Response

**POST /api/pedidos-esperados**

Request:

```json
{
  "sucursalId": 1,
  "fechaEsperada": "2026-03-20T08:00:00.000Z",
  "observaciones": "Proveedor confirmo envio el lunes",
  "items": [
    { "productoId": 42, "cantidadEsperada": 20 },
    { "productoId": 57, "cantidadEsperada": 10 }
  ]
}
```

Response 201:

```json
{
  "id": 7,
  "sucursalId": 1,
  "fechaEsperada": "2026-03-20T08:00:00.000Z",
  "observaciones": "Proveedor confirmo envio el lunes",
  "estado": "PROGRAMADO",
  "creadoPor": 3,
  "createdAt": "2026-03-13T14:00:00.000Z",
  "updatedAt": "2026-03-13T14:00:00.000Z",
  "items": [
    {
      "id": 15,
      "pedidoId": 7,
      "productoId": 42,
      "cantidadEsperada": 20,
      "cantidadRecibida": 0,
      "estado": "PENDIENTE"
    },
    {
      "id": 16,
      "pedidoId": 7,
      "productoId": 57,
      "cantidadEsperada": 10,
      "cantidadRecibida": 0,
      "estado": "PENDIENTE"
    }
  ]
}
```

**POST /api/pedidos-esperados/7/confirmar (confirmacion parcial)**

Request:

```json
{
  "items": [
    { "itemId": 15, "cantidadRecibida": 20 },
    { "itemId": 16, "cantidadRecibida": 6 }
  ]
}
```

Response 200:

```json
{
  "pedido": {
    "id": 7,
    "estado": "PARCIAL",
    "updatedAt": "2026-03-20T09:30:00.000Z"
  },
  "movimientos": [
    {
      "id": 88,
      "productoId": 42,
      "tipo": "ENTRADA",
      "motivo": "COMPRA",
      "cantidad": 20,
      "stockPrevio": 5,
      "stockPosterior": 25
    },
    {
      "id": 89,
      "productoId": 57,
      "tipo": "ENTRADA",
      "motivo": "COMPRA",
      "cantidad": 6,
      "stockPrevio": 2,
      "stockPosterior": 8
    }
  ]
}
```

**POST /api/pedidos-esperados/7/postergar**

Request:

```json
{
  "nuevaFecha": "2026-03-25T08:00:00.000Z",
  "motivo": "Retraso en distribucion"
}
```

Response 200:

```json
{
  "id": 7,
  "estado": "POSTERGADO",
  "fechaEsperada": "2026-03-25T08:00:00.000Z",
  "observaciones": "Proveedor confirmo envio el lunes\n[2026-03-20] Postergado desde 2026-03-20 hasta 2026-03-25: Retraso en distribucion",
  "updatedAt": "2026-03-20T09:00:00.000Z"
}
```

## Estrategia de Pruebas

| Capa                                       | Que Probar                                                                                                                                        | Enfoque                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| API - POST /api/pedidos-esperados          | Crear pedido con items validos; rechazar si sucursalId no pertenece al usuario; rechazar si items vacio                                           | Jest + supertest o prueba de integracion con DB de test        |
| API - POST confirmar (total)               | Todos los items con cantidadRecibida == cantidadEsperada → estado CONFIRMADO, MovimientoStock creado por cada item, StockSucursal incrementado    | Prueba de integracion con transaccion revertida al final       |
| API - POST confirmar (parcial)             | Al menos un item con cantidadRecibida < cantidadEsperada → estado PARCIAL en pedido, items en PARCIAL; solo se crean movimientos con cantidad > 0 | Prueba de integracion                                          |
| API - POST postergar                       | fechaEsperada actualizada, estado POSTERGADO, observaciones con append, Notification creada                                                       | Prueba de integracion                                          |
| API - check-vencidos                       | Pedidos PROGRAMADOS con fechaEsperada pasada pasan a VENCIDO y se crean Notifications; pedidos futuros no se tocan                                | Prueba unitaria con fechas mockeadas                           |
| Logica de negocio - checkAndUpdateVencidos | Idem check-vencidos pero a nivel funcion pura (sin HTTP)                                                                                          | Jest unitario con Prisma mockeado                              |
| Logica de negocio - confirmarItems         | Validar que la transaccion es atomica: si falla la creacion de un MovimientoStock, ningun item se actualiza                                       | Jest con mock de Prisma.$transaction                           |
| UI - CreatePedidoDialog                    | Seleccion de productos filtra por catalogo de la sucursal; validacion de cantidad > 0; fecha futura requerida                                     | Vitest + Testing Library                                       |
| UI - ConfirmarPedidoDialog                 | Campos pre-llenados con cantidadEsperada; cantidadRecibida no puede superar cantidadEsperada; submit deshabilitado si todos en 0                  | Vitest + Testing Library                                       |
| UI - PedidosEsperadosView                  | Lista muestra estado visual correcto; badge de notificacion se actualiza al confirmar un pedido                                                   | Vitest + Testing Library con fetch mockeado                    |
| E2E                                        | Flujo completo: crear pedido → simular fecha vencida → confirmar parcialmente → postergar el resto                                                | Playwright (opcional, si el proyecto ya tiene E2E configurado) |

## Migracion / Despliegue y Rollback Seguro

### Pasos de migracion

1. Agregar los modelos PedidoEsperado, PedidoEsperadoItem y los enums al schema Prisma.
2. Si el enum TipoNotificacion existe, agregar el valor PEDIDO_VENCIDO. Si el enum no existe o Notification usa un campo de texto libre, usar el string "PEDIDO_VENCIDO" directamente sin modificar el enum.
3. Ejecutar `npx prisma migrate dev --name pedidos_programados` en desarrollo para generar el SQL de migracion.
4. Revisar el SQL generado antes de aplicar en staging/produccion.
5. Ejecutar `npx prisma migrate deploy` en el ambiente target.
6. Deployar el codigo de la aplicacion (APIs y UI nuevas). Las rutas nuevas no afectan rutas existentes.
7. Verificar en produccion que GET /api/pedidos-esperados responde correctamente (lista vacia es esperado al inicio).

### Consideraciones de rollback

- Los modelos PedidoEsperado y PedidoEsperadoItem son tablas nuevas; no modifican tablas existentes (Producto, StockSucursal, MovimientoStock).
- Si se necesita rollback, basta con revertir el deploy del codigo y ejecutar la migracion inversa (DROP TABLE pedido_esperado_items, DROP TABLE pedidos_esperados, DROP TYPE enums).
- La unica modificacion a una tabla existente potencial es agregar un valor al enum TipoNotificacion. En PostgreSQL, agregar un valor a un enum es una operacion no reversible sin recrear el tipo. Si esto es un riesgo, usar un campo TEXT en Notification en lugar de extender el enum.
- Los MovimientoStock creados por confirmaciones no pueden revertirse automaticamente (son registros de auditoria). Si se cancela un pedido ya confirmado, se debe crear un MovimientoStock de AJUSTE_NEGATIVO manualmente.

### Variables de entorno / configuracion

No se requieren nuevas variables de entorno. Si se integra un cron externo (ej. Vercel Cron Jobs), agregar en vercel.json:

```json
{
  "crons": [
    {
      "path": "/api/pedidos-esperados/check-vencidos",
      "schedule": "0 8 * * *"
    }
  ]
}
```

El endpoint check-vencidos debe validar un header secreto (CRON_SECRET) para evitar invocaciones no autorizadas.

## Preguntas Abiertas

- [ ] El modelo Notification actual tiene un campo `tipo` que es un enum o un string libre? Si es enum, se necesita migracion para agregar PEDIDO_VENCIDO. Confirmar antes de implementar.
- [ ] El badge de notificaciones en la UI ya existe o se tiene que crear? Si ya existe, como se alimenta actualmente?
- [ ] Se necesita control de permisos por rol para crear/confirmar pedidos, o cualquier usuario autenticado con acceso a la sucursal puede operar?
- [ ] El campo creadoPor (userId) se obtiene del JWT/sesion del usuario autenticado? Confirmar como se accede al userId en los API routes del proyecto.
- [ ] El check-vencidos deberia generar una Notification por pedido vencido o una sola Notification agrupada con el conteo?
- [ ] Cuando un pedido PARCIAL tiene todos sus items restantes cancelados por el usuario, el pedido debe pasar automaticamente a CANCELADO o el usuario lo cancela manualmente?
- [ ] Se necesita paginacion en GET /api/pedidos-esperados desde el inicio o es suficiente con filtros por estado y un limite razonable (ej. ultimos 90 dias)?
- [ ] El campo sucursalId en el pedido debe restringirse a la sucursal activa del usuario logueado, o un usuario con acceso multi-sucursal puede crear pedidos para cualquier sucursal?
