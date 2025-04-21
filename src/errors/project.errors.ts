export class ProjectError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'PROJECT_ERROR') {
    super(message);
    this.name = 'ProjectError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ProjectNotFoundError extends ProjectError {
  constructor(message: string = 'Project not found') {
    super(message, 404, 'PROJECT_NOT_FOUND');
  }
}

export class ProjectAlreadyExistsError extends ProjectError {
  constructor(message: string = 'Project with this title already exists') {
    super(message, 400, 'PROJECT_ALREADY_EXISTS');
  }
}

export class CategoryError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'CATEGORY_ERROR') {
    super(message);
    this.name = 'CategoryError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class CategoryNotFoundError extends CategoryError {
  constructor(message: string = 'Category not found') {
    super(message, 404, 'CATEGORY_NOT_FOUND');
  }
}

export class CategoryAlreadyExistsError extends CategoryError {
  constructor(message: string = 'Category with this name already exists') {
    super(message, 400, 'CATEGORY_ALREADY_EXISTS');
  }
}

export class ProjectValidationError extends ProjectError {
  constructor(message: string = 'Invalid project data') {
    super(message, 400, 'PROJECT_VALIDATION_ERROR');
  }
}

export class CategoryValidationError extends CategoryError {
  constructor(message: string = 'Invalid category data') {
    super(message, 400, 'CATEGORY_VALIDATION_ERROR');
  }
} 