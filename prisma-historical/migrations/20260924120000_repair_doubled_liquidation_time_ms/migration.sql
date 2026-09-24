-- HypeDexer sometimes sent a liquidation's time_ms doubled (around 2083) while
-- its ISO `time` (UTC, second precision) stayed right, so those rows were
-- stored in the future and counted in every "since X" window. Ingestion now
-- repairs them on arrival (reliableLiquidationTimeMs); this repairs the rows
-- already stored, only where halving time_ms agrees with the ISO time.
UPDATE "raw_liquidations"
SET
  "time_ms" = "time_ms" / 2,
  "time" = to_timestamp(("time_ms" / 2) / 1000.0)
WHERE "time" > now() + interval '1 day'
  AND CASE
        WHEN "raw_data"->>'time' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
        THEN abs(("time_ms" / 2) - extract(epoch FROM substr("raw_data"->>'time', 1, 19)::timestamp) * 1000) < 1000
        ELSE false
      END;
