# Propuesta: OCR Pipeline Inteligente — Fuzzy Matching + Equivalencias + Revisión Manual

## Intención

Transformar el actual OCR de facturas — que hoy es un pipeline lineal frágil (escanea → matchea con Dice → confirma) — en un **sistema adaptativo e interactivo** que:

1. **Matchee mejor** los productos detectados contra el catálogo usando pg_trgm (trigram similarity) en lugar del rudimentario coeficiente de Dice.
2. **Aprenda con el uso** — cuando el usuario corrige un match, el sistema guarda la equivalencia para que el próximo OCR de ese mismo proveedor matchee automáticamente.
3. **Exponga toda la información** en la UI de revisión: score de confianza, alternativas de match, indicador visual de si es match automático vs. manual.

## Alcance

### Dentro del Alcance

1. **Nuevo modelo `EquivalenciaOcr` en Prisma** — tabla que asocia `textoDetectadoNormalizado × proveedor × productoId` con contador de usos y score de confianza.
2. **Reemplazo del motor de fuzzy matching** — migrar de `coeficienteDice()` en TypeScript a consultas `pg_trgm` nativas en PostgreSQL (con extensión `pg_trgm`). Mantener el coeficiente de Dice como fallback para desarrollo local sin extensiones.
3. **Sistema de aprendizaje automático** — al confirmar una fila (con match manual o automático), guardar/actualizar `EquivalenciaOcr` para que futuros OCRs reconozcan ese texto.
4. **Nuevo extractor de factura `parse-factura-v2.ts`** — versión mejorada que también extrae proveedor (razón social, CUIT) del encabezado de la factura, y detecta mejor cantidades/precios con heurística más robusta.
5. **Mejora de la UI de revisión** — mostrar:
   - Score de match con badge de color (verde >80%, amarillo >50%, rojo <50%)
   - Top 3 alternativas de producto en dropdown para re-match manual
   - Indicador de que existe equivalencia previa (estrella/aprendido)
6. **Actualización de las API routes**:
   - `analizar/route.ts`: devolver alternativas top-N, proveedor detectado, si hay equivalencia previa
   - `confirmar/route.ts`: guardar equivalencias post-confirmación
7. **Actualización de `apiService.ts`** con nuevos types.

### Fuera del Alcance

- OCR multi-página de PDF (se mantiene límite de 5 páginas)
- Reconocimiento de imágenes de fábrica/logos en la factura
- Integración con proveedores específicos (AFIP, factura electrónica AR)
- Dashboard de estadísticas de equivalencias
- Entrenamiento manual de equivalencias (solo aprendizaje implícito post-confirmación)

## Enfoque

Se adoptará un enfoque en 4 capas:

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| **Extracción** | `parse-factura-v2.ts` + heurística mejorada | Extraer productos + proveedor del texto OCR |
| **Matching** | `pg_trgm` (primario) + Dice (fallback) + cache de equivalencias | Encontrar el producto correcto en el catálogo |
| **Aprendizaje** | Modelo `EquivalenciaOcr` + actualización post-confirmación | El sistema mejora con cada uso |
| **Presentación** | UI mejorada en `OcrFacturaDialog` | El usuario ve confianza, alternativas, y corrige fácilmente |

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `prisma/schema.prisma` | Modificado | Nuevo modelo `EquivalenciaOcr` + migración |
| `src/lib/ocr/match-producto.ts` | Modificado | Nueva función `matchProductoV2` con pg_trgm + equivalencias |
| `src/lib/ocr/parse-factura.ts` | Modificado | Nueva versión `parseFacturaTextoV2` que extrae proveedor |
| `src/lib/ocr/ocr-engine.ts` | Sin cambios | No se toca |
| `src/lib/ocr/tesseract-service.ts` | Sin cambios | No se toca |
| `src/lib/ocr/match-producto.ts` | Creado | `match-producto-v2.ts` lógica principal |
| `src/app/api/productos/ocr-factura/analizar/route.ts` | Modificado | Devolver alternativas, proveedor, equivalencias |
| `src/app/api/productos/ocr-factura/confirmar/route.ts` | Modificado | Guardar equivalencias post-confirmación |
| `src/app/(system-guard)/(protected)/productos/components/ocr-factura-dialog.tsx` | Modificado | UI con confianza visual, alternativas, indicador de aprendizaje |
| `src/lib/apiService.ts` | Modificado | Nuevos tipos + métodos |
| `src/lib/productos/queries.ts` | Creado (opcional) | Queries de matching centralizadas |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `pg_trgm` no disponible en Railway/PostgreSQL | Baja | Incluir migración SQL para crear la extensión; fallback a Dice |
| El parseo de proveedor del OCR falla seguido | Media | Hacerlo opcional — el sistema funciona sin proveedor, solo con texto |
| Aprendizaje de equivalencias crea matches incorrectos | Media | Solo auto-match si equivalencia tiene `usoCount >= 3` y `confianza > 0.85` |
| Migración de Prisma conflictúa con deploys en Railway | Baja | Usar `prisma migrate dev` + verificar compatibilidad con script deploy existente |

## Plan de Reversión (Rollback)

1. **Base de datos**: `prisma migrate down` elimina la tabla `EquivalenciaOcr` (o `migrate dev --create-only` para revisar antes de aplicar)
2. **Código**: git revert de los commits del cambio
3. **API/UI**: Las rutas viejas `analizar` y `confirmar` siguen funcionando — se pueden desplegar sin cambios en la UI (la UI nueva consume los campos extra pero es compatible hacia atrás)

## Dependencias

- PostgreSQL con extensión `pg_trgm` (incluir CREATE EXTENSION IF NOT EXISTS en la migración)
- `tsx` para migraciones de desarrollo (ya existe)
- Prisma 7 (ya existe)

## Criterios de Éxito

- [ ] El fuzzy matching con pg_trgm es notablemente más preciso que Dice para todos los casos de prueba existentes
- [ ] Las equivalencias se guardan correctamente al confirmar una factura
- [ ] Una segunda carga de la misma factura auto-matchea productos que antes requirieron corrección manual
- [ ] La UI muestra score de confianza visual (colores), top-3 alternativas, y estado de aprendizaje
- [ ] `pg_trgm` se instala automáticamente via migración (sin intervención manual en Railway)
- [ ] Rollback funciona: git revert + migrate down sin pérdida de datos
