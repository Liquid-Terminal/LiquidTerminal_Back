-- CreateTable
CREATE TABLE "ReadList" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReadList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadListItem" (
    "id" SERIAL NOT NULL,
    "readListId" INTEGER NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "order" INTEGER,

    CONSTRAINT "ReadListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadListItem_readListId_resourceId_key" ON "ReadListItem"("readListId", "resourceId");

-- AddForeignKey
ALTER TABLE "ReadList" ADD CONSTRAINT "ReadList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadListItem" ADD CONSTRAINT "ReadListItem_readListId_fkey" FOREIGN KEY ("readListId") REFERENCES "ReadList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadListItem" ADD CONSTRAINT "ReadListItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "EducationalResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
