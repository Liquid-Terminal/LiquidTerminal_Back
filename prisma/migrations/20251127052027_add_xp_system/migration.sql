-- CreateEnum
CREATE TYPE "public"."XpActionType" AS ENUM ('REGISTRATION', 'DAILY_LOGIN', 'LOGIN_STREAK_7', 'LOGIN_STREAK_30', 'REFERRAL_SUCCESS', 'CREATE_EDUCATIONAL_CATEGORY', 'ADD_EDUCATIONAL_RESOURCE', 'CREATE_READLIST', 'MARK_RESOURCE_READ', 'COPY_PUBLIC_READLIST', 'CREATE_WALLETLIST', 'ADD_WALLET_TO_LIST', 'SUBMIT_PUBLIC_GOOD', 'PUBLIC_GOOD_APPROVED', 'ADMIN_BONUS', 'ADMIN_PENALTY');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "lastLoginAt" TIMESTAMP(6),
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "loginStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalXp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."xp_transactions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "actionType" "public"."XpActionType" NOT NULL,
    "xpAmount" INTEGER NOT NULL,
    "referenceId" VARCHAR(255),
    "description" VARCHAR(255),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_transactions_userId_idx" ON "public"."xp_transactions"("userId");

-- CreateIndex
CREATE INDEX "xp_transactions_actionType_idx" ON "public"."xp_transactions"("actionType");

-- CreateIndex
CREATE INDEX "xp_transactions_createdAt_idx" ON "public"."xp_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "xp_transactions_userId_actionType_referenceId_key" ON "public"."xp_transactions"("userId", "actionType", "referenceId");

-- CreateIndex
CREATE INDEX "User_totalXp_idx" ON "public"."User"("totalXp");

-- CreateIndex
CREATE INDEX "User_level_idx" ON "public"."User"("level");

-- AddForeignKey
ALTER TABLE "public"."xp_transactions" ADD CONSTRAINT "xp_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
