-- Elysium (L2 testnet settled on HyperEVM) ingestion tables.
-- Purely additive: new tables and indexes only, nothing existing is altered.
-- Rows are written by ElysiumIngestionService with idempotent upserts and read
-- by the /elysium/analytics routes.

-- CreateTable
CREATE TABLE "elysium_tx" (
    "tx_hash" VARCHAR(66) NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_time" TIMESTAMPTZ(3) NOT NULL,
    "from_addr" VARCHAR(42) NOT NULL,
    "to_addr" VARCHAR(42),
    "contract_address" VARCHAR(42),
    "method_id" VARCHAR(10),
    "tx_type" VARCHAR(6),
    "gas_used" BIGINT NOT NULL,
    "fee_wei" DECIMAL(38,0) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "is_spam" BOOLEAN NOT NULL,

    CONSTRAINT "elysium_tx_pkey" PRIMARY KEY ("tx_hash")
);

-- CreateTable
CREATE TABLE "elysium_contract" (
    "address" VARCHAR(42) NOT NULL,
    "deployer" VARCHAR(42) NOT NULL,
    "deploy_tx" VARCHAR(66) NOT NULL,
    "deployed_at" TIMESTAMPTZ(3) NOT NULL,
    "block_number" BIGINT NOT NULL,

    CONSTRAINT "elysium_contract_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "elysium_address_day" (
    "address" VARCHAR(42) NOT NULL,
    "day" DATE NOT NULL,
    "tx_count" INTEGER NOT NULL,

    CONSTRAINT "elysium_address_day_pkey" PRIMARY KEY ("address","day")
);

-- CreateTable
CREATE TABLE "elysium_address" (
    "address" VARCHAR(42) NOT NULL,
    "first_seen" TIMESTAMPTZ(3) NOT NULL,
    "first_day" DATE NOT NULL,

    CONSTRAINT "elysium_address_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "elysium_bridge_transfer" (
    "transfer_id" VARCHAR(80) NOT NULL,
    "direction" VARCHAR(16) NOT NULL,
    "asset" VARCHAR(16) NOT NULL,
    "route" VARCHAR(16) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "symbol" VARCHAR(64),
    "decimals" INTEGER,
    "from_addr" VARCHAR(42),
    "to_addr" VARCHAR(42),
    "amount" DECIMAL(96,18),
    "l1_tx_hash" VARCHAR(66),
    "l2_tx_hash" VARCHAR(66),
    "initiated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "duration_s" DOUBLE PRECISION,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elysium_bridge_transfer_pkey" PRIMARY KEY ("transfer_id")
);

-- CreateTable
CREATE TABLE "elysium_token" (
    "address" VARCHAR(42) NOT NULL,
    "standard" VARCHAR(16) NOT NULL,
    "name" VARCHAR(256),
    "symbol" VARCHAR(128),
    "decimals" INTEGER,
    "origin" VARCHAR(16),
    "first_seen" TIMESTAMPTZ(3),
    "transfer_count" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elysium_token_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "elysium_ingest_state" (
    "stream" VARCHAR(32) NOT NULL,
    "cursor" TIMESTAMPTZ(3),
    "rows" BIGINT NOT NULL DEFAULT 0,
    "backfill_done" BOOLEAN NOT NULL DEFAULT false,
    "last_error" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elysium_ingest_state_pkey" PRIMARY KEY ("stream")
);

-- CreateIndex
CREATE INDEX "elysium_tx_block_time_idx" ON "elysium_tx"("block_time");

-- CreateIndex
CREATE INDEX "elysium_tx_to_addr_block_time_idx" ON "elysium_tx"("to_addr", "block_time");

-- CreateIndex
CREATE INDEX "elysium_tx_from_addr_block_time_idx" ON "elysium_tx"("from_addr", "block_time");

-- CreateIndex
CREATE INDEX "elysium_tx_contract_address_idx" ON "elysium_tx"("contract_address");

-- CreateIndex
CREATE INDEX "elysium_contract_deployed_at_idx" ON "elysium_contract"("deployed_at");

-- CreateIndex
CREATE INDEX "elysium_contract_deployer_deployed_at_idx" ON "elysium_contract"("deployer", "deployed_at");

-- CreateIndex
CREATE INDEX "elysium_address_day_day_idx" ON "elysium_address_day"("day");

-- CreateIndex
CREATE INDEX "elysium_address_first_day_idx" ON "elysium_address"("first_day");

-- CreateIndex
CREATE INDEX "elysium_bridge_transfer_initiated_at_idx" ON "elysium_bridge_transfer"("initiated_at");

-- CreateIndex
CREATE INDEX "elysium_bridge_transfer_direction_initiated_at_idx" ON "elysium_bridge_transfer"("direction", "initiated_at");

-- CreateIndex
CREATE INDEX "elysium_bridge_transfer_from_addr_initiated_at_idx" ON "elysium_bridge_transfer"("from_addr", "initiated_at");
