/**
 * Classe de base pour les erreurs du module perp
 */
export class PerpError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'PERP_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Erreur lors de la récupération des données de marché
 */
export class PerpMarketDataError extends PerpError {
  constructor(message: string = 'Failed to fetch perp market data') {
    super(message, 500, 'PERP_MARKET_DATA_ERROR');
  }
}

/**
 * Erreur lors de la récupération des statistiques globales
 */
export class PerpGlobalStatsError extends PerpError {
  constructor(message: string = 'Failed to fetch perp global stats') {
    super(message, 500, 'PERP_GLOBAL_STATS_ERROR');
  }
}

/**
 * Erreur lors de la récupération des tokens tendance
 */
export class PerpTrendingError extends PerpError {
  constructor(message: string = 'Failed to fetch trending perp tokens') {
    super(message, 500, 'PERP_TRENDING_ERROR');
  }
}

/**
 * Erreur de timeout lors de l'appel à l'API externe
 */
export class PerpTimeoutError extends PerpError {
  constructor(message: string = 'The request to external API timed out') {
    super(message, 504, 'PERP_TIMEOUT_ERROR');
  }
}

/**
 * Erreur lors du traitement des données de cache
 */
export class PerpCacheError extends PerpError {
  constructor(message: string = 'Error processing cache data') {
    super(message, 500, 'PERP_CACHE_ERROR');
  }
} 