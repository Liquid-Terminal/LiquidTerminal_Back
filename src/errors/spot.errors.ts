/**
 * Classe de base pour les erreurs du module spot
 */
export class SpotError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'SPOT_ERROR') {
    super(message);
    this.name = 'SpotError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Erreur lors de la récupération des données de marché
 */
export class MarketDataError extends SpotError {
  constructor(message: string = 'Failed to fetch market data') {
    super(message, 500, 'MARKET_DATA_ERROR');
  }
}

/**
 * Erreur lors de la récupération des informations sur un token
 */
export class TokenInfoError extends SpotError {
  constructor(message: string = 'Failed to fetch token information') {
    super(message, 500, 'TOKEN_INFO_ERROR');
  }
}

/**
 * Erreur lorsqu'un token n'est pas trouvé
 */
export class TokenNotFoundError extends SpotError {
  constructor(message: string = 'Token not found') {
    super(message, 404, 'TOKEN_NOT_FOUND');
  }
}

/**
 * Erreur lors de la récupération des données d'enchères
 */
export class AuctionError extends SpotError {
  constructor(message: string = 'Failed to fetch auction data') {
    super(message, 500, 'AUCTION_ERROR');
  }
}

/**
 * Erreur lorsqu'une enchère n'est pas trouvée
 */
export class AuctionNotFoundError extends SpotError {
  constructor(message: string = 'Auction not found') {
    super(message, 404, 'AUCTION_NOT_FOUND');
  }
}

/**
 * Erreur lorsque les données d'enchères sont invalides
 */
export class InvalidAuctionDataError extends SpotError {
  constructor(message: string = 'Invalid auction data') {
    super(message, 400, 'INVALID_AUCTION_DATA');
  }
}

/**
 * Erreur lors de la récupération des données USDC
 */
export class USDCDataError extends SpotError {
  constructor(message: string = 'Failed to fetch USDC data') {
    super(message, 500, 'USDC_DATA_ERROR');
  }
}

/**
 * Erreur de limitation de taux
 */
export class RateLimitError extends SpotError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
} 