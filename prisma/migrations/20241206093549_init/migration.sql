-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "privyUserId" TEXT NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "addedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(255) NOT NULL,
    "desc" VARCHAR(255) NOT NULL,
    "logo" VARCHAR(255) NOT NULL,
    "twitter" VARCHAR(255),
    "discord" VARCHAR(255),
    "telegram" VARCHAR(255),
    "website" VARCHAR(255),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" SERIAL NOT NULL,
    "addedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resourceId" INTEGER NOT NULL,
    "watchlistId" INTEGER NOT NULL,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Project_title_key" ON "Project"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Project_twitter_key" ON "Project"("twitter");

-- CreateIndex
CREATE UNIQUE INDEX "Project_discord_key" ON "Project"("discord");

-- CreateIndex
CREATE UNIQUE INDEX "Project_telegram_key" ON "Project"("telegram");

-- CreateIndex
CREATE UNIQUE INDEX "Project_website_key" ON "Project"("website");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
