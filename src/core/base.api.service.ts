import { logDeduplicator } from '../utils/logDeduplicator';

export abstract class BaseApiService {
    private readonly API_TIMEOUT = 5000; // 5 secondes
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 seconde
  
    constructor(
      protected readonly baseUrl: string,
      protected readonly defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      }
    ) {}
  
    // Méthode principale pour les requêtes avec timeout
    protected async fetchWithTimeout<T>(
      endpoint: string, 
      options: RequestInit
    ): Promise<T> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.API_TIMEOUT);
  
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          signal: controller.signal,
          headers: {
            ...this.defaultHeaders,
            ...options.headers,
          },
        });
  
        if (!response.ok) {
          throw new Error(`API error: ${response.status} - ${await response.text()}`);
        }
  
        return response.json();
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Request timeout');
          }
          throw new Error(`API request failed: ${error.message}`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  
    // Méthode pour gérer les retries
    protected async withRetry<T>(
      operation: () => Promise<T>,
      customRetries?: number,
      customDelay?: number
    ): Promise<T> {
      const maxRetries = customRetries ?? this.MAX_RETRIES;
      const delay = customDelay ?? this.RETRY_DELAY;
      let lastError: Error;
  
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;
          if (i < maxRetries - 1) {
            logDeduplicator.warn('API request retry', {
              attempt: i + 1,
              maxRetries,
              service: this.constructor.name,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            });
            await this.delay(delay * (i + 1));
          }
        }
      }
      
      throw lastError!;
    }
  
    // Méthodes HTTP principales
    public async post<T>(endpoint: string, body: any): Promise<T> {
      return this.withRetry(() => 
        this.fetchWithTimeout<T>(endpoint, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    }
  
    public async get<T>(endpoint: string): Promise<T> {
      return this.withRetry(() => 
        this.fetchWithTimeout<T>(endpoint, {
          method: 'GET',
        })
      );
    }
  
    // Utilitaires
    private delay(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  
    public handleError(error: unknown): never {
      if (error instanceof Error) {
        throw new Error(`${this.constructor.name} error: ${error.message}`);
      }
      throw new Error(`${this.constructor.name} unknown error`);
    }
  }