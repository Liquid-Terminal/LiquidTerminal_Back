/*
  Warnings:

  - You are about to drop the column `timeline` on the `public_goods` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public_goods" DROP COLUMN "timeline";

-- DropEnum
DROP TYPE "public"."Timeline";
