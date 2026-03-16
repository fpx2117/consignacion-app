# Propuesta: Optimización de Performance — Navegación y Componentes

## Intención

El usuario percibe un delay apreciable al hacer click en cualquier componente de navegación (Sidebar, links de rutas). Este lag no es inherente a Next.js sino el resultado acumulado de tres patrones problemáticos en el código actual:

1. `useBroadcastChannel` se re-suscribe en cada render del Sidebar (falta `[]` en dependencias)
2. El provider WebSocket destruye y reconecta el socket en cada cambio de `pathname`
3. `useNotifications()` se instancia dos veces en el panel, duplicando fetches
4. `getProductos()` carga todos los registros sin paginación — bloquea en catálogos grandes

El objetivo es eliminar estos bottlenecks para lograr navegación inmediata y perceptiblemente fluida.

## Alcance

### Dentro del Alcance
- Fix de `useBroadcastChannel`: agregar dependencias vacías `[]` al `useEffect`
- Fix del provider WebSocket: eliminar `pathname` de las dependencias del `useEffect` de conexión
- Fix de `useNotifications` duplicado: eliminar instancia redundante en el panel
- Fix de `getProductos` en POS: implementar paginación server-side con cursor o offset
- Eliminación de `console.log` en producción (sidebar-dock, socket provider)
- Fix del singleton Prisma en desarrollo (evitar múltiples instancias con hot reload)
- Lazy loading con `dynamic()` para `@dnd-kit` en dashboard
- Eliminación de dependencia `cobe` (librería muerta no utilizada)
- Optimización de AnimatedList: memoización y reducción de re-renders

### Fuera del Alcance
- Migración a React Query / TanStack Query (cambio arquitectural mayor, queda para futuro)
- Virtualización de listas largas (depende de métricas reales con datos de producción)
- Migración de componentes cliente a server components (requiere análisis caso por caso)
- Cambios en la base de datos o schema Prisma
- Optimización de imágenes (no hay imágenes pesadas identificadas)

## Enfoque

Se aplica en dos fases paralelas:
- **Fase 1 — Quick Wins** (≤30 min total): fixes de una línea o triviales sin riesgo de regresión. Se aplican primero para mejora inmediata.
- **Fase 2 — Fixes Estructurales** (~4h): refactoring del socket provider, paginación en POS, y optimización de AnimatedList.

El orden garantiza que si la Fase 2 genera problemas, la Fase 1 ya entregó valor.

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/hooks/useBroadcastChannel.ts` | Modificado | Agregar `[]` a dependencias del useEffect |
| `src/components/ui/sidebar-dock.tsx` | Modificado | Eliminar console.log, fix dependencias |
| `src/lib/socket-provider.tsx` (o similar) | Modificado | Desacoplar reconexión del pathname |
| `src/components/notifications/` | Modificado | Eliminar useNotifications redundante |
| `src/app/api/productos/route.ts` | Modificado | Agregar paginación (limit/offset o cursor) |
| `src/app/pos/` (componente lista) | Modificado | Consumir paginación en el cliente |
| `src/lib/prisma.ts` | Modificado | Fix singleton pattern para dev |
| `src/app/dashboard/` | Modificado | dynamic() para @dnd-kit |
| `package.json` | Modificado | Eliminar dependencia `cobe` |
| `src/components/ui/animated-list.tsx` | Modificado | Memoización y reducción de re-renders |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Fix del socket rompe reconexión automática | Media | Test manual de cambio de sucursal + reconexión tras desconexión |
| Paginación en POS rompe búsqueda/filtros existentes | Media | Implementar con feature flag o endpoint separado |
| Eliminar useNotifications duplicado rompe UI del panel | Baja | Verificar visualmente antes de commit |
| `dynamic()` para dnd-kit causa flash de contenido | Baja | Agregar `loading` skeleton inline |

## Plan de Reversión (Rollback)

- Todos los cambios están en archivos independientes → revertir archivo por archivo con `git checkout HEAD -- <archivo>`
- La paginación en POS se puede revertir cambiando el endpoint a la versión sin parámetros
- No hay migraciones de DB → rollback es 100% a nivel de código

## Dependencias

- Ninguna dependencia externa nueva requerida
- `@dnd-kit` ya está instalado (solo se cambia a lazy load)

## Criterios de Éxito

- [ ] Click en items del Sidebar no produce delay perceptible (< 16ms por frame)
- [ ] El socket NO se reconecta al navegar entre rutas (verificable en DevTools Network)
- [ ] El panel de notificaciones hace exactamente 1 fetch al abrirse (no 2)
- [ ] POS carga en < 1 segundo con catálogos de 500+ productos
- [ ] `npm run build` compila sin warnings adicionales
- [ ] `console.log` eliminados — no aparecen en consola de producción
