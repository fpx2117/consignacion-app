# Plan de identidad visual KNOWLEDGE,cloud

## Estado

Plan revisado después de la auditoría de archivos.

Auditoría asociada: `docs/plans/knowledge-cloud-auditoria-archivos.md`.

## Objetivo

Unificar todo el frontend bajo `KNOWLEDGE,cloud`, con Satoshi como única tipografía, una fuente canónica de colores, temas light/dark completos y cero hardcoding visual fuera de excepciones controladas.

## Decisiones confirmadas

- Marca global: `KNOWLEDGE,cloud`.
- Tipografía única: Satoshi.
- Pesos autorizados: 300, 400, 500 y 700.
- Colores estáticos definidos en una única fuente técnica.
- Branding tenant conservado como excepción configurable por sucursal.
- Storefront aislado del theme global.
- Reportes y emails incluidos.
- Máximo de 300 líneas por archivo productivo manual.
- Todo archivo relevante mayor a 300 líneas se divide antes de editarlo.

## Fuente canónica

Se creará `src/theme/know-design-system.ts` con un máximo de 300 líneas.

Contendrá:

- Primitivos cromáticos.
- Roles semánticos light/dark.
- Estados, charts, overlays y focus.
- Colores externos autorizados.
- Roles print/email.
- Escala tipográfica Satoshi.
- Registro de logos.
- Generador de variables CSS.

`globals.css` conservará aliases y base estructural, sin valores cromáticos literales.

## Paleta

| Token          | Valor     | Uso                          |
| -------------- | --------- | ---------------------------- |
| Cobalto        | `#1737C8` | Marca y acciones principales |
| Profundo       | `#0D1B7E` | Jerarquía y profundidad      |
| Eléctrico      | `#3155FF` | Interacción y foco           |
| Pálido         | `#B9C7FF` | Selección y soporte          |
| Blanco         | `#FFFFFF` | Superficie principal         |
| Blanco cálido  | `#F6F5F1` | Fondo editorial              |
| Gris fondo     | `#ECECEA` | Superficie secundaria        |
| Gris claro     | `#D9D9D9` | Bordes y divisores           |
| Gris medio     | `#777777` | Texto secundario             |
| Carbón         | `#202020` | Texto y estructura           |
| Negro profundo | `#080808` | Fondo dark                   |

### Light

- Background: blanco cálido.
- Surface: blanco puro.
- Foreground: carbón.
- Muted: gris de fondo y gris medio.
- Border: gris claro.
- Primary: cobalto.
- Hover: profundo.
- Focus: eléctrico.
- Selection: pálido.

### Dark

- Background: negro profundo.
- Surface: carbón.
- Foreground: blanco cálido.
- Muted: gris claro.
- Border: gris medio tokenizado.
- Primary: eléctrico.
- Hover: cobalto.
- Focus: pálido.
- Selection: profundo.

Los estados deben combinar color, icono, texto y forma. No pueden depender sólo del color.

## Tipografía

Familia global: `Satoshi, system-ui, sans-serif`.

| Rol       |    Tamaño | Line-height |    Peso |
| --------- | --------: | ----------: | ------: |
| Display   | 72–112 px |      88–96% |     300 |
| Heading 1 |  48–64 px |    100–110% | 300/400 |
| Heading 2 |  28–36 px |    110–120% |     500 |
| Subtitle  |  20–24 px |    120–140% |     500 |
| Body      |  16–18 px |    150–170% |     400 |
| Caption   |  12–14 px |    140–160% |     400 |

Reglas:

- Máximo tres pesos visibles por bloque.
- No usar Light en tamaños pequeños.
- Números tabulares en KPIs, precios y tablas.
- No usar mayúsculas en párrafos completos.
- Cuerpo de lectura de 60–80 caracteres por línea.
- Escala responsive mediante `clamp()`.

Satoshi se cargará con `next/font/local`. Se eliminarán Geist, Inter, Poppins y selectores configurables de fuente.

## Logos

| Contexto    | Asset                          |
| ----------- | ------------------------------ |
| Light       | `public/brand/logo_negro.png`  |
| Dark        | `public/brand/logo.png`        |
| Favicon     | `public/brand/logo.png`        |
| Print/email | `public/brand/logo_negro.png`  |
| Sidebar     | Símbolo compacto               |
| Auth        | Símbolo y wordmark tipográfico |

`src/components/layout/brand-logo.tsx` será el único componente global de marca.

Se eliminarán las identidades visibles `import.vps`, `POS`, `AllData` y metadata `Dashboard`.

## Política de cero hardcoding

Prohibido fuera de la fuente canónica:

- Hex, RGB, HSL y OKLCH.
- Colores CSS con nombre.
- Clases Tailwind de paleta.
- Colores inline fijos.
- Fallbacks hex en variables.
- Sombras de paleta.
- Colores SVG cuando pueda usarse `currentColor`.

Permitido:

- `currentColor`, `transparent`, `inherit` y `none`.
- `color-mix()` compuesto sólo desde tokens.
- Colores tenant validados y acotados al storefront.
- Assets de marca aprobados.
- Salida generada desde la fuente canónica.

## Política de tamaño y calidad

- Hard limit de 300 líneas por archivo manual.
- Warning desde 250 líneas.
- Componente o función máximo de 120 líneas.
- Página o route shell objetivo de 150 líneas.
- Hook/controller objetivo de 200 líneas.
- No crear microarchivos sin responsabilidad propia.
- No crear helpers especulativos.
- No ampliar archivos grandes existentes.
- Dividir antes de modificar cualquier archivo relevante mayor a 300 líneas.
- Exenciones sólo para schema, migraciones, datos estáticos o salida generada.

## Fases

### Fase 0: guardrails

- [x] Crear scanner visual y de tamaño.
- [x] Guardar baseline actual.
- [x] Añadir ratchet de no crecimiento.
- [ ] Crear screenshots base al comenzar la primera fase visual.

Comandos operativos:

- `npm run visual:check`: salida humana y exit code de CI.
- `npm run visual:check:json`: salida estructurada para automatización.
- `npm run visual:test`: contrato unitario del guardrail.
- `npm run visual:baseline`: sólo acepta reducciones o archivos nuevos limpios; requiere revisar el diff.
- `npm run lint`: ejecuta primero el guardrail y luego ESLint.
- `npm run build`: ejecuta guardrail y pruebas antes de compilar.

El baseline no autoriza deuda nueva ni sustituciones de igual cantidad. Después de reducir deuda se ejecuta `visual:baseline` y se versiona su diff; desde ese momento la reducción no puede volver a crecer.

### Fase 1: refactor del núcleo

- Dividir `globals.css` por responsabilidad.
- Crear la fuente canónica y tests.
- Retirar duplicación con `color-tokens.ts`.
- Estabilizar aliases Tailwind v4.

### Fase 2: Satoshi global

- Configurar pesos 300/400/500/700.
- Retirar Geist, Inter y Poppins.
- Eliminar carga de fuentes tenant.
- Migrar reportes y emails.

### Fase 3: marca global

- Reemplazar `BrandLogo`.
- Migrar metadata, favicon, auth y navegación.
- Validar reducción de los PNG.

### Fase 4: componentes compartidos

- Unificar overlays, focus, estados y sombras.
- Dividir componentes compartidos mayores a 300 líneas.
- Migrar sólo los componentes con deuda directa.

### Fase 5: módulos protegidos

- Dividir cada page/controller grande antes de editar.
- Migrar dashboard, productos, ventas, consignaciones, gastos y settings.
- Verificar light/dark en cada módulo.

### Fase 6: storefront

- Dividir `catalog-client`, cart y editor de tienda.
- Reemplazar `:root` por wrapper local.
- Mantener colores tenant como override validado.
- Hacer que preview y storefront compartan resolución visual.

### Fase 7: reportes y emails

- Dividir rutas/templates grandes.
- Migrar print tokens y Satoshi.
- Corregir branding por `sucursalId`.
- Agregar fallback global KNOWLEDGE,cloud.

### Fase 8: limpieza

- Eliminar ThemeEditor, ThemeInjector y themeStore legacy.
- Retirar Poppins y assets starter.
- Simplificar Tailwind config.
- Eliminar excepciones de tamaño corregidas.

### Fase 9: enforcement total

- Activar cero tolerancia en CI.
- Bloquear archivos nuevos mayores a 300 líneas.
- Bloquear hardcoding cromático y tipográfico.

## Verificación

- Scanner de colores y fuentes.
- Scanner de line count.
- ESLint y TypeScript.
- Next build.
- Tests del generador de tokens.
- Contraste WCAG AA.
- Screenshots desktop/tablet/mobile en light/dark.
- Snapshots de PDFs.
- Verificación de logo por surface.
- Verificación de Satoshi y pesos autorizados.

## Criterios de aceptación

- KNOWLEDGE,cloud es la única marca global.
- Satoshi es la única tipografía visual.
- No quedan import.vps, POS ni AllData visibles.
- No hay colores literales fuera de la allowlist.
- No hay utilidades Tailwind de paleta directa.
- Todos los temas y estados funcionan en light/dark.
- Storefront no contamina variables globales.
- Branding tenant no se cruza entre sucursales.
- PDFs y emails consumen el mismo sistema.
- Ningún archivo nuevo supera 300 líneas.
- Todo archivo grande relevante fue dividido antes de migrarse.
- CI bloquea regresiones visuales y estructurales.

## Orden obligatorio

1. Guardrails y baseline.
2. Refactor previo del área a tocar.
3. Fuente canónica.
4. Satoshi.
5. Marca.
6. Componentes compartidos.
7. Módulos protegidos.
8. Storefront.
9. Reportes y email.
10. Limpieza y enforcement total.
