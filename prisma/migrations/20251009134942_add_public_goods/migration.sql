-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DevelopmentStatus" AS ENUM ('IDEA', 'DEVELOPMENT', 'BETA', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "TeamSize" AS ENUM ('SOLO', 'SMALL', 'LARGE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'EXPERT');

-- CreateEnum
CREATE TYPE "SupportType" AS ENUM ('PROMOTION', 'SERVICES', 'FUNDING');

-- CreateEnum
CREATE TYPE "BudgetRange" AS ENUM ('RANGE_0_5K', 'RANGE_5_15K', 'RANGE_15_30K', 'RANGE_30_50K', 'RANGE_50K_PLUS');

-- CreateEnum
CREATE TYPE "Timeline" AS ENUM ('THREE_MONTHS', 'SIX_MONTHS', 'TWELVE_MONTHS');

-- CreateTable
CREATE TABLE "public_goods" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "demoUrl" TEXT,
    "websiteUrl" TEXT,
    "category" TEXT NOT NULL,
    "discordContact" TEXT,
    "telegramContact" TEXT,
    "logo" TEXT,
    "banner" TEXT,
    "screenshots" TEXT[],
    "problemSolved" TEXT NOT NULL,
    "targetUsers" TEXT[],
    "hlIntegration" TEXT NOT NULL,
    "developmentStatus" "DevelopmentStatus" NOT NULL,
    "leadDeveloperName" TEXT NOT NULL,
    "leadDeveloperContact" TEXT NOT NULL,
    "teamSize" "TeamSize" NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "technologies" TEXT[],
    "supportTypes" "SupportType"[],
    "budgetRange" "BudgetRange",
    "timeline" "Timeline",
    "status" "ProjectStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" INTEGER,
    "reviewNotes" TEXT,
    "submitterId" INTEGER NOT NULL,

    CONSTRAINT "public_goods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_goods_status_idx" ON "public_goods"("status");

-- CreateIndex
CREATE INDEX "public_goods_category_idx" ON "public_goods"("category");

-- CreateIndex
CREATE INDEX "public_goods_submitterId_idx" ON "public_goods"("submitterId");

-- CreateIndex
CREATE INDEX "public_goods_developmentStatus_idx" ON "public_goods"("developmentStatus");

-- AddForeignKey
ALTER TABLE "public_goods" ADD CONSTRAINT "public_goods_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_goods" ADD CONSTRAINT "public_goods_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
