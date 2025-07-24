-- AlterTable
ALTER TABLE "EducationalResource" ADD COLUMN     "linkPreviewId" TEXT;

-- CreateTable
CREATE TABLE "link_previews" (
    "id" TEXT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "title" VARCHAR(255),
    "description" VARCHAR(500),
    "image" VARCHAR(500),
    "siteName" VARCHAR(100),
    "favicon" VARCHAR(500),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_previews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_previews_url_key" ON "link_previews"("url");

-- AddForeignKey
ALTER TABLE "EducationalResource" ADD CONSTRAINT "EducationalResource_linkPreviewId_fkey" FOREIGN KEY ("linkPreviewId") REFERENCES "link_previews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
