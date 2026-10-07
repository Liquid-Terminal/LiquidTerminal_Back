import { Liquidation, LiquidationResponse } from '../types/liquidations.types';

/**
 * The indexer returns each liquidation as two rows sharing `hash` and
 * `liquidated_user`: the liquidated side (size, notional, fee, direction, no
 * liquidators) and a zero-size row that only carries the liquidators. Shown
 * as is, half the feed reads "$0.00 · 0.0000" with no direction.
 *
 * This folds every zero-size row into the sized row of the same event (union
 * of liquidators) and drops zero-size rows left without one, which happens
 * only when the pair is split across a page boundary.
 */
export function mergeLiquidatorRows(rows: Liquidation[]): Liquidation[] {
  const key = (r: Liquidation) => `${r.hash}:${r.liquidated_user}`;
  const liquidatorsByEvent = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.liquidators?.length) continue;
    const set = liquidatorsByEvent.get(key(r)) ?? new Set<string>();
    for (const l of r.liquidators) set.add(l);
    liquidatorsByEvent.set(key(r), set);
  }

  const out: Liquidation[] = [];
  for (const r of rows) {
    if (!r.size_total && !r.notional_total) continue;
    const liquidators = [...(liquidatorsByEvent.get(key(r)) ?? [])];
    out.push({ ...r, liquidators, liquidator_count: liquidators.length });
  }
  return out;
}

/** Same as {@link mergeLiquidatorRows} on a full API response. */
export function mergeLiquidationResponse(response: LiquidationResponse): LiquidationResponse {
  if (!Array.isArray(response?.data)) return response;
  return { ...response, data: mergeLiquidatorRows(response.data) };
}
