/*
  Warnings:

  - Added the required column `updatedAt` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
