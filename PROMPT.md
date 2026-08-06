# Goal

Fase 6 de KNOWLEDGE,cloud ("revisión visual autenticada"): completar el
ítem que quedó pendiente desde Fase 1 — revisar con capturas reales, en
light y dark, un set representativo de pantallas autenticadas (dashboard,
tablas, gráficos) para confirmar que la paleta/tipografía/marca nuevas
(Fases 1-5) no dejaron regresiones de contraste, texto ilegible, o
colores fuera de `know-design-system.ts` en pantallas que ningún smoke
test anterior cubrió a fondo.

Es una fase de auditoría, no de feature: el resultado esperado es un
hallazgo documentado por pantalla (o "sin hallazgos"), y sólo se corrige
en el momento si el fix es trivial y estrictamente dentro de lo que ya
tocaron las Fases 1-5 (paleta/tipografía/marca). Todo lo demás se
documenta para una sesión aparte.

# Done when

- Capturas en light y dark (1440×900, autenticado como ADMIN) de:
  - `/dashboard` (KPIs, gráficos, selector de rango de fechas).
  - `/productos` (tabla con filtros).
  - `/consignaciones` (tabla).
  - `/ventas/nueva` (formulario denso, carrito).
  - `/settings/tienda` (`BrandingTab` — icono de que el branding del
    cliente no se pisó con la identidad propia de la app).
- Por cada pantalla: contraste texto/fondo a simple vista, que
  `--primary`/`--foreground`/`--muted-foreground` etc. coincidan con
  `know-design-system.ts` (no un color viejo hardcodeado que el guardrail
  no haya detectado), y que la tipografía Satoshi se vea aplicada.
- Hallazgos (si los hay) documentados en `IMPLEMENTATION_PLAN.md` con
  pantalla, tema (light/dark) y descripción — no hace falta ticket
  externo, esto ES el registro.
- Si aparece un hallazgo que amerita fix inmediato (ej. un color
  hardcodeado suelto), se corrige y se vuelve a capturar esa pantalla
  puntual para confirmar. Si el fix se sale del alcance de paleta/
  tipografía/marca, se documenta como pendiente en vez de arreglarlo acá.

# Never touch

- Lógica de negocio, endpoints, queries — esta fase es sólo visual.
- Archivos bloqueados por la auditoría (>1000 líneas).
- Nada del branding configurable por tienda (`BrandingTab.tsx` se mira,
  no se edita, salvo que el hallazgo sea justo ahí y sea trivial).

# Stop if

- Un hallazgo requiere tocar lógica de negocio o un archivo bloqueado
  para resolverse — se documenta y se corta ahí, no se fuerza el fix.
- No hay forma de loguearse en el entorno de dev disponible.
