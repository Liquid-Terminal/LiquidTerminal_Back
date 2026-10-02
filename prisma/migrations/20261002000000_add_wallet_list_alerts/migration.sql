-- CreateTable
CREATE TABLE "WalletListAlert" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletListId" INTEGER NOT NULL,
    "fillSubscriptionId" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletListAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletListAlert_fillSubscriptionId_key" ON "WalletListAlert"("fillSubscriptionId");

-- CreateIndex
CREATE INDEX "WalletListAlert_walletListId_idx" ON "WalletListAlert"("walletListId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletListAlert_userId_walletListId_key" ON "WalletListAlert"("userId", "walletListId");

-- AddForeignKey
ALTER TABLE "WalletListAlert" ADD CONSTRAINT "WalletListAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletListAlert" ADD CONSTRAINT "WalletListAlert_walletListId_fkey" FOREIGN KEY ("walletListId") REFERENCES "WalletList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
