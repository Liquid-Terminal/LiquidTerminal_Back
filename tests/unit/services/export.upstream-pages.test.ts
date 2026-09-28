/**
 * The export stream reports each page read from the paid upstream, so the
 * route can tell a cheap cancel from one that already spent real credits.
 * Local (DB-backed) datasets cost nothing and are never counted.
 */
const mockFetchPage = jest.fn();
jest.mock('../../../src/clients/hypedexer/rest/export/export-passthrough.client', () => ({
  ExportPassthroughClient: { getInstance: () => ({ fetchPage: mockFetchPage }) },
}));
jest.mock('../../../src/utils/logDeduplicator', () => ({
  logDeduplicator: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ExportService } from '../../../src/services/export/export.service';
import { getExportDataset, type ExportDataset } from '../../../src/services/export/export.manifest';
import { EXPORT_PAGE_SIZE } from '../../../src/constants/export.constants';

const fullPage = (n: number) => ({
  rows: Array.from({ length: n }, (_, i) => ({ tid: i, coin: 'BTC' })),
  nextCursor: null,
  hasMore: null,
  totalCount: null,
});

async function drain(stream: AsyncGenerator<string, unknown, void>, stopAfter = Infinity): Promise<number> {
  let chunks = 0;
  for await (const _chunk of stream) {
    chunks += 1;
    if (chunks >= stopAfter) break;
  }
  return chunks;
}

describe('ExportService.streamCsv upstream page count', () => {
  const dataset = getExportDataset('perp-fills') as ExportDataset;

  beforeEach(() => mockFetchPage.mockReset());

  it('reports every upstream page it reads', async () => {
    mockFetchPage
      .mockResolvedValueOnce(fullPage(EXPORT_PAGE_SIZE))
      .mockResolvedValueOnce(fullPage(EXPORT_PAGE_SIZE))
      .mockResolvedValueOnce(fullPage(10));
    const onPage = jest.fn();

    const chunks = await drain(ExportService.getInstance().streamCsv(dataset, {}, undefined, onPage));

    expect(onPage).toHaveBeenCalledTimes(3);
    expect(chunks).toBe(1 + 2 * EXPORT_PAGE_SIZE + 10);
  });

  it('has only counted the pages read so far when the consumer stops early', async () => {
    mockFetchPage.mockResolvedValue(fullPage(EXPORT_PAGE_SIZE));
    const onPage = jest.fn();

    // Header + the first page, then the client goes away.
    await drain(ExportService.getInstance().streamCsv(dataset, {}, undefined, onPage), 1 + EXPORT_PAGE_SIZE);

    expect(onPage).toHaveBeenCalledTimes(1);
    expect(mockFetchPage).toHaveBeenCalledTimes(1);
  });

  it('does not count pages of a local dataset', async () => {
    const local = { ...dataset, id: 'local-test', source: 'local' as const };
    const onPage = jest.fn();
    // No resolver registered for this id: the stream fails on page 1, before any count.
    await expect(drain(ExportService.getInstance().streamCsv(local, {}, undefined, onPage))).rejects.toThrow(
      'No local resolver registered'
    );
    expect(onPage).not.toHaveBeenCalled();
    expect(mockFetchPage).not.toHaveBeenCalled();
  });
});
