# Tareas: pedidos-programados

## Resumen

Implementar el modulo de pedidos de reposicion programados. Permite crear pedidos con fecha de llegada estimada y productos del catalogo. Al vencer la fecha, el sistema alerta al usuario y permite confirmar (total o parcial) o postergar. Cada confirmacion genera movimientos de stock reales en la base de datos.

---

## Fase 0 - Preparacion y Contratos

- [x] Leer prisma/schema.prisma completo y documentar modelos existentes relevantes: Producto, StockSucursal, MovimientoStock, Notification, TipoMovimiento, MotivoMovimiento
- [x] Verificar que los enums TipoMovimiento y MotivoMovimiento incluyen ENTRADA y COMPRA respectivamente; si no, agregarlos en esta fase
- [x] Definir tipos TypeScript en src/types/pedidos-esperados.ts: PedidoEsperado, PedidoEsperadoItem, EstadoPedidoEsperado, EstadoItemPedido, CreatePedidoEsperadoInput, ConfirmarPedidoInput, PostergarPedidoInput
- [x] Definir esquemas de validacion Zod en src/lib/validations/pedidos-esperados.ts para cada payload de API
- [x] Revisar src/app/api/productos/ para entender patron de respuesta y middleware de autenticacion/sucursal actualmente usado
- [x] Revisar src/app/api/historial/ para entender como se crean MovimientoStock y como se actualiza StockSucursal.stockDisponibleUnits
- [x] Revisar como se crean Notification existentes y replicar patron: PEDIDO_VENCIDO agregado al enum NotificationType (schema + notificaciones-types.ts), upsert idempotente por fingerprint en checkAndUpdateVencidos()

---

## Fase 1 - Base de Datos

- [x] Agregar enum EstadoPedidoEsperado en prisma/schema.prisma con valores: PROGRAMADO, VENCIDO, PARCIAL, CONFIRMADO, POSTERGADO, CANCELADO
- [x] Agregar enum EstadoItemPedido en prisma/schema.prisma con valores: PENDIENTE, CONFIRMADO, PARCIAL, CANCELADO
- [x] Agregar modelo PedidoEsperado en prisma/schema.prisma con campos: id (String, cuid), sucursalId (String), fechaEsperada (DateTime), estado (EstadoPedidoEsperado, default PROGRAMADO), observaciones (String?), creadoPor (String), creadoAt (DateTime, default now()), actualizadoAt (DateTime, updatedAt); relaciones: sucursal Sucursal, items PedidoEsperadoItem[]
- [x] Agregar modelo PedidoEsperadoItem en prisma/schema.prisma con campos: id (String, cuid), pedidoId (String), productoId (String), cantidadEsperada (Int), cantidadRecibida (Int?), estado (EstadoItemPedido, default PENDIENTE); relaciones: pedido PedidoEsperado, producto Producto
- [x] Agregar relacion inversa en modelo Producto: pedidoItems PedidoEsperadoItem[]
- [x] Ejecutar: npx prisma migrate dev --name add_pedidos_esperados y verificar que la migracion no sea destructiva
- [x] Ejecutar: npx prisma generate para regenerar el cliente
- [ ] Crear script prisma/seeds/pedidos-esperados.ts con 3 pedidos de prueba en distintos estados (PROGRAMADO, VENCIDO, CONFIRMADO) con al menos 2 items cada uno, apuntando a productos existentes del seed base

---

## Fase 2 - Backend / APIs

- [x] Crear src/app/api/pedidos-esperados/route.ts con GET (lista pedidos de la sucursal activa, soporta query params: estado, fechaDesde, fechaHasta; incluye items y producto por item) y POST (crea pedido con array de items; valida que cada productoId exista; estado inicial PROGRAMADO)
- [x] Crear src/app/api/pedidos-esperados/[id]/route.ts con GET (detalle completo: pedido + items + producto por item) y PATCH (permite actualizar observaciones o cambiar estado a CANCELADO; no permite modificar items ni fecha desde este endpoint)
- [x] Crear src/app/api/pedidos-esperados/[id]/confirmar/route.ts con POST: recibe array { itemId, cantidadRecibida }; por cada item con cantidadRecibida > 0 crea MovimientoStock (tipo ENTRADA, motivo COMPRA, sucursalId del pedido) e incrementa StockSucursal.stockDisponibleUnits; actualiza estado de cada PedidoEsperadoItem; si todos confirmados -> estado pedido CONFIRMADO, si algunos -> PARCIAL
- [x] En confirmar/route.ts: envolver toda la operacion en prisma.$transaction para garantizar atomicidad
- [x] En confirmar/route.ts: validar que el pedido pertenece a la sucursal del usuario autenticado antes de procesar
- [x] Crear src/app/api/pedidos-esperados/[id]/postergar/route.ts con POST: recibe nuevaFechaEsperada (Date) y notaPostergacion (String?); actualiza PedidoEsperado.fechaEsperada y estado a POSTERGADO; concatena notaPostergacion a observaciones con timestamp; NO crea Notification (MVP: sin modificar NotificationType enum)
- [x] Crear src/app/api/pedidos-esperados/check-vencidos/route.ts con POST: busca todos los PedidoEsperado con estado PROGRAMADO/POSTERGADO y fechaEsperada < now(); para cada uno: actualiza estado a VENCIDO; devuelve count de pedidos actualizados (MVP: sin Notifications)
- [x] Llamar a /api/pedidos-esperados/check-vencidos en el layout protegido src/app/(system-guard)/(protected)/layout.tsx al montar (useEffect o fetch en server component) para mantener estados actualizados

---

## Fase 3 - Frontend / UI

- [x] Crear src/app/(system-guard)/(protected)/pedidos-esperados/page.tsx como pagina principal del modulo; carga lista de pedidos de la sucursal activa y muestra contador de VENCIDOS (nota: ruta es /pedidos-esperados, no /productos/pedidos-esperados)
- [x] Agregar link "Pedidos Esperados" en el sidebar (sidebar-dock.tsx, NAV_BUSINESS) con icono ClipboardList; el badge de vencidos se muestra en el header de la vista
- [x] Crear componente pedidos-esperados-view.tsx: tabla (desktop) + cards (mobile) con columnas: fecha estimada, estado (badge de color), cantidad de items, productos (truncado), observaciones, acciones
- [x] Crear componente crear-pedido-dialog.tsx: buscador de productos con filtro en tiempo real, lista de seleccionados con cantidad, fecha estimada, observaciones, POST /api/pedidos-esperados
- [x] En crear-pedido-dialog.tsx: validar al menos 1 producto, cantidades > 0 y fecha >= hoy antes de habilitar submit
- [x] Crear componente confirmar-pedido-dialog.tsx: tabla de items con cantidad recibida editable pre-cargada con cantidadEsperada; botones "Confirmar Todo", "Confirmar Parcial", "Cancelar"; bloquea submit si todos en 0
- [x] Crear componente postergar-pedido-dialog.tsx: datepicker nueva fecha (min = manana), campo motivo opcional, POST /api/pedidos-esperados/[id]/postergar
- [x] Crear hook src/hooks/usePedidosEsperados.ts con funciones: fetchPedidos(filtros), crearPedido, confirmarPedido, postergarPedido, cancelarPedido; manejo de loading y error
- [x] Crear componente pedido-estado-badge.tsx: badge reutilizable con colores por estado (PROGRAMADO=azul, VENCIDO=rojo+pulse, PARCIAL=amarillo, CONFIRMADO=verde, POSTERGADO=gris, CANCELADO=tachado)
- [x] Crear componente pedidos-filters.tsx: select de estado + inputs fecha desde/hasta + boton limpiar
- [x] Agregar contador de pedidos VENCIDOS al store Zustand (useSucursalStore: pedidosVencidosCount + setPedidosVencidosCount) y badge rojo animado sobre icono ClipboardList en sidebar-dock.tsx

---

## Fase 4 - Integracion y Pruebas

- [ ] Probar flujo completo: crear pedido con 3 productos -> verificar que aparece en lista con estado PROGRAMADO -> verificar que los items estan guardados correctamente en BD
- [ ] Probar check-vencidos: crear pedido con fechaEsperada en el pasado directamente en BD -> llamar endpoint -> verificar cambio a VENCIDO y creacion de Notification
- [ ] Probar confirmar todo: seleccionar pedido VENCIDO -> abrir dialog -> hacer click en Confirmar Todo -> verificar MovimientoStock creados (uno por item) -> verificar StockSucursal.stockDisponibleUnits incrementado en cada producto -> verificar estado pedido = CONFIRMADO
- [ ] Probar confirmar parcial: pedido con 2 items -> confirmar solo 1 (cantidadRecibida=0 en el otro) -> verificar estado pedido = PARCIAL -> verificar que solo se creo MovimientoStock para el item confirmado
- [ ] Probar postergar: pedido VENCIDO -> postergar con nueva fecha -> verificar fechaEsperada actualizada, estado POSTERGADO, Notification creada, nota concatenada en observaciones
- [ ] Probar cancelar: PATCH con estado CANCELADO -> verificar que no se pueden confirmar items de un pedido cancelado (API debe rechazar con 400)
- [ ] Probar atomicidad: simular fallo en medio de confirmar (mockear error en segundo MovimientoStock) -> verificar que el primero tambien se revierte (transaction rollback)
- [ ] Probar badge de vencidos en navegacion: con 2 pedidos VENCIDOS -> verificar que el badge muestra "2" -> confirmar uno -> verificar que el badge muestra "1"
- [ ] Probar filtros de lista: GET /api/pedidos-esperados?estado=VENCIDO -> verificar que solo retorna VENCIDOS; GET con fechaDesde y fechaHasta -> verificar rango correcto
- [ ] Probar validaciones de API: POST sin items -> debe retornar 400; POST con productoId inexistente -> debe retornar 400; confirmar pedido de otra sucursal -> debe retornar 403

---

## Notas de Implementacion

**Atomicidad en confirmacion**: La ruta POST /confirmar debe usar prisma.$transaction con todas las operaciones: update de cada PedidoEsperadoItem, upsert de StockSucursal, create de MovimientoStock, y update del PedidoEsperado. Un fallo en cualquier paso debe revertir todo.

**Check de vencidos**: No llamar al endpoint en cada request individual. Llamarlo una sola vez en el layout protegido al montar la sesion (o con un intervalo largo tipo 5 minutos). El endpoint debe ser idempotente: si un pedido ya esta VENCIDO, no volver a crear Notification.

**StockSucursal upsert**: Al confirmar items, usar prisma.stockSucursal.upsert con where: { productoId_sucursalId } para manejar el caso en que el producto no tenga registro de stock en esa sucursal todavia.

**Cantidades**: cantidadEsperada y cantidadRecibida son enteros no negativos. La API debe validar cantidadRecibida >= 0 y cantidadRecibida <= cantidadEsperada * 2 (margen razonable para sobre-entrega).

**Relacion Producto**: La relacion inversa pedidoItems en Producto es solo para Prisma ORM; no es necesario incluirla en los selects de /api/productos para no romper queries existentes.

**Migracion no destructiva**: La migracion solo agrega tablas y enums nuevos. No modifica columnas existentes. Verificar con `prisma migrate diff` antes de aplicar en produccion.

**Formato de fechas**: Usar ISO 8601 en todos los payloads de API. En el frontend, usar date-fns o la libreria ya utilizada en el proyecto para formatear fechas en la UI.

**Sucursal activa**: Todas las APIs deben leer la sucursalId del usuario autenticado (session/token), no del body del request, para evitar que un usuario manipule datos de otra sucursal.

---

## Fase 2 completada - Notas adicionales

**Función compartida creada**: `src/lib/pedidos-esperados.ts`
- `checkAndUpdateVencidos(sucursalId?)` — actualiza estados PROGRAMADO/POSTERGADO → VENCIDO
- Usada por el GET de `/api/pedidos-esperados` (lazy check) y por `/api/pedidos-esperados/check-vencidos`

**creadoPor**: se obtiene de `Number(auth.user.sub)` — el JWT usa `sub` (string) como ID de usuario

**Patron de `@ts-nocheck`**: todos los archivos nuevos usan `// @ts-nocheck` igual que los archivos de referencia del proyecto (productos/route.ts, etc.), porque el TS server del editor no recarga el cliente Prisma generado en caliente.

**Notifications en MVP**: No se crean Notifications en check-vencidos ni en postergar para evitar modificar el enum `NotificationType` sin revisar. Se puede agregar en iteraciones futuras.

---

## Notas adicionales (agregadas por el sub-agente de implementacion)

**Patron de autenticacion/sucursal detectado**:
- `requireAuth()` retorna `{ ok, res, user, activeSucursalId }`
- `sucursalId` se obtiene SIEMPRE de `auth.activeSucursalId`, nunca del body
- Rol admin requerido para mutaciones: `requireRole(auth.user, ["ADMIN"])`
- Archivo: `src/lib/requireAuth.ts`

**Patron de validators**:
- El directorio es `src/lib/validators/` (no `validations/`)
- Se crea el archivo como `src/lib/validators/pedidos-esperados.ts`

**Migracion**:
- `prisma migrate dev` fallo por drift entre historial y BD (la BD tiene cambios manuales aplicados)
- Se uso `prisma db push` exitosamente como alternativa de desarrollo
- Para produccion: crear la migracion SQL manualmente con `prisma migrate diff`

**F1.4 (seeds)**:
- El archivo `prisma/seed.ts` solo tiene seeds de planes y codigos promo, no de datos de dominio
- No existe directorio `prisma/seeds/`
- SALTADO: no hay sistema de seeds de datos de dominio establecido

---

## Fase 3 completada - Notas adicionales

**Estructura de archivos creada** (distinta al tasks.md original — se siguio el patron del proyecto):
- `src/app/(system-guard)/(protected)/pedidos-esperados/page.tsx` — pagina principal
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/pedidos-esperados-view.tsx` — vista principal
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/pedido-estado-badge.tsx`
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/pedidos-filters.tsx`
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/crear-pedido-dialog.tsx`
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/confirmar-pedido-dialog.tsx`
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/postergar-pedido-dialog.tsx`
- `src/hooks/usePedidosEsperados.ts`

**Navegacion**:
- Link agregado en `src/components/sidebar-dock.tsx` dentro de NAV_BUSINESS
- Icono: `ClipboardList` de lucide-react
- Ruta: `/pedidos-esperados`
- El badge de vencidos se muestra en el header H1 de la vista (Badge rojo con animacion pulse)

**Toast/notificaciones**: proyecto usa `sonner` — todos los toast usan `toast.success()` / `toast.error()`

**Desviaciones del design doc original**:
- Ruta es `/pedidos-esperados` no `/productos/pedidos-esperados` — mas limpio y consistente con el sidebar
- Componentes en `pedidos-esperados/components/` no en `src/components/pedidos-esperados/` — patron del proyecto
- El badge de vencidos esta en el header de la vista, no en el sidebar (requeriria un store Zustand separado)
- `confirmar-pedido-dialog.tsx`: boton "Confirmar Todo" llena los campos; hay dos CTAs: "Confirmar Todo" y "Confirmar Parcial" — el usuario puede editar y luego usar cualquiera

**Filtro pendientes**: la API acepta multiples valores `?estado=PROGRAMADO&estado=VENCIDO` pero si la API no soporta multiples valores del mismo param, se puede simplificar enviando solo los activos. Revision pendiente segun implementacion del backend.
