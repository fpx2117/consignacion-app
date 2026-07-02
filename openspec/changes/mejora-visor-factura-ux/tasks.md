# Tareas: Manejo de errores y rediseño del visor de imagen de factura

Todo en `factura-detalle-dialog.tsx`, una sola fase.

- [x] 1.1 Extraer el bloque visual de "imagen no disponible" (ícono `ImageOff` + texto) a un componente local `ImagenNoDisponibleMensaje({ texto })`, reusado por el caso `archivoEliminado` y el nuevo caso de error de carga
- [x] 1.2 Agregar estado `imagenConError` (reseteado al cambiar `facturaId`) + `onError` en el `<img>` del visor que lo activa
- [x] 1.3 `DialogContent`: agregar `lg:max-w-[1040px]` al className existente
- [x] 1.4 Reestructurar el body en dos columnas (`lg:flex`) — imagen/PDF/mensaje a la izquierda con `lg:h-full`, tabla de ítems a la derecha — manteniendo el layout apilado actual por debajo de `lg:`
- [x] 1.5 Copy contextual: `mensajeArchivoEliminado(estado)` distinguiendo `CANCELADA` / `CONFIRMADA` / resto
- [x] 1.6 Verificado por inspección de código: el `onError` reemplaza el `<img>` por `ImagenNoDisponibleMensaje` en el siguiente render — mismo patrón ya probado para `archivoEliminado`; no se forzó una falla real de red para no depender de cancelar una factura de prueba
- [x] 1.7 Verificado con Playwright en viewport 1400px: la factura 411496 (17 ítems) se ve con la imagen legible en la columna izquierda y la tabla completa a la derecha, sin necesidad de abrir el lightbox
- [x] 1.8 Verificado con Playwright en viewport 390px (mobile): layout apilado (imagen arriba, tabla abajo), igual que antes del cambio — sin regresión
- [ ] 1.9 Verificar manualmente en producción: abrir la factura 44 (o cualquier factura `CANCELADA`/`CONFIRMADA` con `archivoEliminado: true`) y confirmar que el mensaje menciona el motivo correcto, sin ningún request a `/archivo` en la pestaña de Red — pendiente porque la base local (compartida con producción vía el mismo `DATABASE_URL`) no tenía en el momento de probar una factura con proveedor asignado y `CANCELADA`/`CONFIRMADA` a mano para el usuario logueado de prueba
