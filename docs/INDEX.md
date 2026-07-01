# Indice Tecnico

Este directorio centraliza la documentacion del sistema. Cada tema tiene una unica fuente de verdad para evitar duplicados desactualizados.

## Referencia (vigente, mantener actualizado)

- `docs/GUIA_TECNICA_PROYECTO.md`: **fuente de verdad de arquitectura, stack, seguridad, entorno y despliegue.**
- `docs/API_REFERENCIA_TECNICA.md`: **fuente de verdad del contrato de API** — endpoint por endpoint, request/response/error.
- `docs/DOCUMENTACION.md`: **fuente de verdad de funcionalidad, rutas frontend y modelo de datos** (entidades + enums campo por campo).
- `docs/MANUAL_SISTEMA.md`: manual funcional — roles, modulos y flujos operativos narrados.
- `docs/GUIA_CAMBIOS.md`: que archivos tocar segun el tipo de cambio + reglas de negocio que no conviene romper.
- `docs/KPI_CALCULATIONS.md`: formulas de KPIs del dashboard.
- `docs/ROADMAP.md`: roadmap de funcionalidades futuras.
- `docs/CHANGELOG.md`: historial semantico de cambios de documentacion/arquitectura.

## Subcarpetas

- `docs/ADR/`: decisiones de arquitectura (ej. `0001-servidor-custom-next-socketio.md`).
- `docs/features/`: documentacion de features ya implementadas (carrito WhatsApp, deteccion de sucursal, etc.).
- `docs/plans/`: propuestas/planes **aun no implementados** (verificar estado antes de asumir que ya existen en el codigo).
- `docs/security/`: politicas y runbooks de seguridad (rate limiting, secretos, uploads, checklist de produccion).
- `docs/business/`: documentos de estrategia/modelo de negocio (no tecnicos).
- `docs/archive/`: documentacion historica o superada por los documentos de referencia — se conserva solo por contexto, no confiar en su vigencia.

## Orden sugerido de lectura

1. `README.md` (raiz del proyecto)
2. `docs/GUIA_TECNICA_PROYECTO.md`
3. `docs/DOCUMENTACION.md`
4. `docs/API_REFERENCIA_TECNICA.md`
5. `docs/ADR/0001-servidor-custom-next-socketio.md`
6. `docs/GUIA_CAMBIOS.md` (antes de hacer un cambio puntual)
