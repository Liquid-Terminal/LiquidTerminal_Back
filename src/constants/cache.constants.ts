// Préfixes pour les clés de cache
export const CACHE_PREFIX = {
  PROJECT: 'project',
  CATEGORY: 'category',
  EDUCATIONAL_CATEGORY: 'educational_category',
  EDUCATIONAL_RESOURCE: 'educational_resource',
  READLIST: 'readlist',
  READLIST_ITEM: 'readlist_item',
  LINK_PREVIEW: 'link_preview',
  MARKET: 'market',
  STATS: 'stats',
  WALLET: 'wallet'
} as const;

// Durées de vie par défaut (en secondes)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600 // 1 hour
} as const;

// Clés spécifiques
export const CACHE_KEYS = {
  PROJECT: (id: number) => `${CACHE_PREFIX.PROJECT}:${id}`,
  PROJECT_LIST: (params: string) => `${CACHE_PREFIX.PROJECT}:list:${params}`,
  CATEGORY: (id: number) => `${CACHE_PREFIX.CATEGORY}:${id}`,
  CATEGORY_LIST: (params: string) => `${CACHE_PREFIX.CATEGORY}:list:${params}`,
  EDUCATIONAL_CATEGORY: (id: number) => `${CACHE_PREFIX.EDUCATIONAL_CATEGORY}:${id}`,
  EDUCATIONAL_CATEGORY_LIST: (params: string) => `${CACHE_PREFIX.EDUCATIONAL_CATEGORY}:list:${params}`,
  EDUCATIONAL_RESOURCE: (id: number) => `${CACHE_PREFIX.EDUCATIONAL_RESOURCE}:${id}`,
  EDUCATIONAL_RESOURCE_LIST: (params: string) => `${CACHE_PREFIX.EDUCATIONAL_RESOURCE}:list:${params}`,
  EDUCATIONAL_RESOURCE_BY_CATEGORY: (categoryId: number) => `${CACHE_PREFIX.EDUCATIONAL_RESOURCE}:category:${categoryId}`,
  READLIST: (id: number) => `${CACHE_PREFIX.READLIST}:${id}`,
  READLIST_LIST: (params: string) => `${CACHE_PREFIX.READLIST}:list:${params}`,
  READLIST_BY_USER: (userId: number) => `${CACHE_PREFIX.READLIST}:user:${userId}`,
  READLIST_ITEM: (id: number) => `${CACHE_PREFIX.READLIST_ITEM}:${id}`,
  READLIST_ITEM_LIST: (params: string) => `${CACHE_PREFIX.READLIST_ITEM}:list:${params}`,
  READLIST_ITEMS_BY_LIST: (readListId: number) => `${CACHE_PREFIX.READLIST_ITEM}:list:${readListId}`,
  LINK_PREVIEW: (id: string) => `${CACHE_PREFIX.LINK_PREVIEW}:${id}`,
  LINK_PREVIEW_LIST: (params: string) => `${CACHE_PREFIX.LINK_PREVIEW}:list:${params}`,
  MARKET: (id: string) => `${CACHE_PREFIX.MARKET}:${id}`,
  MARKET_LIST: (params: string) => `${CACHE_PREFIX.MARKET}:list:${params}`,
  STATS: (id: string) => `${CACHE_PREFIX.STATS}:${id}`,
  STATS_LIST: (params: string) => `${CACHE_PREFIX.STATS}:list:${params}`,
  WALLET: (id: number) => `${CACHE_PREFIX.WALLET}:${id}`,
  WALLET_LIST: (params: string) => `${CACHE_PREFIX.WALLET}:list:${params}`
} as const; 