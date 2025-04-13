export class WalletError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'WALLET_ERROR') {
    super(message);
    this.name = 'WalletError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class WalletNotFoundError extends WalletError {
  constructor(message: string = 'Wallet not found') {
    super(message, 404, 'WALLET_NOT_FOUND');
  }
}

export class WalletAlreadyExistsError extends WalletError {
  constructor(message: string = 'Wallet already exists') {
    super(message, 400, 'WALLET_ALREADY_EXISTS');
  }
}

export class InvalidWalletAddressError extends WalletError {
  constructor(message: string = 'Invalid wallet address') {
    super(message, 400, 'INVALID_WALLET_ADDRESS');
  }
}

export class UserNotFoundError extends WalletError {
  constructor(message: string = 'User not found') {
    super(message, 404, 'USER_NOT_FOUND');
  }
} 