
export class VaultsError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'VAULTS_ERROR') {
    super(message);
    this.name = 'VaultsError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class VaultsTimeoutError extends VaultsError {
  constructor(message: string = 'Vaults request timed out') {
    super(message, 408, 'VAULTS_TIMEOUT');
  }
} 