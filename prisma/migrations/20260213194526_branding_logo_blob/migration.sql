/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `Branding` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Branding" DROP COLUMN "logoUrl",
ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMime" TEXT;
