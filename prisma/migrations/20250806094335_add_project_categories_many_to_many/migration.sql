/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Project` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Project" DROP CONSTRAINT "Project_categoryId_fkey";

-- AlterTable
ALTER TABLE "public"."Project" DROP COLUMN "categoryId";

-- CreateTable
CREATE TABLE "public"."ProjectCategory" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCategory_projectId_categoryId_key" ON "public"."ProjectCategory"("projectId", "categoryId");

-- AddForeignKey
ALTER TABLE "public"."ProjectCategory" ADD CONSTRAINT "ProjectCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectCategory" ADD CONSTRAINT "ProjectCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
