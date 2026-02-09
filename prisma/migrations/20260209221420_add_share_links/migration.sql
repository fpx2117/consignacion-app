-- CreateEnum
CREATE TYPE "ShareLinkType" AS ENUM ('TICKET', 'REMITO');

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

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_codeHash_key" ON "ShareLink"("codeHash");

-- CreateIndex
CREATE INDEX "ShareLink_type_targetId_idx" ON "ShareLink"("type", "targetId");

-- CreateIndex
CREATE INDEX "ShareLink_expiresAt_idx" ON "ShareLink"("expiresAt");
