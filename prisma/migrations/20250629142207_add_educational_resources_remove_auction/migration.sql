/*
  Warnings:

  - You are about to drop the `Auction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Auction";

-- CreateTable
CREATE TABLE "EducationalCategory" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "EducationalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalResource" (
    "id" SERIAL NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" INTEGER NOT NULL,

    CONSTRAINT "EducationalResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalResourceCategory" (
    "id" SERIAL NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" INTEGER,

    CONSTRAINT "EducationalResourceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EducationalCategory_name_key" ON "EducationalCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EducationalResourceCategory_resourceId_categoryId_key" ON "EducationalResourceCategory"("resourceId", "categoryId");

-- AddForeignKey
ALTER TABLE "EducationalCategory" ADD CONSTRAINT "EducationalCategory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalResource" ADD CONSTRAINT "EducationalResource_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalResourceCategory" ADD CONSTRAINT "EducationalResourceCategory_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "EducationalResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalResourceCategory" ADD CONSTRAINT "EducationalResourceCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EducationalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationalResourceCategory" ADD CONSTRAINT "EducationalResourceCategory_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
