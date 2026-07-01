# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added

- Added technical documentation index at `docs/INDEX.md`.
- Added project-level technical guide at `docs/GUIA_TECNICA_PROYECTO.md`.
- Added endpoint-by-endpoint API reference at `docs/API_REFERENCIA_TECNICA.md`.
- Added concrete JSON examples for critical endpoints (login, ventas, consignaciones, checkout publico, webhooks).
- Added ready-to-run cURL examples for QA/integration checks on critical endpoints.
- Added PowerShell (`Invoke-RestMethod`) examples for Windows-based QA/integration flows.
- Added architecture decision record `docs/ADR/0001-servidor-custom-next-socketio.md`.

### Changed

- Updated `README.md` with links to the new technical documentation index.
- Reorganized `docs/`: consolidated root-level loose docs (`DOCUMENTACION.md`, `MANUAL_SISTEMA.md`, `MEMORIA_TECNICA_PROYECTO.md`, `KPI_CALCULATIONS.md`, `ROADMAP.md`) into `docs/`, removed duplicated content across large reference docs (each topic now has a single source of truth per `docs/INDEX.md`), split unimplemented proposals into `docs/plans/`, superseded/completed docs into `docs/archive/`, and speculative business docs into `docs/business/`.
- Extracted the unique "where to touch per change type" + business-invariants content from `MEMORIA_TECNICA_PROYECTO.md` into a new focused doc, `docs/GUIA_CAMBIOS.md`.

### Removed

- Deleted root-level generated/obsolete docs with no remaining value: `README-DOCUMENTATION.md`, `DOCUMENTOS-README.md`, `TECNICO.md`, `DOCUMENTATION/ESTRUCTURA-COMPLETA.md`, `DOCUMENTATION/PROYECTO-MAESTRO.md` (contained inaccurate/invented data about the schema).
