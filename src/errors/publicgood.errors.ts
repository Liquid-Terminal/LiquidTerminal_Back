export class PublicGoodError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'PUBLIC_GOOD_ERROR') {
    super(message);
    this.name = 'PublicGoodError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class PublicGoodNotFoundError extends PublicGoodError {
  constructor(message: string = 'Public good project not found') {
    super(message, 404, 'PUBLIC_GOOD_NOT_FOUND');
  }
}

export class PublicGoodAlreadyExistsError extends PublicGoodError {
  constructor(message: string = 'Public good project with this name already exists') {
    super(message, 400, 'PUBLIC_GOOD_ALREADY_EXISTS');
  }
}

export class PublicGoodValidationError extends PublicGoodError {
  constructor(message: string = 'Invalid public good data') {
    super(message, 400, 'PUBLIC_GOOD_VALIDATION_ERROR');
  }
}

export class PublicGoodPermissionError extends PublicGoodError {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message, 403, 'PUBLIC_GOOD_PERMISSION_ERROR');
  }
}

