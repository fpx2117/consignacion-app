# Tareas: 001-dynamic-ecommerce-engine

## Fase 1: Infraestructura de Datos

- [x] 1.1 Modificar `prisma/schema.prisma` para añadir el modelo `StoreSettings` (con campo `theme` Json) e incluir la relación con la base de Tienda/Tenant.
- [x] 1.2 Definir los tipos TypeScript e implementar validación Zod en `src/types/theme.ts` para el objeto `StoreThemeConfig`.
- [x] 1.3 Crear endpoint `src/app/api/settings/route.ts` para `GET` (leer configuración parseada) y `PATCH` (actualizar la base de datos).
- [x] 1.4 Modificar o crear seed / fallback logic para que cualquier intento de carga devuelva la configuración predeterminada si el registro en `StoreSettings` aún no existe.

## Fase 2: CSS Engine y Tailwind

- [x] 2.1 Actualizar `tailwind.config.ts` (o `tailwind.config.js`) enlazando utilidades como `colors.primary`, `colors.secondary`, etc., a sus equivalentes `var(--color-...)`.
- [x] 2.2 Crear el componente `src/components/ThemeInjector.tsx` que tome el estado del tema actual para renderizar bloques `<style>:root {...}</style>` y llamar a URLs de Google Fonts.

## Fase 3: Estado Global y Providers

- [x] 3.1 Crear el gestor de estado `src/context/ThemeContext.tsx` (o un store de Zustand) que mantenga el valor actual del Theme para el modo preview y provea funciones para actualizarlo.
- [x] 3.2 Implementar la lógica para iniciar el contexto con los datos proveídos desde el servidor/API.
- [x] 3.3 Implementar la función de acción `saveTheme()` en el store para persistir asíncronamente el estado de preview a base de datos vía el endpoint de API.

## Fase 4: UI del Panel de Settings

- [x] 4.1 Crear la vista principal `src/components/admin/ThemeEditor.tsx` estructurando las pestañas o secciones de "Colores", "Tipografía" y "Diseño".
- [x] 4.2 Agregar campos inputs interactivos (Color pickers) conectados al gestor de estado para inyección en tiempo real en la previsualización.
- [x] 4.3 Añadir comboboxes/selectores para la elección de tipografías tanto de Encabezados como Cuerpo, reaccionando para descargar y aplicar las fuentes al vuelo.
- [x] 4.4 Integrar en pantalla el layout de "Vista Previa" (Store Preview) aledaño al editor, demostrando las variables inyectadas.
- [x] 4.5 Escribir prueba de integración / E2E (por ejemplo, en `tests/admin/ThemeEditor.spec.ts`) validando que la manipulación del picker actualiza el CSS del root globalmente, y que la solicitud `PATCH` se ejecuta al guardar.
