# Tareas: Proveedores por Sucursal + Visor de Imagen de Factura

Ambas fases son independientes — no hace falta completar la Fase 1 para deployar la Fase 2, ni viceversa. Cubre Parte 1 y Parte 2 de `proposal.md`; Partes 3 y 4 (utilidad de la pestaña "Facturas" y backlog de faltantes) quedan fuera hasta que se decida su alcance por separado.

## Fase 1: Proveedores por sucursal

- [x] 1.1 Migración Prisma: `Proveedor.sucursalId Int? @default(1)` + relación a `Sucursal` (`ON DELETE SET NULL`) + `@@index([sucursalId])` + lado inverso `Sucursal.proveedores` + `prisma generate` — migración escrita a mano y aplicada con `migrate deploy` (se evitó `migrate dev`: detectó drift de shadow-db contra la base real de Railway y pedía `migrate reset`; no se ejecutó, `migrate status` confirmó la base intacta antes de continuar)
- [x] 1.2 `src/app/api/proveedores/route.ts`: `GET` filtra con `buildSucursalWhere(auth)` (orden secundario por `sucursalId` en vista global); `POST` bloquea vista global (409) y persiste `sucursalId: auth.activeSucursalId`
- [x] 1.3 `src/app/api/proveedores/[id]/route.ts`: `GET` verifica `canAccessSucursalResource` (404 si no pertenece); `PATCH`/`DELETE` bloquean vista global (409) y verifican pertenencia antes de escribir
- [x] 1.4 `src/app/api/facturas-proveedor/[id]/process/route.ts`: agregar `sucursalId: factura.sucursalId` al `where` del `findFirst` de match automático por nombre (línea ~96-99)
- [x] 1.5 `src/lib/apiService.ts`: tipo `Proveedor` agrega `sucursalId: number | null`
- [ ] 1.6 Verificar manualmente: crear proveedor desde Sucursal A, confirmar que no aparece en el listado de Sucursal B; confirmar que vista global (ADMIN) sigue viendo ambos en modo solo lectura; subir una factura con proveedor homónimo en dos sucursales distintas y confirmar que el match automático no cruza sucursales

## Fase 2: Visor de imagen de factura

- [x] 2.1 `src/app/api/facturas-proveedor/[id]/archivo/route.ts`: agregar segunda vía de autenticación por sesión (`requireAuth()` + `canAccessSucursalResource(auth, factura.sucursalId)`) que coexista con el token HMAC existente, sin duplicar la lógica de lectura de archivo
- [x] 2.2 `src/lib/apiService.ts`: entrada `API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(id)` + `archivoMime` agregado al tipo `FacturaProveedor` (faltaba, la API ya lo devolvía)
- [x] 2.3 `factura-detalle-dialog.tsx`: bloque de visor antes de la tabla de ítems — `<img>` con enlace a tamaño completo si `archivoMime` empieza con `image/`, enlace "Abrir PDF original" si es `application/pdf`; sólo cuando `!factura.archivoEliminado`
- [ ] 2.4 Verificar manualmente: factura recién subida (sin confirmar/cancelar) muestra la imagen en el diálogo de detalle; factura ya confirmada/cancelada (`archivoEliminado: true`) sigue mostrando el mensaje actual sin intentar cargar nada; acceder a la URL del archivo sin sesión (curl/incógnito) devuelve 403
