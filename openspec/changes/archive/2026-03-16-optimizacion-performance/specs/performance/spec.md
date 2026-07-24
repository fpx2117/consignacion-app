# Especificación: Optimización de Performance — Navegación y Componentes

- **Change ID:** optimizacion-performance
- **Versión:** 1.0.0
- **Fecha:** 2026-03-16
- **Estado:** DRAFT
- **Referencia:** [proposal.md](../../proposal.md)

---

## Convenciones de lenguaje (RFC 2119)

| Keyword                    | Significado                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| **DEBE** / **DEBEN**       | Requisito obligatorio. El incumplimiento invalida la implementación. |
| **DEBERÁ**                 | Requisito obligatorio con énfasis en temporalidad futura.            |
| **NO DEBE** / **NO DEBEN** | Prohibición absoluta.                                                |
| **DEBERÍA**                | Recomendación fuerte. Se puede omitir con justificación documentada. |
| **PODRÁ**                  | Comportamiento opcional permitido.                                   |

---

## Tabla de Requisitos

| ID      | Dominio               | Tipo         | Prioridad |
| ------- | --------------------- | ------------ | --------- |
| REQ-01  | Broadcast Channel     | Funcional    | Alta      |
| REQ-02  | Broadcast Channel     | Funcional    | Alta      |
| REQ-03  | WebSocket Provider    | Funcional    | Alta      |
| REQ-04  | WebSocket Provider    | Funcional    | Alta      |
| REQ-05  | WebSocket Provider    | Funcional    | Alta      |
| REQ-06  | Notificaciones        | Funcional    | Media     |
| REQ-07  | Notificaciones        | Funcional    | Media     |
| REQ-08  | Catálogo POS          | Funcional    | Alta      |
| REQ-09  | Catálogo POS          | Funcional    | Alta      |
| REQ-10  | Catálogo POS          | Funcional    | Alta      |
| REQ-11  | Bundle y Dependencias | No Funcional | Media     |
| REQ-12  | Bundle y Dependencias | No Funcional | Media     |
| REQ-13  | Bundle y Dependencias | No Funcional | Media     |
| PERF-01 | Performance General   | No Funcional | Alta      |
| PERF-02 | Performance General   | No Funcional | Media     |
| PERF-03 | Performance General   | No Funcional | Media     |

---

## 1. Dominio: Broadcast Channel

**Archivo afectado:** `src/hooks/useBroadcastChannel.ts`

**Contexto:** El hook `useBroadcastChannel` actualmente se re-suscribe al canal en cada render del componente Sidebar porque el `useEffect` carece de array de dependencias vacío `[]`. Esto genera múltiples listeners activos simultáneos y es una fuente directa del lag percibido en navegación.

### REQ-01: Suscripción única al canal

El hook `useBroadcastChannel` DEBE suscribirse al `BroadcastChannel` exactamente **una sola vez** durante el ciclo de vida del componente que lo invoca.

- La suscripción DEBE ocurrir en el efecto de montaje (`componentDidMount` equivalente).
- El array de dependencias del `useEffect` responsable de la suscripción DEBE ser `[]` (vacío).
- DEBE registrarse exactamente un listener `onmessage` por instancia del hook.

### REQ-02: Sin re-suscripción en re-renders

El hook `useBroadcastChannel` NO DEBE crear una nueva suscripción al canal cuando el componente padre re-renderice sin haber sido desmontado.

- Si el componente re-renderiza N veces, DEBE existir exactamente 1 listener activo (no N).
- NO DEBE cerrar y reabrir el canal en re-renders subsecuentes.
- El canal DEBE cerrarse (`.close()`) únicamente en la función de limpieza del `useEffect` de montaje.

#### Escenario 1.A — Suscripción inicial al montar

```
Dado  que el hook useBroadcastChannel es invocado por primera vez en un componente
Cuando el componente se monta en el DOM
Entonces se DEBE crear exactamente 1 instancia de BroadcastChannel
  Y    se DEBE registrar exactamente 1 listener onmessage en esa instancia
  Y    el canal DEBE permanecer abierto mientras el componente esté montado
```

#### Escenario 1.B — Re-render sin re-suscripción

```
Dado  que el hook useBroadcastChannel ya está suscrito (componente montado)
Cuando el componente padre provoca un re-render (ej. cambio de pathname, state update)
Entonces NO DEBE crearse una nueva instancia de BroadcastChannel
  Y    el número total de listeners activos DEBE seguir siendo 1
  Y    el canal original DEBE permanecer abierto sin interrupción
```

#### Escenario 1.C — Limpieza al desmontar

```
Dado  que el hook useBroadcastChannel está activo con 1 listener registrado
Cuando el componente que lo contiene se desmonta del DOM
Entonces la función de cleanup del useEffect DEBE ejecutarse
  Y    el canal DEBE cerrarse mediante .close()
  Y    NO DEBE quedar ningún listener activo para ese canal
```

---

## 2. Dominio: WebSocket Provider

**Archivo afectado:** `src/lib/socket-provider.tsx` (o equivalente)

**Contexto:** El provider WebSocket actualmente incluye `pathname` en las dependencias del `useEffect` de conexión. Cada cambio de ruta destruye la conexión y crea una nueva, generando latencia perceptible en cada navegación. La reconexión solo es legítima cuando cambia la identidad del usuario o la sucursal activa.

### REQ-03: Persistencia de conexión durante la navegación

El WebSocket DEBE mantener la conexión activa durante la navegación entre rutas de la aplicación, sin ejecutar destroy/reconnect como efecto secundario del cambio de `pathname`.

- La instancia del socket DEBE ser reutilizada entre renders provocados por cambios de `pathname`.
- La conexión DEBE sobrevivir a navegaciones client-side (Next.js router).

### REQ-04: Reconexión condicionada a cambios de identidad

El WebSocket DEBE reconectarse (teardown + new connection) únicamente cuando cambien alguno de los siguientes valores:

- El identificador del usuario autenticado (ej. `user.id` o `session.userId`).
- El identificador de la sucursal activa (ej. `sucursalId`).

- `pathname` NO DEBE figurar como dependencia en el `useEffect` de conexión del socket.
- El array de dependencias del efecto de conexión DEBE contener solo valores de identidad/sesión.

### REQ-05: No reconexión al cambiar pathname

Al cambiar de ruta dentro de la aplicación, el WebSocket NO DEBE desconectarse ni reconectarse.

- En DevTools > Network > WS, NO DEBE aparecer un nuevo handshake WebSocket tras una navegación client-side.
- La latencia introducida por reconexión DEBE ser eliminada de los eventos de navegación.

#### Escenario 2.A — Navegación sin reconexión

```
Dado  que el WebSocket está conectado y el usuario está autenticado en la sucursal X
Cuando el usuario navega de /dashboard a /pos (client-side navigation)
Entonces el WebSocket NO DEBE cerrarse
  Y    NO DEBE iniciarse un nuevo handshake de conexión
  Y    la conexión existente DEBE seguir recibiendo mensajes sin interrupción
```

#### Escenario 2.B — Cambio de sucursal provoca reconexión

```
Dado  que el WebSocket está conectado con sucursalId = "SUC-001"
Cuando el usuario cambia la sucursal activa a sucursalId = "SUC-002"
Entonces el WebSocket existente DEBE cerrarse limpiamente
  Y    DEBE iniciarse una nueva conexión con los parámetros de "SUC-002"
  Y    la nueva conexión DEBE establecerse correctamente
```

#### Escenario 2.C — Cambio de ruta NO provoca reconexión

```
Dado  que el WebSocket está conectado y el usuario navega entre rutas
Cuando el pathname cambia de "/pos" a "/dashboard" (o cualquier otra ruta)
Entonces el useEffect de conexión NO DEBE re-ejecutarse
  Y    la instancia del socket DEBE ser la misma antes y después de la navegación
  Y    NO DEBE registrarse ningún evento "close" ni "open" en el socket durante la navegación
```

---

## 3. Dominio: Notificaciones

**Archivos afectados:** `src/components/notifications/` (todos los archivos del panel)

**Contexto:** El panel de notificaciones instancia `useNotifications()` dos veces (en el componente padre y en un subcomponente), duplicando los fetches al backend en cada apertura del panel. El resultado es latencia innecesaria y potencial inconsistencia de datos.

### REQ-06: Fetch único al abrir el panel

Al abrir el panel de notificaciones, DEBE realizarse exactamente **un** fetch HTTP hacia el endpoint de notificaciones.

- El fetch DEBE ocurrir una sola vez por evento de apertura del panel.
- NO DEBE realizarse más de una petición simultánea o secuencial inmediata al mismo endpoint en el mismo evento de apertura.
- El resultado del fetch DEBE ser compartido (prop drilling o context) con todos los subcomponentes del panel que requieran los datos.

### REQ-07: Instancia única de useNotifications por panel

NO DEBE existir más de **una** instancia activa del hook `useNotifications` por panel de notificaciones abierto en pantalla.

- Si el panel renderiza subcomponentes que necesitan datos de notificaciones, DEBEN recibirlos via props o context, no mediante llamadas independientes al hook.
- El hook DEBE ser invocado exclusivamente en el componente raíz del panel.

#### Escenario 3.A — Apertura del panel (1 fetch)

```
Dado  que el panel de notificaciones está cerrado
Cuando el usuario hace click en el ícono de notificaciones
Entonces el panel DEBE abrirse
  Y    DEBE realizarse exactamente 1 petición HTTP al endpoint de notificaciones
  Y    los datos DEBE estar disponibles para todos los subcomponentes del panel
```

#### Escenario 3.B — Reapertura del panel (1 fetch adicional)

```
Dado  que el usuario ya abrió y cerró el panel de notificaciones previamente
Cuando el usuario vuelve a hacer click en el ícono de notificaciones
Entonces DEBE realizarse exactamente 1 nueva petición HTTP (no 2, no 0)
  Y    los datos actualizados DEBEN mostrarse correctamente
```

#### Escenario 3.C — Panel abierto sin fetches duplicados en re-renders

```
Dado  que el panel de notificaciones está abierto y mostrando datos
Cuando el componente padre re-renderiza (ej. cambio de estado externo)
Entonces NO DEBE dispararse un nuevo fetch al endpoint de notificaciones
  Y    los datos mostrados DEBEN permanecer estables hasta la próxima apertura
```

---

## 4. Dominio: Catálogo POS

**Archivos afectados:**

- `src/app/api/productos/route.ts`
- `src/app/pos/` (componente de lista de productos)

**Contexto:** `getProductos()` carga todos los registros de la base de datos sin restricción, lo que bloquea el hilo principal en catálogos con 500+ productos. Es necesario implementar paginación server-side.

### REQ-08: API de productos con soporte de paginación

La API `GET /api/productos` DEBE soportar paginación mediante los parámetros de query:

- `limit` (entero positivo): número máximo de registros a retornar.
- `offset` (entero no negativo): número de registros a saltar desde el inicio. **O alternativamente:**
- `cursor` (string opaco): identificador del último registro de la página anterior (cursor-based pagination).

- Si no se proveen parámetros de paginación, la API DEBERÁ retornar los primeros `50` registros (valor por defecto).
- La respuesta DEBE incluir metadata de paginación: `total` (conteo total de registros) y el cursor o el offset actual.
- La API DEBE retornar `HTTP 400` si `limit` excede `200` o si los parámetros son inválidos.

### REQ-09: Límite de productos por página en POS

El componente de lista de productos en POS DEBE solicitar máximo **50 productos** por página al realizar peticiones al API.

- La petición inicial DEBE incluir `limit=50` (o el valor por defecto acordado).
- El componente DEBE renderizar solo los productos de la página activa, no todos los cargados.
- DEBE existir un mecanismo de navegación entre páginas (botones siguiente/anterior, o scroll infinito con carga lazy).

### REQ-10: Búsqueda y filtros compatibles con paginación

Las funcionalidades de búsqueda por texto y filtros (categoría, precio, disponibilidad) en el catálogo POS DEBEN funcionar correctamente cuando la paginación está activa.

- Al aplicar un filtro o iniciar una búsqueda, la paginación DEBE reiniciarse a la página 1 (offset=0 o cursor=null).
- Los parámetros de búsqueda y filtro DEBEN enviarse junto con los parámetros de paginación en la misma petición.
- El total de resultados mostrado DEBE reflejar el total filtrado, no el total de todos los productos.

#### Escenario 4.A — Carga inicial paginada

```
Dado  que el usuario abre el módulo POS con un catálogo de 500+ productos
Cuando el componente de lista se monta
Entonces DEBE realizarse 1 petición a GET /api/productos?limit=50&offset=0
  Y    DEBE mostrarse máximo 50 productos en pantalla
  Y    el tiempo de respuesta DEBE ser menor a 1 segundo
  Y    DEBE mostrarse un indicador de navegación entre páginas
```

#### Escenario 4.B — Navegación entre páginas

```
Dado  que el catálogo POS muestra la página 1 (productos 1-50)
Cuando el usuario navega a la página 2
Entonces DEBE realizarse 1 petición a GET /api/productos?limit=50&offset=50
  Y    DEBE mostrarse los productos 51-100 sin recargar los primeros 50
  Y    la página activa DEBE actualizarse visualmente
```

#### Escenario 4.C — Búsqueda con paginación activa

```
Dado  que el catálogo POS está mostrando la página 3
Cuando el usuario escribe un término en la caja de búsqueda
Entonces la paginación DEBE reiniciarse a la página 1 (offset=0)
  Y    DEBE realizarse 1 petición con ?limit=50&offset=0&q=<término>
  Y    DEBE mostrarse el total de resultados filtrados
  Y    la navegación entre páginas DEBE funcionar sobre los resultados filtrados
```

#### Escenario 4.D — API retorna error en parámetros inválidos

```
Dado  que un cliente llama a GET /api/productos?limit=500
Cuando el servidor procesa la petición
Entonces DEBE retornar HTTP 400 Bad Request
  Y    el cuerpo DEBE contener un mensaje descriptivo del error de validación
```

---

## 5. Dominio: Bundle y Dependencias

**Archivos afectados:**

- `src/app/dashboard/` (componentes con @dnd-kit)
- `package.json`
- `src/components/ui/sidebar-dock.tsx`
- `src/lib/socket-provider.tsx`

**Contexto:** Existen tres problemas independientes que inflan el bundle o contaminan la consola de producción: componentes drag-and-drop cargados de forma síncrona, dependencias declaradas en `package.json` no utilizadas en el código, y llamadas a `console.log` en componentes de navegación críticos.

### REQ-11: Lazy loading de componentes @dnd-kit

Los componentes que utilizan `@dnd-kit` (drag-and-drop) en el dashboard DEBEN cargarse de forma **lazy** mediante `dynamic()` de Next.js.

- DEBE usarse `next/dynamic` con `{ ssr: false }` para los componentes que importan de `@dnd-kit/core`, `@dnd-kit/sortable`, o `@dnd-kit/utilities`.
- DEBE proveerse un componente `loading` (skeleton o spinner) mientras el chunk se descarga.
- El bundle principal (first load JS) NO DEBE incluir el código de `@dnd-kit` directamente.

### REQ-12: Sin dependencias instaladas no utilizadas

NO DEBEN existir paquetes declarados en `dependencies` o `devDependencies` de `package.json` que no tengan ningún import en el código fuente del proyecto.

- La dependencia `cobe` DEBE ser eliminada de `package.json` si no existe ningún `import` de `cobe` en el código fuente.
- Cualquier otra dependencia sin uso verificable DEBE ser evaluada para remoción.
- Tras la eliminación, DEBE ejecutarse `npm install` para actualizar `package-lock.json`.

### REQ-13: Sin console.log en producción (componentes de navegación)

NO DEBEN existir llamadas a `console.log` en los siguientes archivos en el código que se ejecuta en producción:

- `src/components/ui/sidebar-dock.tsx`
- `src/lib/socket-provider.tsx` (o el archivo que contiene el WebSocket provider)

- Los `console.log` de debugging DEBEN eliminarse del código fuente (no solo condicionarse con `process.env.NODE_ENV`).
- `console.error` y `console.warn` legítimos para errores de runtime PODRÁN permanecer si documentan condiciones de error reales.

#### Escenario 5.A — @dnd-kit carga lazy en dashboard

```
Dado  que el usuario navega al dashboard por primera vez
Cuando Next.js ejecuta el bundle principal
Entonces el código de @dnd-kit NO DEBE estar incluido en el bundle inicial
  Y    DEBE cargarse de forma asíncrona cuando el componente drag-and-drop se necesite
  Y    DEBE mostrarse un estado de carga (skeleton/spinner) durante la descarga del chunk
```

#### Escenario 5.B — Eliminación de dependencia cobe

```
Dado  que cobe está declarado en package.json
Cuando se verifica que no existe ningún import de cobe en el código fuente
Entonces cobe DEBE ser removido de package.json
  Y    npm install DEBE ejecutarse para actualizar el lockfile
  Y    npm run build DEBE completar sin errores ni warnings relacionados con cobe
```

#### Escenario 5.C — Consola limpia en producción

```
Dado  que la aplicación está corriendo en modo producción (NODE_ENV=production)
Cuando el usuario navega entre rutas usando el Sidebar
Entonces NO DEBE aparecer ningún console.log en la consola del navegador
  Y    ningún mensaje de debug DEBE ser visible en producción
```

---

## 6. Criterios de Performance (No Funcionales)

### PERF-01: Latencia de navegación entre rutas

La navegación entre rutas client-side DEBE completarse sin delay perceptible.

- **Objetivo:** el hilo principal DEBE bloquearse menos de **16ms** durante un evento de click en el Sidebar.
- El "Long Task" generado por la navegación NO DEBE superar los 50ms (umbral de "perceptible" según RAIL).
- Se DEBERÁ medir con Chrome DevTools Performance tab en una sesión de incógnito, sin extensiones.

**Método de verificación:**

- Abrir DevTools > Performance > Record.
- Hacer click en un item del Sidebar.
- Verificar que no hay Long Tasks (bloques rojos) en el flame chart asociados al evento de click.

### PERF-02: Tiempo de respuesta del panel de notificaciones

El panel de notificaciones DEBE responder visualmente al click del usuario en menos de **100ms**.

- "Responder visualmente" se define como: el panel DEBE iniciar su animación de apertura dentro de los 100ms posteriores al evento `mousedown`.
- El fetch de notificaciones PODRÁ completarse de forma asíncrona (muestra skeleton mientras carga).
- El tiempo de respuesta DEBE medirse desde el evento `click` hasta el primer frame de la animación de apertura.

### PERF-03: Tiempo de carga inicial del catálogo POS

La lista de productos en POS DEBE mostrar los primeros resultados en menos de **1 segundo** desde que el componente se monta, con catálogos de hasta 500 productos.

- "Primeros resultados" se define como: al menos 10 productos renderizados en el DOM.
- Este tiempo incluye la petición de red al API + renderizado del DOM.
- El criterio DEBE cumplirse en condiciones de red "Fast 3G" simuladas en DevTools.
- Se DEBERÁ medir con Chrome DevTools > Network > throttle "Fast 3G".

---

## Resumen de Cobertura

| Dominio                  | Requisitos                | Escenarios            |
| ------------------------ | ------------------------- | --------------------- |
| 1. Broadcast Channel     | REQ-01, REQ-02            | 1.A, 1.B, 1.C         |
| 2. WebSocket Provider    | REQ-03, REQ-04, REQ-05    | 2.A, 2.B, 2.C         |
| 3. Notificaciones        | REQ-06, REQ-07            | 3.A, 3.B, 3.C         |
| 4. Catálogo POS          | REQ-08, REQ-09, REQ-10    | 4.A, 4.B, 4.C, 4.D    |
| 5. Bundle y Dependencias | REQ-11, REQ-12, REQ-13    | 5.A, 5.B, 5.C         |
| 6. Performance General   | PERF-01, PERF-02, PERF-03 | — (métricas medibles) |
| **TOTAL**                | **16 requisitos**         | **16 escenarios**     |

---

## Referencias

- [proposal.md](../../proposal.md) — Propuesta original con contexto de negocio y áreas afectadas
- RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
- RAIL Model: Response, Animation, Idle, Load — Google Web Fundamentals
