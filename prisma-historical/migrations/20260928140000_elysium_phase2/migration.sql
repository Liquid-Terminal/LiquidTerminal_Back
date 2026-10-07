-- Elysium phase 2: DEX pools/swaps, method signatures, token holder snapshots.
-- Purely additive: new tables and indexes only, nothing existing is altered.

-- CreateTable
CREATE TABLE "elysium_dex_pool" (
    "pool" VARCHAR(42) NOT NULL,
    "factory" VARCHAR(42) NOT NULL,
    "version" VARCHAR(4) NOT NULL,
    "token0" VARCHAR(42) NOT NULL,
    "token1" VARCHAR(42) NOT NULL,
    "fee" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "block_number" BIGINT NOT NULL,
    "tx_hash" VARCHAR(66) NOT NULL,

    CONSTRAINT "elysium_dex_pool_pkey" PRIMARY KEY ("pool")
);

-- CreateTable
CREATE TABLE "elysium_dex_swap" (
    "tx_hash" VARCHAR(66) NOT NULL,
    "log_index" INTEGER NOT NULL,
    "pool" VARCHAR(42) NOT NULL,
    "version" VARCHAR(4) NOT NULL,
    "block_time" TIMESTAMPTZ(3) NOT NULL,
    "block_number" BIGINT NOT NULL,
    "sender" VARCHAR(42) NOT NULL,
    "recipient" VARCHAR(42) NOT NULL,
    "amount0" DECIMAL(80,0) NOT NULL,
    "amount1" DECIMAL(80,0) NOT NULL,

    CONSTRAINT "elysium_dex_swap_pkey" PRIMARY KEY ("tx_hash","log_index")
);

-- CreateTable
CREATE TABLE "elysium_method_sig" (
    "method_id" VARCHAR(10) NOT NULL,
    "signature" TEXT,
    "candidates" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(32) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elysium_method_sig_pkey" PRIMARY KEY ("method_id")
);

-- CreateTable
CREATE TABLE "elysium_token_stat" (
    "address" VARCHAR(42) NOT NULL,
    "holders" INTEGER NOT NULL,
    "total_supply" DECIMAL(96,18),
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elysium_token_stat_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE INDEX "elysium_dex_pool_created_at_idx" ON "elysium_dex_pool"("created_at");

-- CreateIndex
CREATE INDEX "elysium_dex_pool_factory_idx" ON "elysium_dex_pool"("factory");

-- CreateIndex
CREATE INDEX "elysium_dex_swap_block_time_idx" ON "elysium_dex_swap"("block_time");

-- CreateIndex
CREATE INDEX "elysium_dex_swap_pool_block_time_idx" ON "elysium_dex_swap"("pool", "block_time");
