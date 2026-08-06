# KNOWLEDGE,cloud — Fase 0

## Completado

- Scanner visual y estructural sin dependencias.
- Detección de colores, paletas Tailwind, fuentes y marcas legacy.
- Límite de 300 líneas para archivos nuevos.
- Ratchet por archivo para deuda existente.
- Baseline recapturado contra HEAD (`06d1f5c`, ya incluye `be41d06` y la feature
  de share-links con rango de fechas) para 551 archivos, con líneas y deuda
  estructurada. El baseline anterior había quedado desactualizado respecto a
  varios commits de features ya mergeados a `main`, sin relación con esta fase.
- Salida humana y JSON.
- Veintitrés pruebas unitarias e integrales.
- Integración obligatoria dentro de `npm run lint`.
- Build portable y fail-fast orquestado desde Node.
- Capa léxica sin dependencias para funciones y bloques balanceados.
- Verificación adversarial final aprobada sin hallazgos.

## Pendiente

- Iniciar Fase 1 en una sesión separada.

## Deuda preexistente

- El lint global registra cerca de 10.903 errores anteriores a esta fase; el
  guardrail se ejecuta primero y su suite focalizada debe permanecer verde.

## Límites

- Una sola feature: guardrails y baseline.
- No se modifica UI en esta fase.
- Máximo 300 líneas por archivo manual nuevo.
