import { z } from 'zod';

const optionalString = z.string().max(256).optional();
const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const optionalEth = ethAddress.optional();
/** Rows are billed upstream: bound every page. The front reads up to 5 000
 * summaries or snapshots, and up to 10 000 ledger rows through "Load more". */
const limitUpTo = (max: number) => z.coerce.number().int().min(1).max(max).optional();

const vaultTimeOptional = {
  startTime: optionalString,
  endTime: optionalString,
  limit: limitUpTo(5000),
};

export const vaultsDetailsQuerySchema = z.object({
  query: z.object({
    vaultAddress: ethAddress,
    ...vaultTimeOptional,
  }),
  params: z.object({}),
});

export const vaultsSummariesQuerySchema = z.object({
  query: z.object({
    includeClosed: z.coerce.boolean().optional(),
    limit: limitUpTo(5000),
  }),
  params: z.object({}),
});

export const vaultsUserEquitiesQuerySchema = z.object({
  query: z.object({
    user: ethAddress,
    ...vaultTimeOptional,
  }),
  params: z.object({}),
});

export const vaultsDailySnapshotsQuerySchema = z.object({
  query: z.object({
    vaultAddress: ethAddress,
    ...vaultTimeOptional,
  }),
  params: z.object({}),
});

export const vaultsEquitySnapshotsQuerySchema = z.object({
  query: z.object({
    vaultAddress: ethAddress,
    ...vaultTimeOptional,
  }),
  params: z.object({}),
});

export const vaultsLedgerQuerySchema = z.object({
  query: z.object({
    vaultAddress: ethAddress,
    user: optionalEth,
    ...vaultTimeOptional,
    limit: limitUpTo(10000),
  }),
  params: z.object({}),
});

const leaderboardWindow = z.enum(['24h', '7d']).optional();
const leaderboardLimit = z.coerce.number().int().min(1).max(50).optional();

export const vaultsLeaderboardFollowersQuerySchema = z.object({
  query: z.object({
    window: leaderboardWindow,
    limit: leaderboardLimit,
  }),
  params: z.object({}),
});

export const vaultsLeaderboardOutflowsQuerySchema = z.object({
  query: z.object({
    window: leaderboardWindow,
    limit: leaderboardLimit,
  }),
  params: z.object({}),
});
