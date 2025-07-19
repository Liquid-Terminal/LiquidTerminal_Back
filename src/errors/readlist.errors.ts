// Base error class for read lists
export class ReadListError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'READLIST_ERROR') {
    super(message);
    this.name = 'ReadListError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ReadList Errors
export class ReadListNotFoundError extends ReadListError {
  constructor(message: string = 'Read list not found') {
    super(message, 404, 'READLIST_NOT_FOUND');
  }
}

export class ReadListAlreadyExistsError extends ReadListError {
  constructor(message: string = 'Read list with this name already exists for this user') {
    super(message, 400, 'READLIST_ALREADY_EXISTS');
  }
}

export class ReadListValidationError extends ReadListError {
  constructor(message: string = 'Invalid read list data') {
    super(message, 400, 'READLIST_VALIDATION_ERROR');
  }
}

export class ReadListPermissionError extends ReadListError {
  constructor(message: string = 'You do not have permission to access this read list') {
    super(message, 403, 'READLIST_PERMISSION_DENIED');
  }
}

// ReadListItem Errors
export class ReadListItemError extends ReadListError {
  constructor(message: string, statusCode: number = 500, code: string = 'READLIST_ITEM_ERROR') {
    super(message, statusCode, code);
    this.name = 'ReadListItemError';
  }
}

export class ReadListItemNotFoundError extends ReadListItemError {
  constructor(message: string = 'Read list item not found') {
    super(message, 404, 'READLIST_ITEM_NOT_FOUND');
  }
}

export class ReadListItemAlreadyExistsError extends ReadListItemError {
  constructor(message: string = 'Resource is already in this read list') {
    super(message, 400, 'READLIST_ITEM_ALREADY_EXISTS');
  }
}

export class ReadListItemValidationError extends ReadListItemError {
  constructor(message: string = 'Invalid read list item data') {
    super(message, 400, 'READLIST_ITEM_VALIDATION_ERROR');
  }
}

// Resource related errors
export class ReadListResourceNotFoundError extends ReadListError {
  constructor(message: string = 'Educational resource not found') {
    super(message, 404, 'READLIST_RESOURCE_NOT_FOUND');
  }
}

// Authorization Errors
export class ReadListUnauthorizedError extends ReadListError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'READLIST_UNAUTHORIZED');
  }
} 