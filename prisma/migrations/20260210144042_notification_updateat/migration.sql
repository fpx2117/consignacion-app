/*
  Warnings:

  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Notification_productoId_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_read_createdAt_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_read_updatedAt_idx" ON "Notification"("read", "updatedAt");

-- CreateIndex
CREATE INDEX "Notification_productoId_idx" ON "Notification"("productoId");
