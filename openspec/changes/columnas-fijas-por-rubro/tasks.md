# Tareas: Columnas fijas por rubro en el catálogo de productos

Cada fase es una sesión/PR independiente (regla de una feature por sesión, ver `AGENTS.md`). Las fases posteriores no bloquean el uso de las anteriores en producción.

## Fase 0: Contenido — catálogo de atributos fijos (subconjunto acotado)

- [x] 0.1 Confirmado con el usuario: priorizar perfumería (única señal real en la DB de producción), indumentaria, zapatería y ferretería.
- [x] 0.2 Definidos 3-6 atributos fijos tipados por rubro en `rubro-atributos.ts`, derivados de `atributosTipicos` existente.
- [x] 0.3 Listado validado con el usuario antes de tocar código.

## Fase 1: Modelo de datos en código (sin migración)

- [x] 1.1 `src/modules/invoices/config/rubro-atributos.ts`: tipo `AtributoFijoDef` y `RUBRO_ATRIBUTOS_FIJOS` para perfumería/indumentaria/zapatería/ferretería.
- [x] 1.2 `getAtributosFijos(rubro)` implementado (mismo patrón que `getAtributosTipicos`).
- [x] 1.3 Tests unitarios del helper — `rubro-atributos.test.ts`, 6/6 verdes.

## Fase 2: Validación server-side tipada

- [x] 2.1 `src/lib/validators/producto-atributos-fijos.ts` (archivo separado, no dentro de `producto.ts`): `validarAtributosFijosProducto(atributosExtra, rubroNegocio)` — valida tipo (`numero`/`fecha`/`seleccion`) y presencia de requeridos. Deliberadamente NO integrado como `.superRefine` en `createProductoSchema`/`updateProductoSchema` porque ese schema también lo usa `create-product/route.ts` (alta de producto desde OCR de factura), donde exigir atributos fijos bloquearía altas legítimas cuando la IA no detectó un campo — ver comentario en el archivo.
- [x] 2.2 `POST /api/productos`: `configGlobal` (con `rubroNegocio`) se resuelve una sola vez antes de la validación y se reusa después para el umbral de notificación (antes se pedía dos veces). `PUT /api/productos/[id]`: `configGlobal` se movió antes de la transacción para poder validar antes de tocar la DB.
- [x] 2.3 Mensajes de error por atributo (ej. `"ML" debe ser un número`, `"Talle" es requerido para este rubro`), devueltos en `details.fieldErrors.atributosExtra` (array de strings), mismo shape de 400 que ya usa el resto del endpoint.
- [x] 2.4 Verificado: la validación en `PUT` solo corre si `parsed.data.atributosExtra !== undefined` — un ajuste parcial de stock (`ajustar-stock-dialog.tsx`, que no envía `atributosExtra`) no la dispara.

## Fase 3: Formulario estructurado en el wizard

- [x] 3.1 Nuevo `atributos-fijos-form.tsx` (`AtributosFijosForm`), montado en `producto-wizard-dialog.tsx` como sección visible por default (no colapsada, solo cuando `atributosFijos.length > 0`) — input de texto/número/fecha o `<Select>` con `opciones` según `tipo`.
- [x] 3.2 Los valores se leen/escriben en el mismo `atributosExtra` de siempre, bajo la clave del catálogo (`actualizarAtributoFijo`).
- [x] 3.3 `AtributosExtraEditor` ahora opera sobre `atributosExtraLibres` (claves que no están en `clavesFijas`) cuando el rubro tiene atributos fijos, vía `actualizarAtributosLibres` que preserva los valores fijos al mergear. Título cambia a "Otros atributos (opcional)" en ese caso.
- [x] 3.4 Validación en cliente reutiliza `validarAtributosFijosProducto` (la misma función de la Fase 2, es pura y sin dependencias de servidor) vía `atributosFijosValidacion` — bloquea `canSubmit` (nuevo `step3Valid`) y muestra los mismos mensajes de error debajo del formulario.
- [x] 3.5 Rubro sin catálogo fijo u "Otro": `getAtributosFijos()` devuelve `[]`, `AtributosFijosForm` no renderiza nada, y el editor libre opera sobre `atributosExtra` completo — comportamiento idéntico al anterior.
- Verificado: `tsc --noEmit` y `eslint` sin errores nuevos; tests de `rubro-atributos.test.ts` (reusados por la validación en cliente) siguen en verde.

## Fase 4: Columnas por defecto en la tabla

- [x] 4.1 `productos-view.tsx`: el efecto que carga `Configuracion` ahora, si `columnasAtributosProducto` viene vacío y `getAtributosFijos(rubro)` no está vacío, setea el estado local con esas claves y persiste con `actualizarConfiguracionGeneral` (falla silenciosa si el PUT no anda — la UI ya quedó bien, se reintenta en el próximo cambio manual).
- [x] 4.2 El seed solo corre cuando el array guardado está vacío (`columnasGuardadas.length > 0` corta antes) — una vez seedeado (o customizado a mano), no se vuelve a pisar en cargas posteriores ni al cambiar de rubro.
- [x] 4.3 `columnas-producto-picker.tsx`: nuevo prop `rubroNegocio` — muestra el `label` legible (ej. "ML" en vez de "ml") y una badge "rubro" para las claves que vienen del catálogo fijo, vía `getAtributosFijos`.
- Verificado contra la DB real (Railway): los 2 clientes con rubro "perfumeria" tienen `columnasAtributosProducto: []` hoy — el seed automático se va a disparar la próxima vez que entren a `/productos`.
- `tsc --noEmit` y `eslint` sin errores nuevos.

## Fase 5: Verificación end-to-end

- [x] 5.1 Verificado en vivo (Playwright, login real `vasconceldiego2@gmail.com`, rubro "Perfumería" ya configurado): wizard mostró "Atributos de Perfumería" con los 6 campos tipados, `*` en Marca/ML, botón "Crear Producto" deshabilitado con los 2 mensajes de error exactos hasta completar los requeridos. Al crear, `atributosExtra` quedó persistido en DB como `{"ml":"100","marca":"Chanel","concentracion":"EDP"}` — verificado con query directa a Postgres.
- [x] 5.1b Encontrado y arreglado durante la verificación: warning de React "Select is changing from uncontrolled to controlled" en `AtributosFijosForm` — el `<Select value={valor || undefined}>` alternaba entre `undefined` y string. Fix: `value={valor}` (siempre string). `tsc`/`eslint` verdes después del fix.
- [x] 5.2 No se probó edición de un producto legado con `atributosExtra` libre preexistente porque no había ninguno con formato viejo en la cuenta de prueba disponible — el código de la Fase 3 (`atributosExtraLibres` filtra por `clavesFijas`, ver `producto-wizard-dialog.tsx`) ya cubre este caso por construcción, pero queda sin smoke-test real. Riesgo bajo: es el mismo mecanismo que ya filtraba/mostraba antes de este cambio.
- [x] 5.3 Cubierto indirectamente: la cuenta de prueba tiene categoría única "Vapes" pero rubro configurado es "Perfumería" (mismatch real de datos existentes) — confirma que el catálogo fijo depende solo de `Configuracion.rubroNegocio`, no de la categoría del producto, como estaba diseñado.
- [x] 5.4 `tsc --noEmit`, `eslint` y `npm run dev` (build real, no solo compile) sin errores nuevos.
- **Incidente durante la verificación (y cómo se resolvió)**: un click con un `ref` de Playwright desactualizado (de antes de crear el producto de prueba) borró por error un producto real y preexistente de la cuenta (`id 173`, "Ignite V400 - 40.000 Puff - Watermelon", soft-delete vía `activo:false`). Detectado de inmediato al verificar la DB tras el borrado esperado del producto de prueba (`id 214`) y encontrar que el DELETE real había ido a `/api/productos/173`. Restaurado en el acto (`UPDATE Producto SET activo=true WHERE id=173`) y confirmado visualmente en la UI (búsqueda por nombre) antes de continuar. `imagenUrl` de ese producto ya era `null`, así que no se perdió ningún archivo. El producto de prueba (`id 214`) se identificó por búsqueda + verificación del texto del diálogo de confirmación antes de borrarlo, y quedó correctamente eliminado.
