/**
 * Wallet Event Types for LiquidTerminal
 * Defines types for the HypeDexer completed trades list (GET /completed-trades/)
 * and the normalized internal CompletedTrade format sent to the Telegram bot via /ws
 */

// ============================================================================
// HYPEDEXER EXTERNAL TYPES (GET /completed-trades/)
// ============================================================================

/**
 * Raw completed trade (a position opened then fully closed) from HypeDexer REST.
 * Times are ISO strings without a zone designator, in UTC.
 */
export interface HypeDexerCompletedTrade {
  user: string;
  coin: string;
  direction: 'long' | 'short';
  start_time: string;
  end_time: string;
  duration_s: number;
  entry_price: number;
  exit_price: number;
  size_close: number;
  pnl_realized: number;
  leverage_type: string;
  position_value: number;
  total_fills: number;
  total_fees: number;
  avg_fill_price: number;
  first_fill_time: string;
  last_fill_time: string;
  total_volume: number;
  trade_id: string;      // Used as eventId for deduplication
  close_hash: string;
  created_at: string;
}

// ============================================================================
// INTERNAL NORMALIZED TYPE (sent to bot via /ws)
// ============================================================================

/**
 * Normalized completed trade — camelCase, user always lowercase
 * Sent to Telegram bot via InternalWebSocketServer.broadcastWalletEvent()
 */
export interface CompletedTrade {
  tradeId: string;
  user: string;           // Always lowercase
  coin: string;
  direction: 'long' | 'short';
  pnlRealized: number;
  pnlPercentage: number;
  positionValue: number;
  entryPrice: number;
  exitPrice: number;
  totalFees: number;
  totalVolume: number;
  durationSeconds: number;
  endTime: string;
  closeHash: string;
}
