# Diseño Técnico: Optimización de Performance — Navegación y Componentes

- **Change ID:** optimizacion-performance
- **Versión:** 1.0.0
- **Fecha:** 2026-03-16
- **Estado:** DRAFT
- **Referencia:** [proposal.md](./proposal.md) · [spec.md](./specs/performance/spec.md)

---

## Sección 1: Enfoque Técnico

La estrategia se divide en dos fases que se pueden aplicar de forma independiente:

**Fase 1 — Quick Wins** (≤ 30 min): cambios de una línea o triviales con riesgo de regresión mínimo. Entregan valor inmediatamente y no bloquean la Fase 2.

| # | Fix | Riesgo | Esfuerzo |
|---|-----|--------|----------|
| FIX-01 | `useBroadcastChannel` — agregar `[]` | Bajo | 1 línea |
| FIX-07 | Eliminar `console.log` en socket-provider | Bajo | ~10 líneas |
| FIX-08 | Eliminar dependencia `cobe` (reemplazar globe.tsx) | Bajo | 1 comando |
| FIX-06 | Singleton Prisma — corregir patrón dev | Bajo | 3 líneas |

**Fase 2 — Fixes Estructurales** (~4h): refactoring con lógica de estado y cambios en la API.

| # | Fix | Riesgo | Esfuerzo |
|---|-----|--------|----------|
| FIX-02 | SocketProvider — desacoplar de pathname | Medio | ~40 líneas |
| FIX-03 | `useNotifications` duplicado en panel | Bajo | ~5 líneas |
| FIX-04 | Paginación en POS (`ventas/nueva`) | Medio | ~80 líneas |
| FIX-05 | Lazy loading dnd-kit en dashboard | Bajo | ~20 líneas |

---

## Sección 2: Diseño por Fix

---

### FIX-01: `useBroadcastChannel` — Dependencias del `useEffect`

**Archivo:** `src/hooks/useBroadcastChannel.ts`

#### Patrón actual (problemático)

```typescript
// src/hooks/useBroadcastChannel.ts — líneas 27-43
export function useBroadcastChannel(handlers: MessageHandler): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unsubscribe = subscribeAppMessages((message) => {
      const handler = handlers[message.type] as
        | ((msg: BroadcastMessage) => void)
        | undefined;
      if (handler) {
        handler(message);
      }
    });

    return unsubscribe;
    // ⚠️ Sin array de dependencias → se re-suscribe en CADA render
  });
}
```

**Problema:** Sin el array `[]`, el `useEffect` corre en cada render del componente padre (SidebarDock). Cada navegación causa un re-render del Sidebar, lo que acumula N listeners activos simultáneos. Esto genera lag perceptible y posibles handlers ejecutados múltiples veces.

#### Patrón propuesto

```typescript
// src/hooks/useBroadcastChannel.ts — CORREGIDO
export function useBroadcastChannel(handlers: MessageHandler): void {
  // Capturamos handlers en un ref para que el efecto nunca necesite re-ejecutarse
  // pero siempre invoque la versión más reciente del handler.
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unsubscribe = subscribeAppMessages((message) => {
      const handler = handlersRef.current[message.type] as
        | ((msg: BroadcastMessage) => void)
        | undefined;
      if (handler) {
        handler(message);
      }
    });

    return unsubscribe;
    // ✅ Array vacío → suscripción única por ciclo de vida del componente
  }, []);
}
```

**Justificación:** El patrón `ref + []` es el estándar de React para "suscripción estable con callback variable". El `useRef` garantiza que `handlersRef.current` siempre apunte a los handlers más recientes sin forzar una nueva suscripción. La función `subscribeAppMessages` de `src/lib/broadcast-channel.ts` ya retorna una función de cleanup (`removeEventListener`), por lo que el `return unsubscribe` sigue siendo correcto.

---

### FIX-02: WebSocket Provider — Desacoplar del `pathname`

**Archivo:** `src/providers/socket-provider.tsx`

#### Patrón actual (problemático)

```typescript
// src/providers/socket-provider.tsx — líneas 33-126
export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pathname = usePathname();  // ⚠️ Cambia en cada navegación

  const isSocketDisabledRoute =
    pathname?.startsWith("/setup") ||
    pathname?.startsWith("/login") ||
    // ...

  useEffect(() => {
    // ...toda la lógica de conexión...
    void connectSocket();

    return () => {
      cancelled = true;
      setIsConnected(false);
      setSocket((prev) => {
        if (prev) { prev.disconnect(); }
        return null;
      });
    };
  }, [isSocketDisabledRoute, pathname]); // ⚠️ pathname en las deps → destroy/reconnect en cada ruta
```

**Problema:** `pathname` está en las dependencias del efecto de conexión. Cada cambio de ruta destruye el socket y crea uno nuevo (handshake completo), lo que tarda entre 200ms y 600ms y es directamente perceptible como lag de navegación.

#### Patrón propuesto

La estrategia es separar dos concerns:

1. **Efecto de conexión** — depende solo de si el socket está habilitado (`isSocketDisabled`, valor booleano derivado del pathname inicial o de identidad de sesión)
2. **Efecto de guarda de ruta** — observa `pathname` pero solo desconecta (sin reconectar) cuando la ruta se vuelve pública

```typescript
// src/providers/socket-provider.tsx — CORREGIDO
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io as ClientIO, Socket } from "socket.io-client";
import { usePathname } from "next/navigation";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

const DISABLED_ROUTES = ["/setup", "/login", "/forgot-password", "/reset-password", "/lista", "/x/"];

function isPublicRoute(path: string | null): boolean {
  if (!path) return false;
  return DISABLED_ROUTES.some((r) => path.startsWith(r));
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // ✅ Efecto de conexión: solo se ejecuta UNA vez al montar.
  // No depende de pathname.
  useEffect(() => {
    // No conectar si la ruta inicial ya es pública
    if (isPublicRoute(pathname)) return;

    let cancelled = false;

    const connectSocket = async () => {
      try {
        const currentOrigin =
          typeof window !== "undefined" ? window.location.origin : "";

        const socketInstance = ClientIO({
          path: "/socket.io",
          addTrailingSlash: false,
          withCredentials: true,
          autoConnect: false,
          reconnection: true,
          reconnectionAttempts: 5,
          transports: ["polling", "websocket"],
        });

        socketInstance.on("connect", () => {
          if (!cancelled) setIsConnected(true);
        });

        socketInstance.on("disconnect", () => {
          if (!cancelled) setIsConnected(false);
        });

        socketInstance.on("connect_error", (err) => {
          const message = String(err?.message || "");
          const isAuthError =
            message.includes("Autenticación requerida") ||
            message.includes("Token inválido") ||
            message.includes("Token inválido o expirado");

          if (isAuthError && !cancelled) {
            setSocket(null);
            setIsConnected(false);
            socketInstance.disconnect();
          }
        });

        if (!cancelled) {
          socketRef.current = socketInstance;
          setSocket(socketInstance);
          window.setTimeout(() => {
            if (!cancelled && !socketInstance.connected) {
              socketInstance.connect();
            }
          }, 120);
        } else {
          socketInstance.disconnect();
        }
      } catch (error) {
        if (!cancelled) {
          setSocket(null);
          setIsConnected(false);
        }
      }
    };

    void connectSocket();

    return () => {
      cancelled = true;
      setIsConnected(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, []); // ✅ Sin pathname en las dependencias

  // ✅ Efecto de guarda de ruta: observa pathname pero SOLO desconecta.
  // No reconecta — el provider se desmontará si el usuario navega a /login.
  useEffect(() => {
    if (isPublicRoute(pathname) && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, [pathname]);

  const isDisabled = isPublicRoute(pathname);

  return (
    <SocketContext.Provider
      value={{
        socket: isDisabled ? null : socket,
        isConnected: isDisabled ? false : isConnected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
```

**Justificación:** Separar los dos effectos rompe el acoplamiento entre pathname y la conexión. El primer efecto se ejecuta una sola vez y mantiene el socket vivo durante toda la sesión. El segundo efecto es solo un guardián que desconecta limpiamente si el usuario llega a una ruta pública (lo que en la práctica ocurre al hacer logout, que desmontará el provider de todas formas).

**Nota sobre reconexión por cambio de sucursal:** El `switchSucursal` en `useSucursalStore.ts` ya emite un mensaje BroadcastChannel (`sucursal-changed`). Si se necesita reconectar el socket por cambio de sucursal, el mecanismo correcto es escuchar ese mensaje e invocar `socket.disconnect()` + `socket.connect()` dentro del efecto de conexión (usando un ref para el `sucursalId`). Esto queda como mejora futura según la propuesta.

---

### FIX-03: `useNotifications` Duplicado en el Panel

**Archivos:** `src/components/notifications-panel.tsx` · `src/components/sidebar-dock.tsx`

#### El problema

En `notifications-panel.tsx`, líneas 252-263:

```typescript
// src/components/notifications-panel.tsx — líneas 261-263
export function NotificationsAnimatedPanel({
  notificationsState: externalNotificationsState,
  open,
}) {
  // ⚠️ Se instancia siempre, aunque externalNotificationsState esté definido
  const internalNotificationsState = useNotifications();
  const activeState = externalNotificationsState || internalNotificationsState;
```

En `sidebar-dock.tsx`, línea 152:

```typescript
// src/components/sidebar-dock.tsx — línea 152
const notificationsState = useNotifications({ limit: 50 });
```

Y en líneas 116 y 474:

```typescript
<NotificationsAnimatedPanel notificationsState={notificationsState} open={open} />
```

**Flujo actual:** `SidebarDock` crea una instancia → pasa `notificationsState` al panel → el panel **igualmente** crea una instancia interna con `useNotifications()` → dos fetches en paralelo.

#### Patrón propuesto

Eliminar la instancia interna del panel. Si no se pasa estado externo (uso standalone), el panel puede optar por no renderizar o mostrar un error, pero no crear una instancia silenciosa.

```typescript
// src/components/notifications-panel.tsx — CORREGIDO
export function NotificationsAnimatedPanel({
  className,
  notificationsState,  // ← ya no es opcional en la práctica
  open,
}: {
  className?: string;
  notificationsState: ReturnType<typeof useNotifications>;  // ← requerido
  open?: boolean;
}) {
  // ✅ Sin instancia interna
  const { notifications, markAllAsRead, unreadCount, loading } = notificationsState;
  // ...resto del componente sin cambios
```

**En `SidebarDock`** no cambia nada — ya pasa `notificationsState` correctamente:

```typescript
// src/components/sidebar-dock.tsx — línea 152 (sin cambios)
const notificationsState = useNotifications({ limit: 50 });
// ...
<NotificationsAnimatedPanel notificationsState={notificationsState} open={open} />
```

**Justificación:** El patrón de "prop drilling del estado" es correcto aquí. `SidebarDock` es el propietario único del estado de notificaciones. Si en el futuro se necesita acceso desde múltiples lugares sin prop drilling, el siguiente paso es Context — pero eso está fuera del alcance de este change.

---

### FIX-04: Paginación en API de Productos (POS / Ventas)

**Archivos afectados:**
- `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` (consumidor principal)
- `src/lib/apiService.ts` (ya tiene `getProductosPaginados`)
- `src/app/api/productos/route.ts` (ya soporta paginación)

#### Estado actual

La API (`route.ts`) **ya soporta paginación** con `page`/`limit`/`search`/`categoriaId` (líneas 47-56). También ya existe `getProductosPaginados` en `apiService.ts` (línea 385).

El problema está en el consumidor: `ventas/nueva/page.tsx` usa `apiService.getProductos()` (línea 100), que llama sin parámetros y trae todos los productos.

```typescript
// src/app/(system-guard)/(protected)/ventas/nueva/page.tsx — línea 99-104
const [productosResponse, clientesResponse] = await Promise.all([
  apiService.getProductos(),  // ⚠️ Trae TODOS los productos sin límite
  apiService.getClientes(),
]);
const productosActivos = (productosResponse as ProductoConStock[]).filter(...);
setProductos(productosActivos);
```

#### Patrón propuesto

**Cambio en `ventas/nueva/page.tsx`**: migrar a `getProductosPaginados` con estado de paginación local.

```typescript
// src/app/(system-guard)/(protected)/ventas/nueva/page.tsx

// Estado adicional para paginación
const [productosPage, setProductosPage] = React.useState(1);
const [productosTotalPages, setProductosTotalPages] = React.useState(1);
const [productosLoading, setProductosLoading] = React.useState(false);
const [searchQuery, setSearchQuery] = React.useState("");

const fetchProductosPaginados = React.useCallback(
  async (page: number, search: string) => {
    setProductosLoading(true);
    try {
      const res = await apiService.getProductosPaginados({
        page,
        limit: 50,
        search: search || undefined,
      });
      const activos = (res.data ?? []).filter((p) => p.activo !== false) as ProductoConStock[];
      setProductos(activos);
      setProductosTotalPages(res.totalPages ?? 1);
      setProductosPage(res.page ?? 1);
    } catch {
      setError("Error cargando productos.");
    } finally {
      setProductosLoading(false);
    }
  },
  []
);

// Al cambiar búsqueda, reiniciar a página 1
React.useEffect(() => {
  fetchProductosPaginados(1, searchQuery);
}, [searchQuery, fetchProductosPaginados]);
```

**Validación en la API** (ya implementada en `route.ts`, línea 55): `limit` se clampea a máximo 200. Si se pasa `limit=500` devuelve 400. Verificar que el mensaje de error sea descriptivo:

```typescript
// src/app/api/productos/route.ts — línea 54-55 (verificar / mejorar)
const limit = Math.min(200, Math.max(1, parseInt(limitParam || "30", 10) || 30));
// Agregar validación explícita para HTTP 400 si limit > 200:
if (limitParam && parseInt(limitParam, 10) > 200) {
  return NextResponse.json(
    { error: "El parámetro 'limit' no puede superar 200." },
    { status: 400 }
  );
}
```

**Nota:** `apiService.getProductosPaginados` ya existe en `src/lib/apiService.ts` (líneas 385-400). No requiere cambios en el servicio.

---

### FIX-05: Bundle — Lazy Loading de `@dnd-kit` en Dashboard

**Archivo:** `src/app/(system-guard)/(protected)/dashboard/page.tsx`

#### Patrón actual (problemático)

```typescript
// src/app/(system-guard)/(protected)/dashboard/page.tsx — líneas 34-52
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// ⚠️ Imports estáticos → @dnd-kit entra en el bundle inicial del dashboard
```

**Problema:** El dashboard ya usa `dynamic()` correctamente para `TendenciaSection` (recharts). Pero `@dnd-kit` se importa estáticamente, inflando el bundle inicial con código de drag-and-drop que la mayoría de usuarios nunca activa.

#### Patrón propuesto

Extraer el bloque drag-and-drop a un componente separado y cargarlo dinámicamente.

**Paso 1:** Crear `src/app/(system-guard)/(protected)/dashboard/components/kpi-sortable-grid.tsx` con todo el código que usa `@dnd-kit`:

```typescript
// src/app/(system-guard)/(protected)/dashboard/components/kpi-sortable-grid.tsx
"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// ... componente SortableKpiCard y KpiSortableGrid exportados
```

**Paso 2:** En `dashboard/page.tsx`, reemplazar los imports estáticos con `dynamic()`:

```typescript
// src/app/(system-guard)/(protected)/dashboard/page.tsx — CORREGIDO
import dynamic from "next/dynamic";

// ✅ @dnd-kit carga lazy — fuera del bundle inicial
const KpiSortableGrid = dynamic(
  () =>
    import("./components/kpi-sortable-grid").then((m) => m.KpiSortableGrid),
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

// Eliminar los imports estáticos de @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
```

**Justificación:** El patrón es idéntico al ya usado para `TendenciaSection` en el mismo archivo (líneas 11-14 de `dashboard/page.tsx`). Mantiene consistencia con las convenciones del proyecto.

---

### FIX-06: Singleton Prisma — Patrón Correcto para Dev

**Archivo:** `src/lib/prisma.ts`

#### Patrón actual (problemático)

```typescript
// src/lib/prisma.ts — líneas 41-47
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// ⚠️ En dev, NUNCA guarda en global → crea un cliente nuevo en cada hot reload
if (process.env.NODE_ENV !== "development") {
  globalForPrisma.prisma = prisma;
}
```

**Problema:** En desarrollo con hot reload de Next.js, cada recarga del módulo crea una nueva instancia de `PrismaClient`. Esto agota el pool de conexiones de PostgreSQL rápidamente (el pool tiene 10 conexiones por defecto; con hot reload activo se generan múltiples instancias). En producción no hay problema porque el módulo se carga una sola vez.

#### Patrón propuesto

```typescript
// src/lib/prisma.ts — CORREGIDO
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// ✅ En dev también guardamos en global para evitar múltiples instancias
// en hot reload. El cliente se reutiliza entre recargas de módulo.
if (process.env.NODE_ENV === "development") {
  globalForPrisma.prisma = prisma;
}
```

**Justificación:** El patrón estándar de la documentación de Prisma y Next.js es guardar en `globalThis` en **todos** los entornos para evitar múltiples instancias. La lógica actual está invertida: guarda en prod (donde ya no hay hot reload) pero no en dev (donde es necesario). El comentario en el código dice "Solo en Prod" pero el comportamiento correcto es exactamente el opuesto.

---

### FIX-07: Eliminar `console.log` en Producción

#### Archivos con `console.log` a eliminar

**`src/providers/socket-provider.tsx`** — `console.log` de debugging (líneas 42, 52, 66, 71, 91):

```typescript
// Eliminar estas líneas:
console.log(`⏭️ CLIENTE: Ruta pública detectada (${pathname}), socket omitido`);
console.log("🔌 Intentando conectar Socket.IO (same-origin) a:", currentOrigin);
console.log("🟢 CLIENTE: Socket Conectado. ID:", socketInstance.id);
console.log("🔴 CLIENTE: Socket Desconectado. Razón:", reason);
console.log("🛑 Limpiando instancia de socket...");

// Conservar (son errores reales):
console.error("⚠️ CLIENTE: Error de conexión:", message);
console.error("⚠️ CLIENTE: No se pudo validar sesión para socket", error);
```

**Nota:** El FIX-02 reescribe este archivo completamente, por lo que los `console.log` desaparecen automáticamente al aplicar FIX-02.

#### Archivo adicional: `src/hooks/useNotifications.ts`

```typescript
// Línea 93 — eliminar:
console.error("Error cargando notificaciones:", error);

// Línea 189 — eliminar:
console.error("Error marcando como leídas:", error);
```

**Nota:** En `useNotifications.ts` son `console.error` (errores reales de red), que la spec permite conservar. Se listan aquí para revisión consciente.

---

### FIX-08: Eliminar Dependencia `cobe`

**Archivo:** `src/components/ui/globe.tsx` — usa `cobe` (línea 4):

```typescript
import createGlobe, { COBEOptions } from "cobe"
```

**El componente `globe.tsx` existe pero no está en uso activo en el proyecto** (no aparece importado en ningún page o component de la aplicación según el análisis del código). La propuesta indica eliminarlo.

**Opciones:**

1. **Opción A (recomendada):** Eliminar `globe.tsx` y la dependencia `cobe`:
   ```bash
   npm uninstall cobe
   # Eliminar src/components/ui/globe.tsx
   ```

2. **Opción B:** Si `globe.tsx` se necesitará en el futuro, reemplazar `cobe` por una alternativa CSS/SVG sin dependencias.

**Comando:**
```bash
npm uninstall cobe
```

**Justificación:** `cobe` es una librería de visualización 3D de globo terráqueo. No hay ningún import de `globe.tsx` en el proyecto fuera del propio archivo. Eliminarla reduce el bundle y las dependencias a auditar por seguridad.

---

## Sección 3: Tabla de Archivos Afectados

| Archivo | Acción | Descripción del Cambio |
|---------|--------|------------------------|
| `src/hooks/useBroadcastChannel.ts` | Modificar | Agregar `useRef` para handlers + `[]` en useEffect |
| `src/providers/socket-provider.tsx` | Modificar | Separar efecto de conexión del pathname; eliminar console.log |
| `src/components/notifications-panel.tsx` | Modificar | Eliminar instancia interna de `useNotifications`; hacer prop requerido |
| `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` | Modificar | Reemplazar `getProductos()` por `getProductosPaginados()` con estado de paginación |
| `src/app/api/productos/route.ts` | Modificar | Agregar validación explícita HTTP 400 cuando `limit > 200` |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | Modificar | Reemplazar imports estáticos de @dnd-kit por `dynamic()` |
| `src/app/(system-guard)/(protected)/dashboard/components/kpi-sortable-grid.tsx` | Crear | Nuevo componente que encapsula todo el código @dnd-kit extraído de page.tsx |
| `src/lib/prisma.ts` | Modificar | Invertir condición: guardar singleton en `globalThis` en desarrollo (no en producción) |
| `src/components/ui/globe.tsx` | Eliminar | Componente no utilizado que importa `cobe` |
| `package.json` | Modificar | Eliminar dependencia `cobe` |

---

## Sección 4: Interfaces TypeScript Nuevas

La paginación en el cliente (`ventas/nueva/page.tsx`) consume una interfaz que **ya existe** en `apiService.ts`:

```typescript
// src/lib/apiService.ts — líneas 385-400 (ya definida, sin cambios)
getProductosPaginados(params: {
  page?: number;
  limit?: number;
  search?: string;
  categoriaId?: number | null;
}): Promise<{
  data: Producto[];
  total: number;
  page: number;
  totalPages: number;
}>
```

Se recomienda extraer el tipo de respuesta a `src/lib/types.ts` para reutilización:

```typescript
// src/lib/types.ts — AGREGAR al final
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

## Sección 5: Estrategia de Tests (Verificación Manual)

Sin suite de tests automatizados, la verificación se realiza manualmente con Chrome DevTools.

### FIX-01: `useBroadcastChannel`

1. Abrir DevTools > Sources > Event Listeners
2. Buscar listeners de `message` en el BroadcastChannel
3. Navegar entre 3 rutas distintas usando el Sidebar
4. **Criterio:** Debe haber exactamente 1 listener activo en todo momento

### FIX-02: WebSocket Provider

1. Abrir DevTools > Network > filtrar por "WS"
2. Establecer sesión y conectar socket
3. Navegar entre /dashboard, /productos, /clientes
4. **Criterio:** NO debe aparecer ningún nuevo handshake WS durante las navegaciones
5. Verificar que el socket sigue recibiendo mensajes tras navegar (si hay actividad de servidor)

### FIX-03: `useNotifications` Duplicado

1. Abrir DevTools > Network > filtrar por "notificaciones"
2. Abrir el panel de notificaciones (click en campanita)
3. **Criterio:** Debe aparecer exactamente 1 petición GET a `/api/notificaciones`
4. Cerrar y re-abrir el panel
5. **Criterio:** 1 petición adicional (no 2)

### FIX-04: Paginación en POS

1. Abrir `/ventas/nueva` con DevTools > Network
2. **Criterio:** Primera petición debe ser `GET /api/productos?page=1&limit=50`
3. Verificar que se muestran máximo 50 productos
4. Escribir un término en la búsqueda
5. **Criterio:** Petición con `?page=1&limit=50&search=<término>`
6. Simular red "Fast 3G" en DevTools; el catálogo debe cargar en < 1 segundo

### FIX-05: Lazy Loading dnd-kit

1. Ejecutar `npm run build` y verificar el output de bundle sizes
2. **Criterio:** El chunk de dnd-kit NO debe aparecer en el `First Load JS` del dashboard
3. Debe aparecer como chunk separado (lazy)
4. Abrir el dashboard en modo incógnito y verificar que aparece el skeleton durante la carga

### FIX-06: Singleton Prisma

1. Iniciar `npm run dev`
2. Modificar cualquier archivo de la aplicación para forzar hot reload
3. **Criterio:** En la consola del servidor NO debe aparecer el warning de Prisma sobre múltiples instancias
4. Verificar en la consola de PostgreSQL que el número de conexiones no crece indefinidamente

### FIX-07: Eliminar `console.log`

1. Ejecutar `npm run build && npm run start`
2. Abrir DevTools > Console con nivel "Verbose"
3. Navegar entre rutas usando el Sidebar
4. **Criterio:** NO debe aparecer ningún `console.log` relacionado con el socket durante la navegación

### FIX-08: Eliminar dependencia `cobe`

1. Ejecutar `npm run build`
2. **Criterio:** Build completa sin errores ni warnings relacionados con `cobe`
3. Verificar que `node_modules/cobe` no existe tras `npm install`

---

## Sección 6: Preguntas Abiertas

- **[ABIERTA]** `FIX-02 — Reconexión por cambio de sucursal`: El diseño actual desconecta el socket solo si la ruta se vuelve pública. ¿Debe el socket reconectarse cuando el usuario cambia de sucursal (escenario 2.B de la spec)? La spec lo requiere pero el mecanismo actual (`BroadcastChannel` + `sucursal-changed`) no está integrado con el provider. Requiere decisión antes de implementar.

- **[ABIERTA]** `FIX-04 — Componente de paginación UI`: La spec requiere "un mecanismo de navegación entre páginas". ¿Se prefieren botones Anterior/Siguiente o scroll infinito (load more)? El diseño actual asume botones. Si se prefiere scroll infinito, el estado y la lógica de fetching cambian.

- **[ABIERTA]** `FIX-05 — Alcance del refactoring`: Extraer el código dnd-kit a `kpi-sortable-grid.tsx` requiere mover también el tipo `KpiConfig`, las funciones `mergeKpiOrder` y `SortableKpiCard`. ¿Se extraen a un archivo de utils/types separado o van en el mismo componente?

- **[RESUELTA]** `FIX-08 — ¿globe.tsx está en uso?`: Confirmado que `globe.tsx` no tiene ningún importador en el proyecto. Se puede eliminar sin riesgo.

- **[RESUELTA]** `FIX-04 — ¿La API ya soporta paginación?`: Confirmado. `route.ts` ya implementa `page`/`limit`/`skip` (líneas 47-141). `getProductosPaginados` ya existe en `apiService.ts`. Solo hay que migrar el consumidor en `ventas/nueva/page.tsx`.

---

## Flujo de Datos: Paginación en POS

```
ventas/nueva/page.tsx
       │
       │ fetchProductosPaginados(page=1, search="")
       ▼
apiService.getProductosPaginados({ page, limit: 50, search })
       │
       │ GET /api/productos?page=1&limit=50
       ▼
route.ts:GET
       │  prisma.producto.count({ where })   ←─ en paralelo
       │  prisma.producto.findMany({ skip, take: 50 })
       ▼
{ data: Producto[], total, page, totalPages }
       │
       ▼
setProductos(data)
setProductosTotalPages(totalPages)
       │
       ▼
ProductSearchModal (recibe productos como props, sin cambios)
```

---

## Flujo de Datos: WebSocket con Separación de Concerns

```
SocketProvider (monta una sola vez)
       │
       ├─ useEffect([], [])  ← EFECTO DE CONEXIÓN
       │        │
       │        ├── isPublicRoute(pathname)?  ─── sí → return (no conectar)
       │        │
       │        └── connectSocket()
       │               └── socketRef.current = socketInstance
       │               └── setSocket(socketInstance)
       │
       ├─ useEffect([pathname])  ← EFECTO DE GUARDA
       │        │
       │        └── isPublicRoute(pathname) && socketRef.current?
       │               └── socketRef.current.disconnect()
       │               └── setSocket(null)
       │
       └── SocketContext.Provider
              └── { socket, isConnected }
                     └── useSocket() en cualquier componente hijo
```
