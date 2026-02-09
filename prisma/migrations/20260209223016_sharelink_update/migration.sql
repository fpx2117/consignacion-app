/*
  Warnings:

  - Added the required column `codeEnc` to the `ShareLink` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ShareLink_expiresAt_idx";

-- DropIndex
DROP INDEX "ShareLink_type_targetId_idx";

-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "codeEnc" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ShareLink_type_targetId_expiresAt_idx" ON "ShareLink"("type", "targetId", "expiresAt");
