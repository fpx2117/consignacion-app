# Tasks: Optimización de Performance — Navegación y Componentes

- **Change ID:** optimizacion-performance
- **Versión:** 1.0.0
- **Fecha:** 2026-03-16
- **Estado:** PENDING
- **Referencia:** [proposal.md](./proposal.md) · [design.md](./design.md) · [spec.md](./specs/performance/spec.md)

---

## Resumen de Fases

| Fase | Descripción | Tareas | Estimado |
|------|-------------|--------|----------|
| Fase 1 | Quick Wins (riesgo cero) | 5 tareas | ≤ 30 min |
| Fase 2 | Fixes Estructurales | 6 tareas | ~3–4 horas |
| Fase 3 | Verificación Manual | 7 tareas | ~45 min |
| **Total** | | **18 tareas** | **~5 horas** |

---

## Fase 1 — Quick Wins (≤ 30 minutos, riesgo cero)

> Cambios de 1–5 líneas cada uno. Se aplican primero para entrega de valor inmediata sin bloquear la Fase 2.

- [x] **1.1** `src/hooks/useBroadcastChannel.ts` — Agregar `useRef` para handlers y `[]` en `useEffect`

  **Cambio exacto (FIX-01):**
  - Agregar `const handlersRef = React.useRef(handlers)` antes del `useEffect`
  - Agregar `handlersRef.current = handlers` como segunda línea (sync ref en cada render)
  - Reemplazar `handlers[message.type]` por `handlersRef.current[message.type]` dentro del efecto
  - Cambiar el cierre del `useEffect(...)` sin array por `useEffect(..., [])` con array vacío
  - Eliminar la dependencia de `handlers` del efecto

  **Referencia:** `design.md` Sección 2 — FIX-01 (patrón completo en líneas 70-93)

  **Criterio (REQ-01, REQ-02):** Con DevTools > Sources > Event Listeners, al navegar 3 veces entre rutas, el número de listeners `message` activos permanece en exactamente 1.

---

- [x] **1.2** `src/providers/socket-provider.tsx` — Eliminar los 5 `console.log` de debugging

  **Cambio exacto (FIX-07):**
  Eliminar estas 5 líneas (identificadas en `design.md` líneas 570-575):
  ```
  console.log(`⏭️ CLIENTE: Ruta pública detectada (${pathname}), socket omitido`);
  console.log("🔌 Intentando conectar Socket.IO (same-origin) a:", currentOrigin);
  console.log("🟢 CLIENTE: Socket Conectado. ID:", socketInstance.id);
  console.log("🔴 CLIENTE: Socket Desconectado. Razón:", reason);
  console.log("🛑 Limpiando instancia de socket...");
  ```
  **Conservar** los dos `console.error` que registran errores reales de autenticación.

  > **Nota:** Si el FIX-02 (tarea 2.1) se aplica primero, este cambio se vuelve innecesario porque el archivo se reescribe completo. Verificar antes de aplicar.

  **Referencia:** `design.md` Sección 2 — FIX-07

  **Criterio (REQ-13):** `grep "console.log"` en `src/providers/socket-provider.tsx` retorna 0 resultados.

---

- [x] **1.3** `src/lib/prisma.ts` — Invertir condición del singleton para desarrollo

  **Cambio exacto (FIX-06):**
  En las líneas 41-47 del archivo, reemplazar:
  ```typescript
  // ANTES (incorrecto):
  if (process.env.NODE_ENV !== "development") {
    globalForPrisma.prisma = prisma;
  }
  ```
  Por:
  ```typescript
  // DESPUÉS (correcto):
  if (process.env.NODE_ENV === "development") {
    globalForPrisma.prisma = prisma;
  }
  ```
  **Un solo carácter cambia:** `!==` → `===`

  **Referencia:** `design.md` Sección 2 — FIX-06 (patrón completo en líneas 548-557)

  **Criterio (REQ implícito de estabilidad):** En `npm run dev`, al guardar cualquier archivo, la consola del servidor NO muestra el warning `"warn(prisma-client) There are already 10 instances of Prisma Client"`.

---

- [x] **1.4** `src/components/ui/globe.tsx` — Eliminar el archivo (componente sin usuarios)

  **Acción:** Eliminar el archivo `src/components/ui/globe.tsx` del filesystem.

  **Referencia:** `design.md` Sección 2 — FIX-08 (confirmado: no tiene importadores en el proyecto)

  **Criterio (REQ-12):** El archivo `src/components/ui/globe.tsx` no existe. `npm run build` compila sin error de módulo faltante.

---

- [x] **1.5** `package.json` — Desinstalar la dependencia `cobe`

  **Comando:**
  ```bash
  npm uninstall cobe
  ```

  **Referencia:** `design.md` Sección 2 — FIX-08

  **Criterio (REQ-12):** `cobe` no aparece en `package.json` ni en `node_modules`. `npm run build` completa sin warnings de `cobe`.

---

## Fase 2 — Fixes Estructurales (~3–4 horas)

> Cambios con lógica de estado o reestructuración de componentes. Aplicar en orden secuencial para minimizar conflictos.

- [x] **2.1** `src/providers/socket-provider.tsx` — Separar el `useEffect` de conexión del `pathname`

  **Cambio (FIX-02):** Reemplazar el `useEffect` actual (que tiene `pathname` en sus dependencias) por dos efectos separados:

  1. **Efecto de conexión** — deps `[]` (se ejecuta solo al montar):
     - Llama a `connectSocket()` si la ruta inicial NO es pública
     - Retorna cleanup que desconecta y limpia `socketRef.current`
     - NO incluye `pathname` en las dependencias

  2. **Efecto de guarda de ruta** — deps `[pathname]`:
     - Solo desconecta (sin reconectar) cuando `isPublicRoute(pathname)` es `true`
     - No reconecta — la reconexión solo ocurre si el provider se desmonta y remonta

  Además:
  - Agregar `const socketRef = useRef<Socket | null>(null)` para mantener referencia estable
  - Mover `DISABLED_ROUTES` a una constante fuera del componente
  - Extraer función `isPublicRoute(path)` fuera del componente

  **Referencia:** `design.md` Sección 2 — FIX-02 (implementación completa en líneas 142-275)

  **Criterio (REQ-03, REQ-04, REQ-05):** DevTools > Network > WS: al navegar entre `/dashboard`, `/productos`, `/clientes` con el socket ya establecido, NO aparece ningún nuevo handshake WebSocket. La columna "Status" de la conexión WS existente permanece en estado activo.

---

- [x] **2.2** `src/components/notifications-panel.tsx` — Eliminar instancia interna de `useNotifications`

  **Cambio (FIX-03):**
  - Localizar las líneas 261-263 donde se declara `internalNotificationsState = useNotifications()`
  - Eliminar esa línea y la lógica `const activeState = externalNotificationsState || internalNotificationsState`
  - Reemplazar por desestructuración directa de la prop: `const { notifications, markAllAsRead, unreadCount, loading } = notificationsState`
  - Actualizar la firma del componente `NotificationsAnimatedPanel` para que `notificationsState` sea parámetro requerido (no opcional)
  - Actualizar el tipo TypeScript: `notificationsState: ReturnType<typeof useNotifications>`

  **En `src/components/sidebar-dock.tsx`:** Sin cambios necesarios — ya pasa `notificationsState` correctamente (línea 152).

  **Referencia:** `design.md` Sección 2 — FIX-03 (patrón completo en líneas 322-345)

  **Criterio (REQ-06, REQ-07):** DevTools > Network: al hacer click en el ícono de notificaciones, aparece exactamente 1 petición GET al endpoint de notificaciones (no 2). Al cerrar y re-abrir, aparece exactamente 1 petición adicional.

---

- [x] **2.3** `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` — Migrar de `getProductos()` a `getProductosPaginados()`

  **Cambio (FIX-04, parte 1):**
  - Localizar la llamada a `apiService.getProductos()` (alrededor de línea 100) dentro del `Promise.all`
  - Agregar estado local de paginación:
    ```typescript
    const [productosPage, setProductosPage] = React.useState(1);
    const [productosTotalPages, setProductosTotalPages] = React.useState(1);
    const [productosLoading, setProductosLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    ```
  - Crear función `fetchProductosPaginados(page, search)` con `useCallback` (deps `[]`)
  - Dentro de la función: llamar a `apiService.getProductosPaginados({ page, limit: 50, search: search || undefined })`
  - Filtrar activos con `.filter((p) => p.activo !== false)`
  - Actualizar estado con `setProductos`, `setProductosTotalPages`, `setProductosPage`
  - Reemplazar la llamada a `getProductos()` en el `Promise.all` por la primera llamada a `fetchProductosPaginados(1, "")`
  - Agregar `useEffect` que re-dispara el fetch cuando `searchQuery` cambia (reinicia a página 1)

  **Sin cambios en:**
  - `src/lib/apiService.ts` — `getProductosPaginados` ya existe (líneas 385-400)
  - `src/app/api/productos/route.ts` — ya soporta paginación (líneas 47-141)

  **Referencia:** `design.md` Sección 2 — FIX-04 (patrón completo en líneas 377-413)

  **Criterio (REQ-08, REQ-09):** DevTools > Network: al abrir `/ventas/nueva`, el primer fetch de productos tiene URL `GET /api/productos?page=1&limit=50`. El componente muestra máximo 50 productos.

---

- [x] **2.4** `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` — Agregar controles de paginación y conectar búsqueda

  **Cambio (FIX-04, parte 2):**
  - Conectar el campo de búsqueda existente al estado `searchQuery` (si hay un handler `onChange`, actualizar para llamar `setSearchQuery`)
  - Al cambiar la búsqueda, reiniciar paginación a página 1 (el `useEffect` de la tarea 2.3 ya lo hace)
  - Si existe filtro por `categoriaId`, pasarlo como parámetro adicional a `getProductosPaginados({ ..., categoriaId })`
  - Agregar botones Anterior/Siguiente (o equivalente) que llamen a `fetchProductosPaginados(productosPage ± 1, searchQuery)`
  - Mostrar indicador de página: `"Página X de Y"` o similar
  - Deshabilitar botón "Anterior" en página 1, deshabilitar "Siguiente" cuando `productosPage === productosTotalPages`

  **Referencia:** `design.md` Sección 2 — FIX-04; `spec.md` REQ-09, REQ-10; Escenarios 4.B, 4.C

  **Criterio (REQ-09, REQ-10):** Al escribir en el campo de búsqueda, el fetch incluye `&search=<término>` y la paginación reinicia a página 1. Al hacer click en "Siguiente", el fetch incluye `&page=2&limit=50`.

---

- [x] **2.5** `src/app/(system-guard)/(protected)/dashboard/page.tsx` + nuevo archivo — Lazy loading de `@dnd-kit`

  **Cambio (FIX-05):**

  **Paso 1 — Crear nuevo componente:**
  Crear `src/app/(system-guard)/(protected)/dashboard/components/kpi-sortable-grid.tsx`:
  - Mover todos los imports de `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` al nuevo archivo
  - Mover el componente `SortableKpiCard` al nuevo archivo
  - Mover el componente principal (el grid con `DndContext`) al nuevo archivo
  - Exportar el componente principal como `KpiSortableGrid`
  - Mover también: tipo `KpiConfig`, funciones `mergeKpiOrder`, y cualquier helper que use tipos de `@dnd-kit`
  - Agregar `"use client"` al tope del nuevo archivo

  **Paso 2 — Actualizar `dashboard/page.tsx`:**
  - Eliminar todos los imports estáticos de `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
  - Eliminar la definición inline de `SortableKpiCard` y del grid
  - Agregar import dinámico:
    ```typescript
    import dynamic from "next/dynamic";
    const KpiSortableGrid = dynamic(
      () => import("./components/kpi-sortable-grid").then((m) => m.KpiSortableGrid),
      {
        ssr: false,
        loading: () => (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card h-28 animate-pulse" />
            ))}
          </div>
        ),
      }
    );
    ```
  - Reemplazar el JSX inline del grid por `<KpiSortableGrid ... />`

  **Patrón de referencia:** El mismo archivo ya usa `dynamic()` para `TendenciaSection` (líneas 11-14 de `dashboard/page.tsx`). Seguir el mismo patrón.

  **Referencia:** `design.md` Sección 2 — FIX-05 (patrón completo en líneas 466-524)

  **Criterio (REQ-11):** `npm run build` muestra `@dnd-kit` como chunk separado (no incluido en `First Load JS` del dashboard). El dashboard muestra skeleton durante la carga inicial del chunk.

---

- [x] **2.6** `src/app/api/productos/route.ts` — Agregar validación explícita HTTP 400 para `limit > 200`

  **Cambio (FIX-04, parte API):**
  Localizar la línea ~54 donde se parsea el parámetro `limit`. Agregar validación explícita antes del clamping:
  ```typescript
  if (limitParam && parseInt(limitParam, 10) > 200) {
    return NextResponse.json(
      { error: "El parámetro 'limit' no puede superar 200." },
      { status: 400 }
    );
  }
  const limit = Math.min(200, Math.max(1, parseInt(limitParam || "30", 10) || 30));
  ```

  **Referencia:** `design.md` Sección 2 — FIX-04 (validación API en líneas 415-427); `spec.md` REQ-08, Escenario 4.D

  **Criterio (REQ-08, Escenario 4.D):** `GET /api/productos?limit=500` retorna HTTP 400 con `{ error: "El parámetro 'limit' no puede superar 200." }`.

---

## Fase 3 — Verificación Manual (~45 minutos)

> Verificación en navegador con Chrome DevTools. Ejecutar después de completar todas las tareas de Fase 1 y Fase 2.

- [ ] **3.1** Verificar FIX-01 (`useBroadcastChannel`)

  1. Abrir la aplicación en Chrome con DevTools abierto
  2. Ir a DevTools > Sources > Event Listeners panel (o Performance > Record)
  3. Navegar entre 3 rutas distintas usando el Sidebar (ej. Dashboard → Productos → Clientes)
  4. **Criterio:** El número de listeners activos del `BroadcastChannel` permanece en exactamente 1. No hay picos de re-suscripción repetidos en el flame chart.
  5. **Req cubiertos:** REQ-01, REQ-02

---

- [ ] **3.2** Verificar FIX-02 (WebSocket sin reconexión por pathname)

  1. Abrir DevTools > Network > filtrar por "WS" (WebSocket)
  2. Navegar a `/dashboard` y esperar que el socket se conecte
  3. Navegar a `/productos`, luego a `/clientes`, luego de regreso a `/dashboard`
  4. **Criterio:** La conexión WebSocket original permanece abierta (estado "101 Switching Protocols" + sin cierre). NO aparece ningún nuevo handshake WS durante las navegaciones.
  5. **Req cubiertos:** REQ-03, REQ-04, REQ-05, Escenarios 2.A, 2.C

---

- [ ] **3.3** Verificar FIX-03 (Notificaciones: fetch único)

  1. Abrir DevTools > Network > filtrar por "notificaciones"
  2. Limpiar el log de Network
  3. Hacer click en el ícono de notificaciones para abrir el panel
  4. **Criterio:** Aparece exactamente 1 petición GET al endpoint `/api/notificaciones`
  5. Cerrar el panel y volver a abrirlo
  6. **Criterio:** Aparece exactamente 1 petición adicional (no 2, no 0)
  7. **Req cubiertos:** REQ-06, REQ-07, Escenarios 3.A, 3.B

---

- [ ] **3.4** Verificar FIX-04 (POS Paginación y búsqueda)

  1. Abrir `/ventas/nueva` con DevTools > Network abierto
  2. **Criterio A:** El primer fetch tiene URL `GET /api/productos?page=1&limit=50` y responde en < 1 segundo
  3. **Criterio B:** La UI muestra máximo 50 productos y muestra controles de paginación
  4. Escribir un término en el campo de búsqueda
  5. **Criterio C:** El fetch incluye `&search=<término>` y la paginación reinicia a página 1
  6. Si hay más de 50 productos, hacer click en "Siguiente"
  7. **Criterio D:** El fetch tiene `&page=2&limit=50`
  8. Simular "Fast 3G" en DevTools > Network > Throttle y recargar
  9. **Criterio E:** Los primeros 10 productos se renderizan en < 1 segundo
  10. **Req cubiertos:** REQ-08, REQ-09, REQ-10, Escenarios 4.A, 4.B, 4.C, PERF-03

---

- [ ] **3.5** Verificar FIX-05 (dnd-kit lazy loading en dashboard)

  1. Ejecutar `npm run build` y revisar el output de la consola
  2. **Criterio A:** En la sección "Route (app)" del build output, el chunk del dashboard NO incluye `@dnd-kit` en el "First Load JS"
  3. **Criterio B:** Existe un chunk separado (lazy) que contiene el código de `kpi-sortable-grid`
  4. Abrir el dashboard en modo incógnito con DevTools > Network activado
  5. **Criterio C:** Durante la carga inicial se muestra el skeleton (divs con `animate-pulse`) brevemente
  6. **Req cubiertos:** REQ-11, Escenario 5.A

---

- [ ] **3.6** Verificar FIX-06 (Singleton Prisma en desarrollo)

  1. Tener `npm run dev` corriendo
  2. Modificar cualquier archivo de la aplicación y guardarlo para forzar hot reload
  3. Observar la consola del servidor (terminal donde corre `npm run dev`)
  4. **Criterio:** NO aparece el warning `"warn(prisma-client) There are already 10 instances of Prisma Client"` ni variantes del mismo
  5. Repetir el hot reload 3–5 veces
  6. **Criterio:** El número de conexiones PostgreSQL activas no crece indefinidamente (verificable en `pg_stat_activity` si se tiene acceso)
  7. **Req cubiertos:** Corrección del singleton pattern (design.md FIX-06)

---

- [ ] **3.7** Build final limpio

  1. Ejecutar `npm run build`
  2. **Criterio A:** El build completa **sin errores TypeScript** (0 errores de tipo)
  3. **Criterio B:** No aparecen warnings **nuevos** que no existían antes del change (comparar con baseline)
  4. **Criterio C:** No aparecen mensajes relacionados con `cobe` (dependencia eliminada)
  5. **Criterio D:** No aparecen errores de módulo faltante por `globe.tsx` eliminado
  6. **Req cubiertos:** REQ-12, Escenarios 5.B, 5.C; criterio general de no-regresión

---

## Notas de Implementación

### Orden de aplicación recomendado

```
Fase 1 (cualquier orden) → 2.6 → 2.3 → 2.4 → 2.2 → 2.1 → 2.5 → Fase 3
```

La tarea 2.6 (validación API) es independiente y puede ir primero. Las tareas 2.3 y 2.4 van juntas (mismo archivo). La tarea 2.1 (socket-provider) absorbe la 1.2 si se aplica después.

### Preguntas abiertas (del design.md)

- **[ABIERTA] FIX-02 — Reconexión por cambio de sucursal (Escenario 2.B):** El diseño no integra aún el mecanismo BroadcastChannel con el provider. Si se requiere reconexión al cambiar de sucursal, es una tarea adicional. Debe decidirse antes de aplicar 2.1.
- **[ABIERTA] FIX-04 — UI de paginación:** El diseño asume botones Anterior/Siguiente. Si se prefiere scroll infinito, la lógica de fetching cambia (ver `design.md` Sección 6).
- **[ABIERTA] FIX-05 — Tipos extraídos:** `KpiConfig`, `mergeKpiOrder` y `SortableKpiCard` se mueven al nuevo componente. Decidir si algunos tipos van a `src/lib/types.ts` para reutilización futura.

### Archivos que NO cambian en este change

| Archivo | Razón |
|---------|-------|
| `src/lib/apiService.ts` | `getProductosPaginados` ya existe (líneas 385-400) |
| `src/components/sidebar-dock.tsx` | Ya pasa `notificationsState` correctamente |
| `src/lib/broadcast-channel.ts` | Ya retorna cleanup correcto; no requiere cambios |
| Schema Prisma / migraciones | Fuera de alcance explícito |

---

## Próximo paso

Una vez creado este archivo: **sdd-apply** — implementar las tareas en el orden indicado, comenzando por Fase 1.
