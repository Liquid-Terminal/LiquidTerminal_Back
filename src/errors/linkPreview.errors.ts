export class LinkPreviewError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'LINK_PREVIEW_ERROR') {
    super(message);
    this.name = 'LinkPreviewError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class LinkPreviewNotFoundError extends LinkPreviewError {
  constructor(message: string = 'Aperçu de lien non trouvé') {
    super(message, 404, 'LINK_PREVIEW_NOT_FOUND');
  }
}

export class LinkPreviewAlreadyExistsError extends LinkPreviewError {
  constructor(message: string = 'Un aperçu pour cette URL existe déjà') {
    super(message, 409, 'LINK_PREVIEW_ALREADY_EXISTS');
  }
}

export class LinkPreviewValidationError extends LinkPreviewError {
  constructor(message: string = 'Données d\'aperçu invalides') {
    super(message, 400, 'LINK_PREVIEW_VALIDATION_ERROR');
  }
}

export class LinkPreviewFetchError extends LinkPreviewError {
  constructor(message: string = 'Erreur lors de la récupération de l\'aperçu') {
    super(message, 422, 'LINK_PREVIEW_FETCH_ERROR');
  }
}

export class LinkPreviewTimeoutError extends LinkPreviewError {
  constructor(message: string = 'Timeout lors de la récupération de l\'aperçu') {
    super(message, 408, 'LINK_PREVIEW_TIMEOUT');
  }
}

export class LinkPreviewRateLimitError extends LinkPreviewError {
  constructor(message: string = 'Limite de taux dépassée pour la récupération d\'aperçus') {
    super(message, 429, 'LINK_PREVIEW_RATE_LIMIT');
  }
} 