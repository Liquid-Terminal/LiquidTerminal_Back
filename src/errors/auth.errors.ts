export class AuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 401, code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class TokenValidationError extends AuthError {
  constructor(message: string = 'Invalid or expired token') {
    super(message, 401, 'TOKEN_VALIDATION_ERROR');
  }
}

export class UserNotFoundError extends AuthError {
  constructor(message: string = 'User not found') {
    super(message, 404, 'USER_NOT_FOUND');
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 403, 'UNAUTHORIZED');
  }
}

export class JWKSError extends AuthError {
  constructor(message: string = 'Error fetching JWKS') {
    super(message, 500, 'JWKS_ERROR');
  }
}

export class SigningKeyError extends AuthError {
  constructor(message: string = 'Signing key not found') {
    super(message, 500, 'SIGNING_KEY_ERROR');
  }
} 