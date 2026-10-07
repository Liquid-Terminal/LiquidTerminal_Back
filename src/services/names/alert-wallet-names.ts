import { HlNamesClient } from '../../clients/hlnames/hlnames.client';

/**
 * .hl names for the wallets in Telegram alerts. The alert engine asks for a
 * whole batch before delivering (one cached lookup), then the formatters read
 * names synchronously. A slow name service never holds alerts back: past the
 * wait, alerts go out with the short address.
 */

const WAIT_MS = 1_500;
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 5_000;

const names = new Map<string, { name: string | null; at: number }>();

function remember(entries: Record<string, string | null>): void {
  const now = Date.now();
  for (const [address, name] of Object.entries(entries)) {
    names.delete(address);
    names.set(address, { name, at: now });
  }
  // Map keeps insertion order: drop the oldest entries first.
  while (names.size > MAX_ENTRIES) names.delete(names.keys().next().value as string);
}

/** Looks up the names of these wallets (skips the ones known recently). */
export async function prefetchWalletNames(wallets: string[]): Promise<void> {
  const now = Date.now();
  const missing = [...new Set(wallets.map((w) => w.toLowerCase()))].filter((w) => {
    const hit = names.get(w);
    return !hit || now - hit.at > TTL_MS;
  });
  if (!missing.length) return;
  const lookup = HlNamesClient.getInstance().primaryNames(missing).then(remember);
  let timer: NodeJS.Timeout | undefined;
  const wait = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, WAIT_MS);
  });
  await Promise.race([lookup, wait]).catch(() => undefined);
  clearTimeout(timer);
}

/** Primary .hl name of a wallet if it was prefetched, else null. */
export function walletName(wallet: string): string | null {
  return names.get(wallet.toLowerCase())?.name ?? null;
}
