# Plan de Implementación: Integración WhatsApp vía Kapso

**Fecha:** 2026-03-25
**Prioridad:** Mediano Plazo
**Área:** Comunicación con Clientes / Notificaciones / Automatización

---

## Resumen Ejecutivo

Kapso es una plataforma WhatsApp-as-a-Service diseñada para desarrolladores que permite integrar mensajería WhatsApp en productos en minutos. Con precios 95% más bajos que Twilio y un SDK TypeScript nativo (`@kapso/whatsapp-cloud-api`), representa una oportunidad concreta de agregar un canal de comunicación directo con clientes y consignadores, sin aumentar significativamente la deuda técnica.

Este plan cubre la integración progresiva de WhatsApp en el sistema de consignaciones: desde notificaciones automáticas hasta bots conversacionales para consultas de stock y estado de cuenta.

---

## Motivación y Casos de Uso

### Problemas actuales que resuelve

| Problema | Situación actual | Con Kapso |
|---|---|---|
| Aviso de vencimiento de consignaciones | Solo notificación interna en el sistema | WhatsApp directo al consignador |
| Confirmación de pagos | El cliente debe entrar al sistema | Mensaje automático al recibir el pago |
| Consulta de stock | El cliente llama o viene al local | Bot responde en segundos |
| Remitos y comprobantes | PDF descargado manualmente | Enviado por WhatsApp automáticamente |
| Reactivación de clientes inactivos | Requiere acción manual del operador | Campaña de broadcast automatizada |

### Casos de uso priorizados

1. **Notificaciones automáticas**: Alertas de vencimientos, pagos, stock crítico
2. **Envío de documentos**: Remitos, tickets de venta, comprobantes de gasto
3. **Bot de consulta de estado de cuenta**: El consignador puede consultar su saldo desde WhatsApp
4. **Campañas de broadcast**: Avisos de ofertas, actualizaciones de precios
5. **Confirmación de pedidos esperados**: Aviso cuando un pedido llega a la sucursal

---

## Arquitectura Propuesta

```
consignacion-app (Next.js)
│
├── src/lib/kapso/
│   ├── client.ts           # Instancia del SDK configurada
│   ├── templates.ts        # Definición de mensajes template
│   └── types.ts            # Tipos compartidos
│
├── src/app/api/
│   ├── webhooks/
│   │   └── kapso/
│   │       └── route.ts    # Recibe eventos de Kapso (mensajes entrantes)
│   └── whatsapp/
│       ├── notify/
│       │   └── route.ts    # Endpoint interno para enviar notificaciones
│       └── broadcast/
│           └── route.ts    # Endpoint para campañas masivas
│
└── src/app/api/cron/
    └── whatsapp-alerts/
        └── route.ts        # Cron job para alertas periódicas
```

---

## Fases de Implementación

### Fase 0 — Setup del Número Argentino y Configuración en el Sistema (2-3 días)

El número de WhatsApp del negocio será un **número argentino (+54)** conectado directamente a través de Meta Business Manager. Kapso actúa como capa de API sobre esa cuenta de Meta, por lo que el número que ven los clientes es el número real del negocio.

El administrador registra las credenciales de Kapso directamente desde **Settings → Mensajería WhatsApp** en el sistema, sin necesidad de tocar variables de entorno del servidor.

---

#### Paso 1 — Preparar el número argentino

- El número puede ser un **celular** (recomendado) o línea fija argentina
- **Requisito crítico**: el número NO puede estar activo en WhatsApp personal o WhatsApp Business app en ningún teléfono. Si lo está, hay que desvincular la cuenta primero (Settings → Cuenta → Eliminar cuenta en la app)
- Puede ser el número actual del negocio; Meta envía un SMS o llamada para verificarlo

#### Paso 2 — Crear Meta Business Account y WhatsApp Business Account

- [ ] Ir a [business.facebook.com](https://business.facebook.com) y crear o usar una cuenta de negocio existente
- [ ] Dentro de Meta Business Manager → **Cuentas** → **Cuentas de WhatsApp** → Agregar
- [ ] Ingresar el número argentino (+54 9 [área] [número]) y verificarlo por SMS o llamada
- [ ] Completar la verificación de negocio de Meta (puede tardar 1-3 días hábiles con documentación)

> **Formato del número**: Argentina requiere insertar el dígito `9` entre el código de país y el código de área.
> Ejemplo: `011 3619-8377` → `+5491136198377`

#### Paso 3 — Conectar en Kapso

- [ ] Crear cuenta en [kapso.ai](https://kapso.ai) (plan Free inicial)
- [ ] En la consola de Kapso → **Connect your Meta account** → autorizar la cuenta de Meta Business
- [ ] Seleccionar el número argentino ya registrado en Meta
- [ ] Obtener la **API Key** de Kapso y el **Phone Number ID** asignado

#### Paso 4 — Registrar el número en el sistema (Settings)

El administrador ingresa las credenciales desde la UI, **sin tocar el servidor**:

1. Ir a **Settings → Mensajería WhatsApp** (ruta existente: `/settings/whatsapp`)
2. En la nueva sección **"Integración Kapso"**:
   - Ingresar el número argentino del negocio (ej: `9 11 2233 4455`)
   - Ingresar la **API Key** de Kapso
   - Ingresar el **Phone Number ID** de Meta
   - Opcionalmente, el **Webhook Secret** para recibir mensajes entrantes
3. Guardar → el sistema valida el número y guarda las credenciales

---

#### Implementación técnica — Fase 0

**1. Schema de Prisma** — agregar campos al modelo `Configuracion` existente:

```prisma
// prisma/schema.prisma — modelo Configuracion (ya existe)
model Configuracion {
  // ... campos existentes ...

  // Integración Kapso (nuevos)
  kapsoApiKey          String?
  kapsoPhoneNumberId   String?
  kapsoWebhookSecret   String?
  kapsoPhoneNumber     String?   // El número +54 del negocio (display)
}
```

> El modelo `Configuracion` ya almacena otras credenciales sensibles de la misma forma (`andreaniPassword`, `mpAccessTokenTienda`, etc.), por lo que este patrón es consistente con el proyecto.

**2. Migración:**

```bash
npx prisma migrate dev --name add_kapso_fields
```

**3. API Route** — actualizar `src/app/api/settings/general/route.ts` (ya existe):

- **GET**: incluir `kapsoApiKey`, `kapsoPhoneNumberId`, `kapsoWebhookSecret`, `kapsoPhoneNumber` en la respuesta (enmascarar la API key mostrando solo los últimos 4 caracteres)
- **PUT**: aceptar y persistir los nuevos campos

**4. Componente UI** — crear `src/app/(system-guard)/(protected)/settings/whatsapp/components/KapsoConfigCard.tsx`:

Card nueva que se agrega **debajo** de la sección de tabs existente en `page.tsx`. Contiene:

| Campo | Input | Descripción |
|---|---|---|
| Número del negocio | Tel con prefijo `+54` fijo | El número que verán los clientes |
| API Key | Password input con toggle de visibilidad | Obtenida desde kapso.ai |
| Phone Number ID | Text input | ID del número en Meta |
| Webhook Secret | Password input con toggle | Para validar mensajes entrantes |

La card incluye:
- Badge de estado: **Configurado** (verde) / **Sin configurar** (gris)
- Botón "Probar conexión" que hace ping a Kapso y muestra si las credenciales son válidas
- Link de ayuda → documentación de Kapso

**5. Integración en `page.tsx`** — la `KapsoConfigCard` se renderiza siempre (no dentro de tabs), con su propio estado y llamada a la API, independiente de los templates de mensajes.

---

#### Normalización de números argentinos en el código

Al leer teléfonos desde la base de datos (campo `telefono` de `Cliente`), normalizarlos antes de enviar a Kapso:

```typescript
// src/lib/kapso/utils.ts
export function normalizeArgentinePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('54')) {
    // 5411... → 54911...
    if (!digits.startsWith('549')) {
      return '549' + digits.slice(2);
    }
    return digits;
  }

  // 011... → 54911...
  if (digits.startsWith('0')) {
    return '549' + digits.slice(1);
  }

  // 1136198377 → 5491136198377
  return '549' + digits;
}
```

Este helper se usa en todos los puntos donde se llama a Kapso con un número de cliente o consignador.

---

### Fase 1 — Notificaciones Salientes (3-5 días)

Implementar envío de mensajes desde los eventos ya existentes del sistema.

#### 1.1 Cliente Kapso (`src/lib/kapso/client.ts`)

```typescript
import { WhatsAppCloudAPI } from '@kapso/whatsapp-cloud-api';

export const kapso = new WhatsAppCloudAPI({
  apiKey: process.env.KAPSO_API_KEY!,
  phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID!,
});
```

#### 1.2 Templates de mensajes (`src/lib/kapso/templates.ts`)

Definir los templates aprobados por Meta para cada tipo de notificación:

- `vencimiento_consignacion`: Aviso de consignación próxima a vencer
- `pago_recibido`: Confirmación de pago registrado
- `stock_critico`: Alerta de producto con stock bajo
- `nuevo_remito`: Remito de consignación generado

#### 1.3 Hooks de integración

Conectar con los cron jobs existentes en:

- `src/app/api/cron/check-vencimientos/route.ts` → disparar WhatsApp a consignadores con vencimientos próximos
- `src/app/api/pagos/route.ts` → enviar confirmación al registrar un pago
- `src/app/api/notificaciones/create/route.ts` → enviar por WhatsApp las mismas notificaciones internas críticas

#### 1.4 Endpoint de envío interno

```
POST /api/whatsapp/notify
Body: { phone: string, template: string, params: string[] }
```

Este endpoint es consumido internamente por otros handlers, no expuesto al cliente.

---

### Fase 2 — Envío de Documentos (2-3 días)

Aprovechar los PDF ya generados en el sistema para enviarlos por WhatsApp.

#### Documentos candidatos (ya existen como rutas PDF):

| Documento | Ruta actual | Acción |
|---|---|---|
| Ticket de venta | `/ver/ticket/[id]` | Enviar PDF + mensaje al cliente |
| Remito consignación | `/ver/remito/[id]` | Enviar al consignador al crear |
| Comprobante de gasto | `/ver/gasto/[id]` | Enviar al administrador |
| Historial/Liquidación | `/ver/historial/[id]/pdf` | Enviar al consignador al liquidar |

**Flujo:**
1. El evento de creación genera el PDF (ya existente)
2. Se llama a `kapso.sendDocument()` con la URL pública del PDF
3. Kapso entrega el documento por WhatsApp

**Dependencia:** Los links de documentos ya existen en el sistema (ver `*-link` routes). Kapso necesita la URL pública del archivo.

---

### Fase 3 — Webhook y Bot de Consulta (5-7 días)

Recibir mensajes entrantes de WhatsApp para responder consultas automáticas.

#### 3.1 Webhook (`src/app/api/webhooks/kapso/route.ts`)

```typescript
export async function POST(req: Request) {
  // Verificar firma HMAC con KAPSO_WEBHOOK_SECRET
  // Parsear evento: tipo de mensaje, número de teléfono, texto
  // Derivar al handler correspondiente
}
```

#### 3.2 Comandos del bot (MVP)

| Mensaje del usuario | Respuesta del bot |
|---|---|
| `SALDO` | Estado de cuenta del consignador |
| `STOCK [producto]` | Stock disponible de ese producto |
| `AYUDA` | Lista de comandos disponibles |
| `REMITO [id]` | Reenvío del remito indicado |

#### 3.3 Identificación del usuario

La identificación se hace cruzando el número de WhatsApp contra el campo `telefono` de `Cliente` o el campo correspondiente en el perfil del consignador en Prisma.

---

### Fase 4 — Broadcasts y Campañas (3-4 días)

Envío masivo segmentado a clientes o consignadores.

#### Endpoint:

```
POST /api/whatsapp/broadcast
Body: {
  audience: 'clientes' | 'consignadores' | 'all',
  sucursalId?: string,
  template: string,
  params: string[]
}
```

#### Casos de uso iniciales:

- Aviso de nueva lista de precios
- Promoción de fin de temporada
- Recordatorio de consignaciones sin movimiento en 30 días

**Importante:** Los broadcasts de Meta requieren que los destinatarios hayan optado por recibir mensajes (opt-in). Considerar agregar un checkbox de consentimiento en el formulario de alta de cliente/consignador.

---

## Consideraciones Técnicas

### Rate limits y costos

| Plan | Mensajes/mes | Costo |
|---|---|---|
| Free | 2.000 | $0 |
| Pro | 100.000 | $25/mes |
| Platform | 1.000.000 | $299/mes |

Para el volumen inicial del sistema (PyME con pocas sucursales), el plan **Free** cubre holgadamente las notificaciones automáticas. El plan **Pro** es el objetivo al crecer.

### Manejo de errores

- Envolver todas las llamadas a Kapso en `try/catch` con fallback silencioso (el sistema no debe fallar si WhatsApp falla)
- Loguear errores de entrega en la tabla de notificaciones existente
- Reintentos automáticos opcionales con delay exponencial

### Seguridad

- Validar firma HMAC en el webhook de Kapso para prevenir mensajes falsificados
- Nunca exponer la API Key en el cliente
- Limitar el endpoint `/api/whatsapp/notify` a requests internos (sin acceso público)

### Privacidad y GDPR/datos personales

- Registrar consentimiento de los usuarios antes de enviar mensajes de marketing
- Implementar comando `BAJA` en el bot para que los usuarios puedan darse de baja
- No almacenar el contenido de conversaciones de WhatsApp en la base de datos

---

## Criterios de Aceptación (por fase)

### Fase 1
- [ ] Un consignador recibe un WhatsApp cuando su consignación está a 3 días de vencer
- [ ] El sistema no falla si Kapso no está disponible
- [ ] Los mensajes de WhatsApp quedan logueados como notificaciones internas también

### Fase 2
- [ ] Al registrar una venta, el cliente puede recibir el ticket por WhatsApp si tiene número cargado
- [ ] Al generar un remito, el consignador recibe el PDF en WhatsApp automáticamente

### Fase 3
- [ ] Un consignador puede escribir `SALDO` en WhatsApp y recibir su estado de cuenta en menos de 5 segundos
- [ ] Números no registrados en el sistema reciben un mensaje de "No encontramos tu cuenta"

### Fase 4
- [ ] Un operador puede enviar un broadcast a todos los clientes de una sucursal desde el panel de settings
- [ ] Los usuarios que respondieron `BAJA` no reciben broadcasts

---

## Relación con el Roadmap Existente

Este feature se alinea con las iniciativas de mediano plazo del ROADMAP:

- **Expansión de Canales**: WhatsApp como canal nativo de comunicación
- **Integración con Marketplaces**: Base para futuras integraciones omnicanal
- **Asistente de Liquidación Inteligente**: El bot puede sugerir productos para retirar vía WhatsApp

Y complementa funcionalidades ya implementadas:

- Centro de Notificaciones en Tiempo Real → WhatsApp como canal adicional de las mismas alertas
- PDFs y remitos existentes → nuevos canales de distribución
- Cron jobs de vencimientos → nuevos disparadores para mensajes WhatsApp

---

## Recursos

- [Documentación Kapso](https://docs.kapso.ai/docs/introduction)
- [SDK NPM: @kapso/whatsapp-cloud-api](https://www.npmjs.com/package/@kapso/whatsapp-cloud-api)
- [Kapso Pricing](https://kapso.ai/pricing)
- [Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Hacker News - Kapso Launch](https://news.ycombinator.com/item?id=46368379)
