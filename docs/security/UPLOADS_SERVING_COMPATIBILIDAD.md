# Compatibilidad transitoria de uploads y serving

## Estado objetivo de Fase 3

- Los uploads nuevos se almacenan fuera de `public/uploads`.
- El identificador publico canonico pasa a ser `/api/files/<uuid>.<ext>`.
- El handler de serving solo entrega nombres opacos y tipos aprobados por la allowlist.

## Compatibilidad legacy segura

Mientras existan registros historicos apuntando a `/uploads/<archivo>`, se mantiene una compatibilidad transitoria y acotada:

1. El backend deja de generar URLs nuevas bajo `/uploads/`.
2. El helper de borrado sigue reconociendo `/uploads/<archivo>` para no dejar basura al editar o desactivar productos existentes.
3. Los recursos legacy no se reexponen por `src/app/api/files/[...path]/route.ts`; el handler nuevo solo resuelve nombres opacos emitidos por el servidor.
4. La migracion fisica de `public/uploads` a almacenamiento controlado queda diferida a una tarea operativa explicita para no reescribir URLs historicas sin inventario previo.

## Riesgo residual aceptado

- Un archivo legacy ya publicado bajo `/uploads/` sigue dependiendo del inventario y migracion posterior para salir completamente de la ruta publica estatica.
- La superficie nueva queda endurecida por defecto: no se agregan mas archivos a esa ruta y el serving controlado solo acepta recursos validados.
