// Base error class for wallet lists
export class WalletListError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'WALLETLIST_ERROR') {
    super(message);
    this.name = 'WalletListError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// WalletList Errors
export class WalletListNotFoundError extends WalletListError {
  constructor(message: string = 'Wallet list not found') {
    super(message, 404, 'WALLETLIST_NOT_FOUND');
  }
}

export class WalletListAlreadyExistsError extends WalletListError {
  constructor(message: string = 'Wallet list with this name already exists for this user') {
    super(message, 400, 'WALLETLIST_ALREADY_EXISTS');
  }
}

export class WalletListValidationError extends WalletListError {
  constructor(message: string = 'Invalid wallet list data') {
    super(message, 400, 'WALLETLIST_VALIDATION_ERROR');
  }
}

export class WalletListPermissionError extends WalletListError {
  constructor(message: string = 'You do not have permission to access this wallet list') {
    super(message, 403, 'WALLETLIST_PERMISSION_DENIED');
  }
}

// WalletListItem Errors
export class WalletListItemError extends WalletListError {
  constructor(message: string, statusCode: number = 500, code: string = 'WALLETLIST_ITEM_ERROR') {
    super(message, statusCode, code);
    this.name = 'WalletListItemError';
  }
}

export class WalletListItemNotFoundError extends WalletListItemError {
  constructor(message: string = 'Wallet list item not found') {
    super(message, 404, 'WALLETLIST_ITEM_NOT_FOUND');
  }
}

export class WalletListItemAlreadyExistsError extends WalletListItemError {
  constructor(message: string = 'UserWallet is already in this wallet list') {
    super(message, 400, 'WALLETLIST_ITEM_ALREADY_EXISTS');
  }
}

export class WalletListItemValidationError extends WalletListItemError {
  constructor(message: string = 'Invalid wallet list item data') {
    super(message, 400, 'WALLETLIST_ITEM_VALIDATION_ERROR');
  }
}

// UserWallet related errors
export class WalletListUserWalletNotFoundError extends WalletListError {
  constructor(message: string = 'User wallet not found') {
    super(message, 404, 'WALLETLIST_USER_WALLET_NOT_FOUND');
  }
}

// Authorization Errors
export class WalletListUnauthorizedError extends WalletListError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'WALLETLIST_UNAUTHORIZED');
  }
}
