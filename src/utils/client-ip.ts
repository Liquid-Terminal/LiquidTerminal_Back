import { isIP } from 'net';

/**
 * Key for per-client budgets. An IPv6 host usually owns a whole /64 (and can
 * pick any address inside it), so keying on the full address hands one caller
 * 2^64 identities. IPv6 addresses collapse to their /64 prefix; IPv4 and
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`) stay per address.
 */
export function rateLimitKeyForIp(ip: string): string {
  const bare = ip.split('%')[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(bare);
  if (mapped) return mapped[1];
  if (isIP(bare) !== 6) return ip;

  const [head, tail = ''] = bare.toLowerCase().split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = bare.includes('::') && tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups = bare.includes('::')
    ? [...headGroups, ...Array<string>(Math.max(0, missing)).fill('0'), ...tailGroups]
    : headGroups;
  const prefix = groups.slice(0, 4).map((g) => (Number.parseInt(g, 16) || 0).toString(16));
  return `${prefix.join(':')}::/64`;
}
