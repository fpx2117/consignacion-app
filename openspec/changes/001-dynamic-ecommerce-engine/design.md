# Diseño: Dynamic E-commerce Engine

## Enfoque Técnico

La arquitectura busca proporcionar un motor de personalización de temas para un e-commerce, en donde el usuario (administrador de la tienda) puede modificar aspectos visuales como colores, fuentes y layout desde un Panel de Configuración y visualizar los cambios en tiempo real. 

La solución técnica se basa en:
1.  **Persistencia Estructurada Flexibles:** Un esquema de Prisma (`StoreSettings`) que utiliza campos estructurados y JSON para almacenar la configuración de temas.
2.  **Inyección Dinámica de CSS:** Consumo de estos ajustes a través del backend e inyección como variables nativas CSS (ej. `var(--color-primary)`) en la etiqueta raíz (ej. `:root` o `<body>`), permitiendo a Tailwind CSS reaccionar a estos valores sin necesidad de re-compilar el código.
3.  **Tipografía Reactiva:** Carga de fuentes de Google Fonts (o integración de `next/font` de manera dinámica) basada en los valores leídos de la configuración.
4.  **Estado Global para Previsualización (Preview):** Implementación de un proveedor de estado (Context/Zustand) que unifica el estado del panel de configuración con la tienda visible, permitiendo previsualizar los cambios sin afectar al estado de producción hasta dar click en "Guardar".

## Decisiones de Arquitectura

### Decisión: Almacenamiento de Configuraciones

**Elección**: Modelo `StoreSettings` en Prisma con un campo de tipo JSON para los valores del tema.
**Alternativas consideradas**: Crear múltiples tablas para Colores, Fuentes, y Layouts. Almacenar cada valor en columnas separadas (ej. `primaryColor`, `secondaryColor`).
**Justificación**: Agrupar todo el tema en un campo `JSON` permite añadir o quitar propiedades en el futuro sin realizar migraciones continuas de base de datos. Reduce la cantidad de cruces (JOINs) y centraliza la configuración de la tienda.

### Decisión: Variables CSS Dinámicas con Tailwind

**Elección**: Inyectar estilos mediante un componente de React global `<style>` o un atributo `style` en el elemento base que establece variables CSS customizadas que Tailwind usará en su configuración (`tailwind.config.ts`).
**Alternativas consideradas**: Generar CSS o usar un compilador Just-In-Time en el navegador en tiempo real, lo cual es ineficiente; o bien, usar utilidades de estilos en línea completos en los componentes.
**Justificación**: Usar variables CSS proporciona máximo rendimiento. La configuración de Tailwind se define de esta forma: `colors: { primary: 'var(--color-primary)' }`. Cuando la variable CSS se actualiza a nivel de `:root`, todos los componentes de Tailwind que usan `text-primary` o `bg-primary` se actualizan automáticamente en tiempo real.

### Decisión: Carga de Tipografía Dinámica

**Elección**: Carga condicional a través del componente `<link href="https://fonts.googleapis.com/..." />` en el `<head>` sincronizado con el estado de la configuración para la vista del cliente.
**Alternativas consideradas**: Empaquetar todas las fuentes posibles, o usar de forma estricta estática la API de `next/font`.
**Justificación**: `next/font` optimiza enormemente el rendimiento, pero es altamente estático en tiempo de compilación. Para soportar una tienda donde la tipografía puede cambiar de un conjunto ilimitado (Google Fonts) en tiempo de ejecución, se debe hacer de forma asíncrona mediante URLs de recursos, limitando las selecciones al catálogo oficial habilitado en el editor.

### Decisión: Arquitectura de Componentes de Preview

**Elección**: Estado de tienda separado en memoria usando Zustand o React Context para el editor. El diseño de la página se alimenta de este "StoreThemeContext" en vez de las props estáticas del servidor.
**Alternativas consideradas**: Guardar directamente en la base de datos en cada pulsación (on-change) o re-renderizar un iframe entero (ineficiente y lento).
**Justificación**: Una preview fluida es un requisito esencial de UX. Modificar el estado local en React y reflejar esas variables CSS globalmente resulta en un preview instantáneo. Un botón de "Guardar" efectúa la mutación GraphQL/REST para persistirlo en la base de datos `StoreSettings`.

## Flujo de Datos

```text
    [Panel de Settings] (Input color/fuente)
            │
            ▼
    [StoreThemeContext / Zustand] (Estado local)
            │
            ├────────────────────────────────────────┐
            ▼                                        ▼
    [Inyector de Variables CSS]              [Mutación de API (Guardar)]
    (<style>:root { --color-primary... })            │
            │                                        ▼
            ▼                                  [Prisma ORM]
    [Previsualización Tienda] ◄──────────────► [StoreSettings DB]
    (Tailwind: bg-primary)
```

## Cambios en Archivos

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modificar | Añadir modelo `StoreSettings` y relación con la Tienda/Tenant. |
| `tailwind.config.js/ts` | Modificar | Configurar colores y tipografías para mapear hacia variables CSS personalizadas (ej. `var(--color-primary)`). |
| `src/context/ThemeContext.tsx` | Crear | Contexto de React o Store de Zustand para manejar el estado del tema. |
| `src/components/ThemeInjector.tsx` | Crear | Componente cliente que lee el contexto y actualiza las variables CSS de forma global, y monta fuentes en `<head>`. |
| `src/components/admin/ThemeEditor.tsx` | Crear | Panel de configuración con campos de control (color picker, select de fuentes). |
| `src/app/api/settings/route.ts` | Crear | Endpoints de API para leer (`GET`) y actualizar (`PATCH`) los valores guardados en base de datos. |

## Interfaces / Contratos

### Esquema de Prisma

```prisma
model StoreSettings {
  id        String   @id @default(cuid())
  storeId   String   @unique
  theme     Json     // { "colors": { "primary": "#...", "secondary": "#..." }, "typography": { "body": "Inter", "heading": "Roboto" }, "layout": "grid" }
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Contrato de Tipos TS

```typescript
export interface StoreThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  layout: {
    navbarStyle: 'standard' | 'minimal' | 'centered';
    productCardStyle: 'bordered' | 'shadow' | 'flat';
  };
}
```

## Estrategia de Pruebas

| Capa | Qué Probar | Enfoque |
|------|------------|---------|
| Unitaria | Función que genera los strings de variables CSS. | Validar que una configuración dada genere correctamente las sentencias como `--color-primary: #xxxxxx;`. |
| Integración | Endpoints de API Settings. | Simular (Mock) Prisma. Validar que los permisos de administrador funcionen, que `GET` devuelva `theme` parseado y `PATCH` actualice con esquema JSON válido. |
| E2E | Previsualización en el Panel Admin. | Usar Playwright o Cypress. Modificar un color, validar que se inyecta en el CSS del Preview sin recargar, hacer clic en "Guardar" y recargar la página para verificar la persistencia. |

## Migración / Despliegue

- Se debe ejecutar `npx prisma db push` o `prisma migrate dev` para crear el nuevo modelo `StoreSettings`.
- Para tiendas existentes, se requerirá un script de seed o migración de datos (`seed.ts`) que inserte un registro `StoreSettings` por defecto para todas las tiendas para evitar caídas (crashes) cuando intenten cargar su tema inicial (o se debe manejar en el código una carga gracefully con *fallback* al tema por defecto).

## Preguntas Abiertas

- [ ] ¿Es necesario validar con Zod/Joi el campo `theme` (JSON) antes de guardarlo en Prisma para garantizar integridad si el JSON cambia a futuro?
- [ ] ¿Soportaremos fuentes subidas (custom upload font files) en el futuro? De ser así, se requeriría configurar un Storage provider (S3/Cloudinary).
