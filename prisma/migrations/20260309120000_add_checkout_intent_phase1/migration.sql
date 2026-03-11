-- CreateEnum
CREATE TYPE "CheckoutIntentStatus" AS ENUM ('INITIATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CheckoutIntentProvider" AS ENUM ('MERCADOPAGO');

-- CreateTable
CREATE TABLE "CheckoutIntent" (
    "id" TEXT NOT NULL,
    "cliente" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "envio" JSONB,
    "totals" JSONB NOT NULL,
    "status" "CheckoutIntentStatus" NOT NULL DEFAULT 'INITIATED',
    "paymentProvider" "CheckoutIntentProvider" NOT NULL DEFAULT 'MERCADOPAGO',
    "externalReference" TEXT NOT NULL,
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "mpMerchantOrderId" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ventaId" INTEGER,

    CONSTRAINT "CheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_externalReference_key" ON "CheckoutIntent"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_mpPaymentId_key" ON "CheckoutIntent"("mpPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIntent_ventaId_key" ON "CheckoutIntent"("ventaId");

-- CreateIndex
CREATE INDEX "CheckoutIntent_status_idx" ON "CheckoutIntent"("status");

-- CreateIndex
CREATE INDEX "CheckoutIntent_createdAt_idx" ON "CheckoutIntent"("createdAt");

-- AddForeignKey
ALTER TABLE "CheckoutIntent" ADD CONSTRAINT "CheckoutIntent_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
