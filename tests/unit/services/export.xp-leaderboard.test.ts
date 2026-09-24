/**
 * The `xp-leaderboard` export ("XP, level and rank") must read the XP ranking;
 * it used to export the Hyperliquid trading leaderboard.
 */
const mockGetLeaderboard = jest.fn();

jest.mock('../../../src/services/xp/xp.service', () => ({
  xpService: { getLeaderboard: mockGetLeaderboard },
}));

import { LOCAL_SOURCES } from '../../../src/services/export/export.local-sources';
import { getExportDataset } from '../../../src/services/export/export.manifest';

describe('xp-leaderboard export', () => {
  it('pages through the XP ranking', async () => {
    mockGetLeaderboard.mockResolvedValue({
      leaderboard: [
        { rank: 101, name: 'alice', totalXp: 900, level: 7 },
        { rank: 102, name: 'bob', totalXp: 880, level: 7 },
      ],
      userRank: undefined,
      total: 250,
    });

    const page = await LOCAL_SOURCES['xp-leaderboard']({ params: {}, limit: 100, page: 2 });

    expect(mockGetLeaderboard).toHaveBeenCalledWith({ limit: 100, page: 2 });
    expect(page).toEqual({
      rows: [
        { rank: 101, name: 'alice', totalXp: 900, level: 7 },
        { rank: 102, name: 'bob', totalXp: 880, level: 7 },
      ],
      totalCount: 250,
      pageable: true,
    });
  });

  it('asks for pages the XP service can serve', () => {
    const dataset = getExportDataset('xp-leaderboard');
    expect(dataset?.pageSize).toBe(100);
    expect(dataset?.publicPath).toBe('/xp/leaderboard');
  });
});
