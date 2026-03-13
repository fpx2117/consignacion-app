# Diseno: Modo Offline POS

## Enfoque Tecnico

El cambio `modo-offline` implementa un enfoque offline-first acotado al flujo de mostrador (POS), con consistencia eventual al reconectar.

El alcance MVP cubre:

1. Lecturas locales de catalogo y clientes cacheados.
2. Alta de ventas y pagos offline como mutaciones pendientes.
3. Cola de salida (outbox) persistida en cliente.
4. Motor de sincronizacion con reintentos, backoff e idempotencia.
5. Estado de conectividad y estado de sync visible en UI.

La arquitectura separa claramente:

- Capa de UI (estado online/offline y feedback de sync).
- Capa de datos local (`IndexedDB`) para lecturas y pendientes.
- Capa de transporte (`/api/sync/*`) para push/pull de cambios.
- Capa de dominio server para aplicar mutaciones idempotentes.

## Decisiones de Arquitectura

### Decision: IndexedDB como storage local principal

**Eleccion**: usar `IndexedDB` para cache de lecturas y outbox transaccional.

**Alternativas consideradas**:
- `localStorage` (simple, no transaccional, baja capacidad).
- Cache HTTP del browser sin modelo de dominio.

**Justificacion**: se necesitan escrituras atomicas, volumen moderado y consultas por estado/fecha para la cola.

### Decision: Patron Outbox en cliente para mutaciones offline

**Eleccion**: toda mutacion offline se guarda como item de outbox y se sincroniza luego.

**Alternativas consideradas**:
- Reintento inmediato en memoria sin persistencia.
- Guardar solo payload final de venta sin historial de intentos.

**Justificacion**: el outbox persiste entre recargas/cierres y habilita trazabilidad, reintentos y deduplicacion.

### Decision: Idempotencia por `clientMutationId`

**Eleccion**: cada mutacion incluye `clientMutationId` estable y unico por dispositivo.

**Alternativas consideradas**:
- Deduplicar solo por timestamp.
- Deduplicar por hash parcial de payload.

**Justificacion**: `clientMutationId` reduce ambiguedad y permite replays seguros en server.

### Decision: Politica de conflictos por dominio

**Eleccion**:
- Catalogo/configuracion: LWW por `updatedAt`.
- Ventas/pagos/stock/caja: no LWW; requiere conciliacion explicita.

**Alternativas consideradas**:
- LWW global para todos los dominios.
- Bloqueo pesimista estricto cross-device.

**Justificacion**: operaciones contables y de stock no toleran sobrescritura ciega.

### Decision: Endpoints de sync dedicados

**Eleccion**: agregar contratos `push` y `pull` en `/api/sync/*` para separar sincronizacion de APIs de negocio.

**Alternativas consideradas**:
- Reutilizar endpoints actuales (`/api/ventas`, `/api/pagos`) sin capa de sync.
- Un solo endpoint monolitico de sync sin version.

**Justificacion**: contratos dedicados facilitan versionado, observabilidad y rollback por feature flag.

## Flujo de Datos

```text
Operador POS
  -> UI (src/app/(system-guard)/(protected)/ventas/nueva/page.tsx)
     -> si online: API normal (ventas/pagos) + refresco cache local
     -> si offline: valida datos minimos locales
          -> guarda mutacion en IndexedDB.outbox (PENDING)
          -> actualiza vista como "pendiente de sync"

Reconexion detectada
  -> Sync Engine (src/lib/offline/sync-engine.ts)
     -> toma lote de outbox PENDING
     -> POST /api/sync/push con mutaciones + clientMutationId
     -> server aplica idempotente y responde ACK/CONFLICT/REJECTED
     -> cliente marca item como ACKED o ERROR
     -> GET /api/sync/pull?since=checkpoint para refrescar cache local
```

## Cambios en Archivos

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `src/lib/offline/contracts.ts` | Crear | Tipos de outbox, estados de sync y contratos de payload push/pull. |
| `src/lib/offline/indexeddb.ts` | Crear | Inicializacion de DB local, stores de cache y outbox, helpers transaccionales. |
| `src/lib/offline/outbox.ts` | Crear | Alta, lectura por estado, retires y marcado de resultados de sync. |
| `src/lib/offline/sync-engine.ts` | Crear | Orquestador de sincronizacion, backoff, checkpoints y metricas basicas. |
| `src/lib/offline/connectivity.ts` | Crear | Deteccion de conectividad y eventos online/offline para UI. |
| `src/lib/apiService.ts` | Modificar | Wrapper para modo offline: lecturas desde cache y mutaciones a outbox cuando no hay red. |
| `src/store/useSucursalStore.ts` | Modificar | Estado global de conectividad, cola pendiente y ultimo sync exitoso por sucursal. |
| `src/components/top-bar.tsx` | Modificar | Indicador visual de estado online/offline y resumen de pendientes. |
| `src/app/(system-guard)/(protected)/layout.tsx` | Modificar | Boot de inicializacion offline y listener de reconexion para disparar sync. |
| `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` | Modificar | Permitir venta offline con estado pendiente y mensajes de reconciliacion. |
| `src/app/api/ventas/route.ts` | Modificar | Soporte de `clientMutationId`, deduplicacion e insercion idempotente de ventas sync. |
| `src/app/api/pagos/route.ts` | Modificar | Soporte de pagos provenientes de sync offline con validaciones de dominio. |
| `src/app/api/clientes/route.ts` | Modificar | Endpoint preparado para pull incremental de clientes con `updatedAt`. |
| `src/app/api/sync/push/route.ts` | Crear | Recibe lote de mutaciones offline y devuelve ACK/CONFLICT/REJECTED por item. |
| `src/app/api/sync/pull/route.ts` | Crear | Entrega deltas por entidad desde checkpoint para refrescar cache local. |
| `prisma/schema.prisma` | Modificar | Tablas de auditoria/idempotencia de sync y campos de rastreo de origen offline. |
| `prisma/migrations/*` | Crear | Migracion no destructiva para soporte de idempotencia y estados de sincronizacion. |
| `public/manifest.webmanifest` | Crear | Definicion PWA minima para app shell y metadata instalable. |
| `public/sw.js` | Crear | Service Worker para app shell/cache de recursos y fallback offline controlado. |
| `server.ts` | Modificar | Headers y rutas requeridas para SW/PWA en despliegue con servidor custom. |

## Interfaces / Contratos Sugeridos

```ts
type OfflineMutationType =
  | "VENTA_CREATE"
  | "PAGO_CREATE"
  | "CLIENTE_CREATE";

type OfflineMutationStatus =
  | "PENDING"
  | "SYNCING"
  | "ACKED"
  | "CONFLICT"
  | "REJECTED";

interface OfflineOutboxItem<TPayload = unknown> {
  id: string; // uuid local
  deviceId: string;
  sucursalId: number;
  mutationType: OfflineMutationType;
  clientMutationId: string; // idempotencia global
  payload: TPayload;
  status: OfflineMutationStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SyncPushRequest {
  deviceId: string;
  userId: number;
  sucursalId: number;
  sentAt: string;
  mutations: OfflineOutboxItem[];
}

interface SyncPushItemResult {
  clientMutationId: string;
  status: "ACKED" | "CONFLICT" | "REJECTED";
  serverEntity?: { type: "VENTA" | "PAGO" | "CLIENTE"; id: number };
  reason?: string;
  conflictCode?: "STOCK" | "CAJA_CERRADA" | "DUPLICATE" | "VALIDATION";
}

interface SyncPushResponse {
  checkpoint: string;
  results: SyncPushItemResult[];
}

interface SyncPullResponse {
  checkpoint: string;
  data: {
    productos: Array<{ id: number; updatedAt: string }>;
    clientes: Array<{ id: number; updatedAt: string }>;
    ventas: Array<{ id: number; updatedAt: string; origen: "ONLINE" | "OFFLINE_SYNC" }>;
    pagos: Array<{ id: number; updatedAt: string; origen: "ONLINE" | "OFFLINE_SYNC" }>;
  };
}
```

Ejemplo `POST /api/sync/push` request:

```json
{
  "deviceId": "device-a1",
  "userId": 17,
  "sucursalId": 2,
  "sentAt": "2026-03-13T18:45:00.000Z",
  "mutations": [
    {
      "id": "9e5f1f4c-8b84-4b8a-a43f-a53bdf8f45f2",
      "deviceId": "device-a1",
      "sucursalId": 2,
      "mutationType": "VENTA_CREATE",
      "clientMutationId": "m-venta-000123",
      "payload": {
        "clienteId": 10,
        "metodoPago": "EFECTIVO",
        "items": [
          { "productoId": 88, "units": 1, "precioUnitario": 12500 }
        ]
      },
      "status": "PENDING",
      "retryCount": 0,
      "createdAt": "2026-03-13T18:40:00.000Z",
      "updatedAt": "2026-03-13T18:40:00.000Z"
    }
  ]
}
```

Ejemplo `POST /api/sync/push` response:

```json
{
  "checkpoint": "2026-03-13T18:45:03.555Z",
  "results": [
    {
      "clientMutationId": "m-venta-000123",
      "status": "ACKED",
      "serverEntity": { "type": "VENTA", "id": 4521 }
    }
  ]
}
```

## Estrategia de Pruebas

| Capa | Que Probar | Enfoque |
|------|------------|---------|
| Unitaria | Transiciones de estado de outbox y politicas de retry | Tests puros sobre `src/lib/offline/outbox.ts` y `src/lib/offline/sync-engine.ts` |
| Unitaria | Serializacion/validacion de contratos `push` y `pull` | Tests de tipos/validadores en `src/lib/offline/contracts.ts` |
| Integracion API | `POST /api/sync/push` con mutacion nueva y repetida | Verificar idempotencia por `clientMutationId` y respuestas consistentes |
| Integracion API | Conflicto de stock al sincronizar venta | Verificar `CONFLICT` con `conflictCode=STOCK` sin duplicar efectos |
| Integracion UI | Venta en offline queda pendiente y se confirma al reconectar | Simular desconexion/reconexion en `ventas/nueva` |
| E2E | Flujo completo POS offline -> sync -> estado final | Escenario de usuario con perdida de red y recuperacion |

## Migracion / Despliegue y Rollback Seguro

Despliegue recomendado con flag `POS_OFFLINE_MVP`:

1. Aplicar migraciones de schema para idempotencia/sync sin activar comportamiento offline.
2. Deploy de codigo con `POS_OFFLINE_MVP=false` (modo observacion, sin impacto funcional).
3. Activar flag en entorno de prueba y validar: alta offline, sync, conflictos y metricas.
4. Activar progresivo en produccion por sucursal piloto.
5. Escalar al resto de sucursales al confirmar estabilidad operativa.

Rollback seguro:

- Paso operativo inmediato: `POS_OFFLINE_MVP=false` para volver a online-only.
- Mantener tablas/campos nuevos sin uso activo; evitar rollback destructivo en caliente.
- Revertir codigo aplicativo al deploy previo si el incidente no se resuelve con flag.
- Si se requiere revertir schema, ejecutar script SQL manual versionado y ventana de mantenimiento.
- Verificar post-rollback: ventas online, pagos online, autenticacion y apertura/cierre de caja.

## Preguntas Abiertas

- [ ] Se permite crear clientes nuevos en offline o solo seleccionar clientes ya cacheados?
- [ ] Cierre de caja: se bloquea si quedan mutaciones `PENDING` o se admite cierre provisional?
- [ ] Que ventana de retencion tendra el outbox local antes de purga (ej. 7, 15, 30 dias)?
- [ ] Para conflicto de stock, el sistema debe sugerir ajuste automatico de unidades o requiere resolucion manual?
- [ ] Se habilita sync en segundo plano al abrir app o solo por accion explicita del operador?
