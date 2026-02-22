-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'TRIAL_ENDING';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_ACTIVE';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_ORDER';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'EXPORT_READY';
ALTER TYPE "NotificationType" ADD VALUE 'CLIENT_REGISTERED';
