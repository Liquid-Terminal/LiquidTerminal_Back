-- CreateEnum
CREATE TYPE "ContributorType" AS ENUM ('DEVELOPERS', 'DESIGNERS', 'MARKETING_COMMUNITY', 'TECHNICAL_WRITERS', 'QA_TESTERS');

-- AlterEnum
ALTER TYPE "SupportType" ADD VALUE 'CONTRIBUTOR';

-- AlterTable
ALTER TABLE "public_goods" ADD COLUMN     "contributorTypes" "ContributorType"[];
