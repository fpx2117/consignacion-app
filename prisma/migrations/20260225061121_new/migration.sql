-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "EstadoSesionCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "TipoVenta" AS ENUM ('CASUAL', 'LIQUIDACION');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "MotivoMovimientoStock" AS ENUM ('COMPRA', 'DEVOLUCION_CLIENTE', 'AJUSTE_POSITIVO', 'ROTURA', 'VENCIMIENTO', 'PERDIDA', 'AJUSTE_NEGATIVO', 'VENTA', 'CONSIGNACION');

-- CreateEnum
CREATE TYPE "ShareLinkType" AS ENUM ('TICKET', 'REMITO', 'INVENTARIO', 'HISTORIAL_INVENTARIO');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'SYSTEM', 'EXPIRATION_NEAR', 'PRODUCT_EXPIRED', 'SUBSCRIPTION_EXPIRING', 'TRIAL_ENDING', 'SUBSCRIPTION_ACTIVE', 'NEW_ORDER', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'EXPORT_READY', 'CLIENT_REGISTERED', 'CONSIGNMENT_ALERT');

-- CreateEnum
CREATE TYPE "EstadoConsignacion" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('PRUEBA', 'ACTIVO', 'ATRASADO', 'CANCELADO', 'INCOMPLETO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "ProveedorSuscripcion" AS ENUM ('MERCADOPAGO', 'PAYPAL', 'PROMO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" SERIAL NOT NULL,
    "minStockGlobal" INTEGER NOT NULL DEFAULT 5,
    "diasAnticipacionVencimiento" INTEGER NOT NULL DEFAULT 7,
    "notificarStockBajo" BOOLEAN NOT NULL DEFAULT true,
    "notificarVencimientos" BOOLEAN NOT NULL DEFAULT true,
    "notificarVentas" BOOLEAN NOT NULL DEFAULT true,
    "usarControlDeCaja" BOOLEAN NOT NULL DEFAULT true,
    "diasAvisoConsignacion" INTEGER NOT NULL DEFAULT 15,
    "notificarConsignacionesActivas" BOOLEAN NOT NULL DEFAULT true,
    "notificarLiquidaciones" BOOLEAN NOT NULL DEFAULT true,
    "mensajeWhatsappConsignacion" TEXT,
    "mensajeWhatsappVenta" TEXT,
    "sucursalId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sucursalId" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioLaboral" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HorarioLaboral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "saldoCuenta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sucursalId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branding" (
    "id" SERIAL NOT NULL,
    "businessName" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#111827',
    "footerText" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "logoData" BYTEA,
    "logoMime" TEXT,
    "sucursalId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "motivo" "MotivoMovimientoStock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockPrevio" INTEGER NOT NULL,
    "stockPosterior" INTEGER NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sucursalId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "productoId" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioVenta" DECIMAL(10,2) NOT NULL,
    "precioCosto" DECIMAL(10,2) NOT NULL,
    "stockDisponibleUnits" INTEGER NOT NULL DEFAULT 0,
    "stockConsignadoUnits" INTEGER NOT NULL DEFAULT 0,
    "packSizeUnits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockMinUnits" INTEGER NOT NULL DEFAULT 0,
    "fechaVencimiento" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "categoriaId" INTEGER,
    "codigoBarra" TEXT,
    "descripcion" TEXT,
    "iva" DECIMAL(5,2) NOT NULL DEFAULT 21.0,
    "sku" TEXT,
    "sucursalId" INTEGER DEFAULT 1,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caja" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "sucursalId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionCaja" (
    "id" SERIAL NOT NULL,
    "cajaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "estado" "EstadoSesionCaja" NOT NULL DEFAULT 'ABIERTA',
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "montoInicial" DECIMAL(10,2) NOT NULL,
    "montoFinalEsperado" DECIMAL(10,2),
    "montoFinalReal" DECIMAL(10,2),
    "diferencia" DECIMAL(10,2),
    "observaciones" TEXT,

    CONSTRAINT "SesionCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" SERIAL NOT NULL,
    "sesionCajaId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'sky',

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" SERIAL NOT NULL,
    "codeHash" TEXT NOT NULL,
    "type" "ShareLinkType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxViews" INTEGER NOT NULL DEFAULT 3,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3),
    "codeEnc" TEXT NOT NULL,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consignacion" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoConsignacion" NOT NULL DEFAULT 'ABIERTA',
    "numeroFolio" INTEGER NOT NULL,
    "porcentajeAumento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sucursalId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Consignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignacionDetalle" (
    "id" SERIAL NOT NULL,
    "consignacionId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "unitsEntregadas" INTEGER NOT NULL,
    "unitsVendidasAcum" INTEGER NOT NULL DEFAULT 0,
    "unitsDevueltasAcum" INTEGER NOT NULL DEFAULT 0,
    "precioUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ConsignacionDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidacion" (
    "id" SERIAL NOT NULL,
    "consignacionId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionItem" (
    "id" SERIAL NOT NULL,
    "liquidacionId" INTEGER NOT NULL,
    "consignacionDetalleId" INTEGER NOT NULL,
    "unitsVendidas" INTEGER NOT NULL DEFAULT 0,
    "unitsDevueltas" INTEGER NOT NULL DEFAULT 0,
    "precioUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "LiquidacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "liquidacionId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL,
    "sesionCajaId" INTEGER,
    "tipo" "TipoVenta" NOT NULL DEFAULT 'CASUAL',
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "sucursalId" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaDetalle" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "VentaDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "sesionCajaId" INTEGER,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioARS" DECIMAL(10,2) NOT NULL,
    "precioUSD" DECIMAL(10,2) NOT NULL,
    "mercadopagoId" TEXT,
    "paypalId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "status" "EstadoSuscripcion" NOT NULL DEFAULT 'PRUEBA',
    "provider" "ProveedorSuscripcion" NOT NULL,
    "externalId" TEXT NOT NULL,
    "mpPreapprovalId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLimit" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "maxProductos" INTEGER NOT NULL DEFAULT -1,
    "maxUsuarios" INTEGER NOT NULL DEFAULT 5,
    "allowConsignaciones" BOOLEAN NOT NULL DEFAULT false,
    "allowSucursales" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResetPasswordToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResetPasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSucursal" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "stockDisponibleUnits" INTEGER NOT NULL DEFAULT 0,
    "stockConsignadoUnits" INTEGER NOT NULL DEFAULT 0,
    "stockMinUnits" INTEGER NOT NULL DEFAULT 0,
    "precioVentaOverride" DECIMAL(10,2),
    "precioCostoOverride" DECIMAL(10,2),

    CONSTRAINT "StockSucursal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_sucursalId_key" ON "Configuracion"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_sucursalId_idx" ON "Usuario"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_isActive_idx" ON "UserSession"("isActive");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HorarioLaboral_usuarioId_diaSemana_key" ON "HorarioLaboral"("usuarioId", "diaSemana");

-- CreateIndex
CREATE INDEX "Cliente_sucursalId_idx" ON "Cliente"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Branding_sucursalId_key" ON "Branding"("sucursalId");

-- CreateIndex
CREATE INDEX "MovimientoStock_productoId_idx" ON "MovimientoStock"("productoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_createdAt_idx" ON "MovimientoStock"("createdAt");

-- CreateIndex
CREATE INDEX "MovimientoStock_sucursalId_idx" ON "MovimientoStock"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_fingerprint_key" ON "Notification"("fingerprint");

-- CreateIndex
CREATE INDEX "Notification_read_updatedAt_idx" ON "Notification"("read", "updatedAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_productoId_idx" ON "Notification"("productoId");

-- CreateIndex
CREATE INDEX "Producto_codigoBarra_idx" ON "Producto"("codigoBarra");

-- CreateIndex
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");

-- CreateIndex
CREATE INDEX "Producto_sucursalId_idx" ON "Producto"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarra_sucursalId_key" ON "Producto"("codigoBarra", "sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_sku_sucursalId_key" ON "Producto"("sku", "sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Caja_nombre_key" ON "Caja"("nombre");

-- CreateIndex
CREATE INDEX "Caja_sucursalId_idx" ON "Caja"("sucursalId");

-- CreateIndex
CREATE INDEX "SesionCaja_cajaId_estado_idx" ON "SesionCaja"("cajaId", "estado");

-- CreateIndex
CREATE INDEX "SesionCaja_usuarioId_fechaApertura_idx" ON "SesionCaja"("usuarioId", "fechaApertura");

-- CreateIndex
CREATE INDEX "MovimientoCaja_sesionCajaId_idx" ON "MovimientoCaja"("sesionCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_codeHash_key" ON "ShareLink"("codeHash");

-- CreateIndex
CREATE INDEX "ShareLink_type_targetId_expiresAt_idx" ON "ShareLink"("type", "targetId", "expiresAt");

-- CreateIndex
CREATE INDEX "Consignacion_clienteId_fecha_idx" ON "Consignacion"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "Consignacion_estado_fecha_idx" ON "Consignacion"("estado", "fecha");

-- CreateIndex
CREATE INDEX "Consignacion_clienteId_numeroFolio_idx" ON "Consignacion"("clienteId", "numeroFolio");

-- CreateIndex
CREATE INDEX "Consignacion_sucursalId_idx" ON "Consignacion"("sucursalId");

-- CreateIndex
CREATE INDEX "ConsignacionDetalle_consignacionId_idx" ON "ConsignacionDetalle"("consignacionId");

-- CreateIndex
CREATE INDEX "ConsignacionDetalle_productoId_idx" ON "ConsignacionDetalle"("productoId");

-- CreateIndex
CREATE INDEX "Liquidacion_consignacionId_fecha_idx" ON "Liquidacion"("consignacionId", "fecha");

-- CreateIndex
CREATE INDEX "LiquidacionItem_liquidacionId_idx" ON "LiquidacionItem"("liquidacionId");

-- CreateIndex
CREATE INDEX "LiquidacionItem_consignacionDetalleId_idx" ON "LiquidacionItem"("consignacionDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_liquidacionId_key" ON "Venta"("liquidacionId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_fecha_idx" ON "Venta"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "Venta_sesionCajaId_idx" ON "Venta"("sesionCajaId");

-- CreateIndex
CREATE INDEX "Venta_tipo_idx" ON "Venta"("tipo");

-- CreateIndex
CREATE INDEX "Venta_sucursalId_idx" ON "Venta"("sucursalId");

-- CreateIndex
CREATE INDEX "VentaDetalle_ventaId_idx" ON "VentaDetalle"("ventaId");

-- CreateIndex
CREATE INDEX "VentaDetalle_productoId_idx" ON "VentaDetalle"("productoId");

-- CreateIndex
CREATE INDEX "Pago_clienteId_fecha_idx" ON "Pago"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "Pago_sesionCajaId_idx" ON "Pago"("sesionCajaId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_externalId_key" ON "Subscription"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLimit_planId_key" ON "PlanLimit"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ResetPasswordToken_token_key" ON "ResetPasswordToken"("token");

-- CreateIndex
CREATE INDEX "ResetPasswordToken_email_idx" ON "ResetPasswordToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StockSucursal_productoId_sucursalId_key" ON "StockSucursal"("productoId", "sucursalId");

-- AddForeignKey
ALTER TABLE "Configuracion" ADD CONSTRAINT "Configuracion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioLaboral" ADD CONSTRAINT "HorarioLaboral_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branding" ADD CONSTRAINT "Branding_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignacion" ADD CONSTRAINT "Consignacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignacion" ADD CONSTRAINT "Consignacion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignacionDetalle" ADD CONSTRAINT "ConsignacionDetalle_consignacionId_fkey" FOREIGN KEY ("consignacionId") REFERENCES "Consignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignacionDetalle" ADD CONSTRAINT "ConsignacionDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_consignacionId_fkey" FOREIGN KEY ("consignacionId") REFERENCES "Consignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionItem" ADD CONSTRAINT "LiquidacionItem_consignacionDetalleId_fkey" FOREIGN KEY ("consignacionDetalleId") REFERENCES "ConsignacionDetalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionItem" ADD CONSTRAINT "LiquidacionItem_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLimit" ADD CONSTRAINT "PlanLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSucursal" ADD CONSTRAINT "StockSucursal_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSucursal" ADD CONSTRAINT "StockSucursal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
