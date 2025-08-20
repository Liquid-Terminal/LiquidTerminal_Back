-- CreateTable
CREATE TABLE "public"."WalletList" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WalletList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WalletListItem" (
    "id" SERIAL NOT NULL,
    "walletListId" INTEGER NOT NULL,
    "userWalletId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "order" INTEGER,

    CONSTRAINT "WalletListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletListItem_walletListId_userWalletId_key" ON "public"."WalletListItem"("walletListId", "userWalletId");

-- AddForeignKey
ALTER TABLE "public"."WalletList" ADD CONSTRAINT "WalletList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletListItem" ADD CONSTRAINT "WalletListItem_walletListId_fkey" FOREIGN KEY ("walletListId") REFERENCES "public"."WalletList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletListItem" ADD CONSTRAINT "WalletListItem_userWalletId_fkey" FOREIGN KEY ("userWalletId") REFERENCES "public"."UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
