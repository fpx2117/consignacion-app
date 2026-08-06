# Goal

Implementar la Fase 0 de KNOWLEDGE,cloud: guardrails automáticos que impidan aumentar hardcoding visual o tamaño de archivos mientras la deuda existente se reduce por ratchet.

# Done when

- Existe un scanner Node sin dependencias externas.
- Detecta colores literales, clases Tailwind de paleta, fuentes legacy e identidades legacy.
- Detecta archivos productivos manuales de más de 300 líneas.
- Archivos nuevos deben tener cero violaciones y máximo 300 líneas.
- Archivos existentes no pueden superar su baseline de líneas o violaciones.
- El baseline es compacto, versionable y regenerable explícitamente.
- Hay salida humana y JSON con exit code no cero ante regresiones.
- Pruebas unitarias, scanner, lint y build finalizan correctamente.
- Ningún archivo manual nuevo supera 300 líneas.

# Never touch

- UI, colores o tipografía productiva en esta fase.
- Archivos locales bajo `.claude/`, `.playwright-cli/` y `MEMORY.md`.
- Migraciones existentes, schema o datos productivos.
- Cambios previos no relacionados presentes en el worktree.

# Stop if

- El scanner requiere una dependencia nueva.
- El baseline supera 300 líneas sin una razón generada y documentada.
- La implementación exige modificar más de seis archivos fuera de documentación y tests.
- Una prueba previamente verde falla por comportamiento no relacionado.
