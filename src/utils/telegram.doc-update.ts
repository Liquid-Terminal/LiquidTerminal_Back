import { escapeHtml, renderAlertMessage } from './alert-message';

export interface UpdatedPage {
  relPath: string;
  pageUrl: string;
  oldContent?: string | null;
  newContent?: string;
}

/** "for-developers/api/exchange-endpoint" → "For developers › API › Exchange endpoint". */
export function docPageTitle(relPath: string): string {
  const ACRONYMS: Record<string, string> = { api: 'API', evm: 'EVM', hip: 'HIP', hlp: 'HLP', usdc: 'USDC', tpsl: 'TP/SL', twap: 'TWAP' };
  return relPath
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      const words = seg.split('-').map((w) => ACRONYMS[w.toLowerCase()] ?? w);
      const first = words[0] ?? '';
      words[0] = first === first.toUpperCase() ? first : first.charAt(0).toUpperCase() + first.slice(1);
      return words.join(' ');
    })
    .join(' › ');
}

/** Doc alert in the shared alert message shape (utils/alert-message). */
export function formatDocUpdateTelegramMessage(pages: UpdatedPage[]): string {
  const MAX_TOTAL = 3500;
  const sections: string[] = [];
  let totalLen = 300;

  for (const page of pages.slice(0, 10)) {
    let section = `📄 <a href="${page.pageUrl}"><b>${escapeHtml(docPageTitle(page.relPath))}</b></a>`;
    if (page.oldContent != null && page.newContent != null) {
      const diff = computeLineDiff(page.oldContent, page.newContent);
      const diffText = formatDiffLines(diff.added, diff.removed);
      section += diffText ? '\n' + diffText : '\n<i>Formatting or small wording changes</i>';
    } else if (page.oldContent == null) {
      section += '\n<i>Changed (no earlier copy to compare)</i>';
    }
    if (totalLen + section.length + 2 > MAX_TOTAL) break;
    sections.push(section);
    totalLen += section.length + 2;
  }

  const hidden = pages.length - sections.length;
  return renderAlertMessage({
    icon: '📚',
    headline: `Hyperliquid docs changed · ${pages.length === 1 ? '1 page' : `${pages.length} pages`}`,
    lines: [sections.join('\n\n'), hidden > 0 ? `<i>…and ${hidden} more page${hidden > 1 ? 's' : ''}</i>` : null],
    links: [{ label: 'Hyperliquid docs', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs' }],
    note: 'Lines added ➕ and removed ➖. Turn doc alerts off from 📚 Doc alerts in the bot menu.',
    manageUrl: null,
  });
}

function formatDiffLines(added: string[], removed: string[]): string {
  const lines: string[] = [];
  for (const l of added.slice(0, 4)) lines.push(`➕ ${escapeHtml(truncateLine(l))}`);
  if (added.length > 4) lines.push(`<i>+${added.length - 4} more added</i>`);
  for (const l of removed.slice(0, 2)) lines.push(`➖ ${escapeHtml(truncateLine(l))}`);
  if (removed.length > 2) lines.push(`<i>+${removed.length - 2} more removed</i>`);
  return lines.join('\n');
}

function computeLineDiff(oldContent: string, newContent: string): { added: string[]; removed: string[] } {
  const normalize = (content: string): Set<string> =>
    new Set(
      content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length >= 20 && !/^[#\-=*|> ]+$/.test(l) && !/^\|[-|: ]+\|$/.test(l))
    );

  const oldLines = normalize(oldContent);
  const newLines = normalize(newContent);

  const added = [...newLines].filter(l => !oldLines.has(l));
  const removed = [...oldLines].filter(l => !newLines.has(l));

  return { added, removed };
}

function truncateLine(line: string, max = 90): string {
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}


