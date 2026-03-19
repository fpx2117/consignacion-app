# Compatibilidad transitoria de uploads y serving

## Estado objetivo de Fase 3

- Los uploads nuevos se almacenan fuera de `public/uploads`.
- El identificador publico canonico pasa a ser `/api/files/<uuid>.<ext>`.
- El handler de serving solo entrega nombres opacos y tipos aprobados por la allowlist.

## Compatibilidad legacy segura

Mientras existan registros historicos apuntando a `/uploads/<archivo>`, se mantiene una compatibilidad transitoria y acotada:

1. El backend deja de generar URLs nuevas bajo `/uploads/`.
2. El helper de borrado sigue reconociendo `/uploads/<archivo>` para no dejar basura al editar o desactivar productos existentes.
3. `src/app/api/files/[...path]/route.ts` mantiene compatibilidad transitoria solo para nombres legacy ya emitidos historicamente por ese mismo endpoint (por ejemplo `timestamp-slug.ext`), siempre restringidos a la misma allowlist de tipos servibles.
4. Los recursos legacy de `public/uploads` no se reexponen por `api/files`; siguen dependiendo de su ruta historica o de una migracion operativa explicita.
5. La migracion fisica de `public/uploads` a almacenamiento controlado queda diferida a una tarea operativa explicita para no reescribir URLs historicas sin inventario previo.

## Riesgo residual aceptado

- Un archivo legacy ya publicado bajo `/uploads/` sigue dependiendo del inventario y migracion posterior para salir completamente de la ruta publica estatica.
- La superficie nueva queda endurecida por defecto: no se agregan mas archivos a esa ruta y el serving controlado solo acepta recursos validados.
