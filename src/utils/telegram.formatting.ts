import { renderAlertMessage, shortAddr, utcTime, SITE, HYPEDEXER_CREDIT } from './alert-message';
import { AggregatedLiquidation } from '../types/liquidations.types';
import { AggregatedFill } from '../types/fill-alerts.types';
import { CompletedTrade } from '../types/wallet-events.types';
import { walletName } from '../services/names/alert-wallet-names';

/**
 * Format a dollar amount in a human-readable way
 */
export function formatAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Format a price in USD
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimeRange(timeRange: [number, number]): string {
  const durationMs = timeRange[1] - timeRange[0];
  const durationSec = Math.round(durationMs / 1000);

  if (durationSec < 60) {
    return `${durationSec}s`;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * How a wallet reads in an alert: the user's own label first, then its .hl
 * name (Hyperliquid Names, when known), then the short address.
 */
function whoIs(wallet: string, label?: string): string {
  const name = walletName(wallet);
  if (label) return `<b>${escapeHtml(label)}</b> ${name ? escapeHtml(name) : shortAddr(wallet)}`;
  return name ? `<b>${escapeHtml(name)}</b>` : shortAddr(wallet);
}

/**
 * Liquidation alert (HTML). The headline says who lost what: a liquidated
 * long is red (longs got wiped), a liquidated short green, as on the site.
 */
export function formatLiquidationAlert(liq: AggregatedLiquidation, alertName?: string | null): string {
  const side = liq.liq_dir === 'Long' ? 'long' : liq.liq_dir === 'Short' ? 'short' : 'position';
  const icon = liq.liq_dir === 'Long' ? '🟥' : liq.liq_dir === 'Short' ? '🟩' : '⚡';
  const agg = liq.aggregation?.isAggregated ? liq.aggregation : null;
  const size = agg ? agg.totalSize : liq.size_total;
  const px = liq.fill_px_vwap ?? liq.mark_px;
  const wallet = liq.liquidated_user.toLowerCase();

  return renderAlertMessage({
    icon,
    headline: `${escapeHtml(liq.coin)} ${side} liquidated · ${formatAmount(liq.notional_total)}`,
    alertName,
    lines: [
      `📉 ${formatSize(size)} ${escapeHtml(liq.coin)} closed at ${formatTokenPrice(px)}${liq.fill_px_vwap != null ? ` · mark ${formatTokenPrice(liq.mark_px)}` : ''}`,
      agg ? `🧩 ${agg.count} liquidations of this wallet in ${formatTimeRange(agg.timeRangeMs)}` : null,
      `👛 <a href="${SITE}/market/tracker/wallet/${wallet}">${whoIs(wallet)}</a> · 🕐 ${utcTime(liq.time)}`,
    ],
    links: [
      { label: 'Transaction', url: `${SITE}/explorer/transaction/${liq.hash}` },
      { label: 'Wallet', url: `${SITE}/explorer/address/${wallet}` },
      { label: 'Liquidations feed', url: `${SITE}/explorer/liquidations` },
    ],
    dataCredit: HYPEDEXER_CREDIT,
  });
}

/**
 * Format a token price with adaptive precision (small prices keep more decimals)
 */
function formatTokenPrice(price: number): string {
  if (!Number.isFinite(price)) return '$0';
  if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(4)}`;
}

/**
 * Shorten an Ethereum address for display (e.g. 0x1234…abcd)
 */
function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Format a fill size with adaptive precision — small sizes keep more decimals
 * so sub-1 amounts aren't rounded away (e.g. 0.0034 instead of 0.003).
 */
function formatSize(sz: number): string {
  if (!Number.isFinite(sz)) return '0';
  const maximumFractionDigits = Math.abs(sz) >= 1 ? 4 : 8;
  return sz.toLocaleString('en-US', { maximumFractionDigits });
}

/**
 * Format a signed PnL value as `+$X` / `-$X` using formatAmount() under the hood
 * (formatAmount always returns a positive `$X` — we just prepend the sign here).
 */
function formatSignedPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '-';
  return `${sign}${formatAmount(Math.abs(pnl))}`;
}

/**
 * Format a duration in milliseconds as a compact `Xs` or `Xm Ys` string.
 * Mirrors `formatTimeRange` used by liquidations.
 */
function formatDurationMs(durationMs: number): string {
  const durationSec = Math.round(durationMs / 1000);
  if (durationSec < 60) return `${durationSec}s`;
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Format a Fill alert message for Telegram (HTML parse mode).
 * Driven by HypeDexer `allFills` (perp) and `fills_spot` (spot) — an executed order.
 */
export interface FillAlertContext {
  /** Name the user gave this wallet in their Liquid Terminal list. */
  walletLabel?: string;
  /** The alert follows a Liquid Terminal list: link the wallet to its tracker page. */
  fromList?: boolean;
}

export function formatFillAlert(
  fill: AggregatedFill,
  subscriptionName: string,
  context: FillAlertContext = {}
): string {
  const isBuy = fill.side === 'B';
  const market = fill.source === 'perp' ? 'perp' : 'spot';
  const walletUrl = context.fromList
    ? `${SITE}/market/tracker/wallet/${fill.wallet}`
    : `${SITE}/explorer/address/${fill.wallet}`;
  const who = whoIs(fill.wallet, context.walletLabel);

  // Several fills of one order: the price is their VWAP over the window.
  const isAggregated = fill.fillCount > 1;
  const fills = isAggregated
    ? ` · ${fill.fillCount} fills${fill.aggregationDurationMs !== undefined ? ` in ${formatDurationMs(fill.aggregationDurationMs)}` : ''}`
    : '';
  const pnl =
    fill.closedPnlTotal !== undefined && fill.closedPnlTotal !== 0
      ? `💰 Realized PnL ${fill.closedPnlTotal > 0 ? '🟢' : '🔴'} <b>${formatSignedPnl(fill.closedPnlTotal)}</b>`
      : null;

  return renderAlertMessage({
    icon: isBuy ? '🟢' : '🔴',
    headline: `${isBuy ? 'Buy' : 'Sell'} ${formatSize(fill.sz)} ${escapeHtml(fill.coin)} · ${formatAmount(fill.notionalUsd)}`,
    alertName: subscriptionName,
    lines: [
      `💵 ${formatTokenPrice(fill.px)}${isAggregated ? ' avg' : ''} · ${market}${fills}${fill.twapId != null ? ' · TWAP' : ''}`,
      fill.source === 'perp' && fill.dir ? `🧭 ${escapeHtml(fill.dir)}` : null,
      pnl,
      `👛 <a href="${walletUrl}">${who}</a> · 🕐 ${utcTime(fill.time)}`,
    ],
    links:
      fill.twapId != null
        ? [{ label: 'Wallet', url: `${SITE}/explorer/address/${fill.wallet}` }]
        : [
            { label: 'Transaction', url: `${SITE}/explorer/transaction/${fill.hash}` },
            { label: 'Wallet', url: `${SITE}/explorer/address/${fill.wallet}` },
          ],
    dataCredit: HYPEDEXER_CREDIT,
  });
}

// ==================== DIGEST LINES ====================
// One line per alert, used when a user is over the per-minute budget and their
// alerts are grouped into a digest message (see AlertEngine).

const walletLink = (wallet: string, label?: string) =>
  `<a href="https://liquidterminal.xyz/market/tracker/wallet/${wallet}">${escapeHtml(label || walletName(wallet) || shortenAddress(wallet))}</a>`;

export function formatFillDigestLine(fill: AggregatedFill, subscriptionName: string, walletLabel?: string): string {
  const side = fill.side === 'B' ? '🟢' : '🔴';
  const what = fill.source === 'perp' && fill.dir ? escapeHtml(fill.dir) : fill.side === 'B' ? 'Buy' : 'Sell';
  const pnl =
    fill.closedPnlTotal !== undefined && fill.closedPnlTotal !== 0 ? ` · PnL ${formatSignedPnl(fill.closedPnlTotal)}` : '';
  return `${side} <b>${escapeHtml(fill.coin)}</b> ${what} ${formatAmount(fill.notionalUsd)}${pnl} · ${walletLink(fill.wallet, walletLabel)} · <i>${escapeHtml(subscriptionName)}</i>`;
}

export function formatLiquidationDigestLine(liq: AggregatedLiquidation): string {
  const dir = liq.liq_dir ? ` ${liq.liq_dir}` : '';
  return `🚨 <b>${escapeHtml(liq.coin)}</b>${dir} liquidated ${formatAmount(liq.notional_total)} · ${walletLink(liq.liquidated_user.toLowerCase())}`;
}

export function formatTradeDigestLine(trade: CompletedTrade, subscriptionName: string): string {
  const icon = trade.pnlRealized >= 0 ? '✅' : '❌';
  return `${icon} <b>${escapeHtml(trade.coin)}</b> ${trade.direction} closed · PnL ${formatSignedPnl(trade.pnlRealized)} on ${formatAmount(trade.positionValue)} · ${walletLink(trade.user)} · <i>${escapeHtml(subscriptionName)}</i>`;
}
