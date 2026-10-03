/**
 * One shape for every Telegram alert (fills, liquidations, market rules,
 * reserve yield, docs), so a user reads them all the same way:
 *
 *   {icon} <b>{headline}</b>          what happened, with the number that matters
 *   <i>{alert name}</i>              which of their alerts fired (when there is one)
 *
 *   {detail lines}                   2 to 4 short facts
 *
 *   {links}                          a · b · c
 *   ━━━━━━━━━━━━━━━━━━━━
 *   Manage alerts · Liquid Terminal  (+ data credit when the data is not ours)
 */

export const SITE = 'https://liquidterminal.xyz';

/** Kept local so this module has no import cycle with telegram.formatting. */
export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RULE = '━━━━━━━━━━━━━━━━━━━━';

export interface AlertLink {
  label: string;
  url: string;
}

export interface AlertMessage {
  icon: string;
  /** Plain text or trusted HTML built by the caller (escape user data first). */
  headline: string;
  /** Name of the user's alert that matched; escaped here. */
  alertName?: string | null;
  /** Detail lines, trusted HTML. Empty entries are dropped. */
  lines: (string | null | undefined | false)[];
  links?: AlertLink[];
  /** Short credit for third-party data, e.g. "HypeDexer". */
  dataCredit?: { label: string; url: string };
  /** Where "Manage" points (the alerts page by default); null hides it (alerts managed in the bot). */
  manageUrl?: string | null;
  /** Small italic note above the footer rule, e.g. how to turn the alert off. */
  note?: string;
}

export const link = (label: string, url: string): string => `<a href="${url}">${escapeHtml(label)}</a>`;

export function renderAlertMessage(m: AlertMessage): string {
  const out: string[] = [`${m.icon} <b>${m.headline}</b>`];
  // A rule left on its default name repeats the headline: say it once.
  const plain = (t: string) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim().toLowerCase();
  if (m.alertName && plain(m.alertName) !== plain(m.headline)) out.push(`<i>${escapeHtml(m.alertName)}</i>`);
  const lines = m.lines.filter((l): l is string => typeof l === 'string' && l.length > 0);
  if (lines.length) out.push('', ...lines);
  if (m.links?.length) out.push('', m.links.map((l) => link(l.label, l.url)).join(' · '));
  if (m.note) out.push('', `<i>${m.note}</i>`);
  const footer = [
    ...(m.manageUrl === null ? [] : [link('Manage alerts', m.manageUrl ?? `${SITE}/alerts`)]),
    link('Liquid Terminal', SITE),
  ];
  if (m.dataCredit) footer.push(`<i>data ${link(m.dataCredit.label, m.dataCredit.url)}</i>`);
  out.push(RULE, footer.join(' · '));
  return out.join('\n');
}

/** "0x1234…abcd" */
export const shortAddr = (a: string): string => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** "14:03:21 UTC" from an ISO string or epoch ms. */
export function utcTime(t: string | number): string {
  const iso = typeof t === 'number' ? new Date(t).toISOString() : t.endsWith('Z') || t.includes('+') ? new Date(t).toISOString() : `${t}Z`;
  return `${iso.slice(11, 19)} UTC`;
}

export const HYPEDEXER_CREDIT = { label: 'HypeDexer', url: 'https://app.hypedexer.com/' };
