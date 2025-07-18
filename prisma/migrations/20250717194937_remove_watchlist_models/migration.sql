/*
  Warnings:

  - You are about to drop the `Watchlist` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WatchlistItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Watchlist" DROP CONSTRAINT "Watchlist_userId_fkey";

-- DropForeignKey
ALTER TABLE "WatchlistItem" DROP CONSTRAINT "WatchlistItem_resourceId_fkey";

-- DropForeignKey
ALTER TABLE "WatchlistItem" DROP CONSTRAINT "WatchlistItem_watchlistId_fkey";

-- DropTable
DROP TABLE "Watchlist";

-- DropTable
DROP TABLE "WatchlistItem";
