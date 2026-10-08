import { DefiLlamaChainOverview, DefiLlamaFeeRank } from '../../types/defillama.types';

/** Substring that identifies the Hyperliquid rows of the overview. */
const HYPERLIQUID_MATCH = 'Hyperliquid';

/**
 * Hyperliquid's place among every protocol of a fee overview, by 24h fees.
 *
 * The overview lists several "Hyperliquid" rows (perps, spot, the HLP vault
 * line among them). The one that carries the venue is the largest by 24h fees,
 * so the name-matched row with the most fees is kept. The rank is one plus the
 * number of protocols with strictly more 24h fees: ties share the lower rank.
 * Null when no Hyperliquid row carries a 24h figure.
 */
export function rankHyperliquidFees(overview: DefiLlamaChainOverview | null | undefined): DefiLlamaFeeRank | null {
  const protocols = Array.isArray(overview?.protocols) ? overview.protocols : [];
  const fees24h = (total: unknown): number | null =>
    typeof total === 'number' && Number.isFinite(total) ? total : null;

  let name: string | null = null;
  let hlFees = -Infinity;
  for (const p of protocols) {
    if (typeof p?.name !== 'string' || !p.name.includes(HYPERLIQUID_MATCH)) continue;
    const value = fees24h(p.total24h);
    if (value !== null && value > hlFees) {
      hlFees = value;
      name = p.name;
    }
  }
  if (name === null) return null;

  let greater = 0;
  for (const p of protocols) {
    const value = fees24h(p?.total24h);
    if (value !== null && value > hlFees) greater++;
  }
  return { rank: greater + 1, protocolCount: protocols.length, hlFees24h: hlFees, name };
}
