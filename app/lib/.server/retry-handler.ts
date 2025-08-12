import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('retry-handler');

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrorMessages: string[];
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

class RetryHandler {
  private _config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this._config = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      retryableStatusCodes: [429, 502, 503, 504],
      retryableErrorMessages: [
        'too many requests',
        'rate limit',
        'service unavailable',
        'gateway timeout',
        'bad gateway',
      ],
      ...config,
    };
  }

  private _isRetryableError(error: any): boolean {
    // Check status code
    if (error.statusCode && this._config.retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    // Check error message
    if (error.message) {
      const message = error.message.toLowerCase();
      return this._config.retryableErrorMessages.some((retryableMsg) => message.includes(retryableMsg));
    }

    // Check if it's a fetch error with specific status
    if (error instanceof Response) {
      return this._config.retryableStatusCodes.includes(error.status);
    }

    return false;
  }

  private _calculateDelay(attempt: number): number {
    const delay = this._config.baseDelay * Math.pow(this._config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(delay, this._config.maxDelay);

    /*
     * Add jitter to prevent thundering herd problem
     * Random jitter between 0.5x and 1.5x of the calculated delay
     */
    const jitter = 0.5 + Math.random();

    return Math.floor(cappedDelay * jitter);
  }

  private async _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async executeWithRetry<T>(operation: () => Promise<T>, context: string = 'operation'): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= this._config.maxRetries + 1; attempt++) {
      try {
        logger.debug(`${context}: Attempt ${attempt}/${this._config.maxRetries + 1}`);

        const result = await operation();

        if (attempt > 1) {
          logger.info(`${context}: Succeeded on attempt ${attempt} after ${totalDelay}ms total delay`);
        }

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalDelay,
        };
      } catch (error: any) {
        lastError = error;

        logger.warn(`${context}: Attempt ${attempt} failed:`, error.message || error);

        // If this is the last attempt or error is not retryable, don't retry
        if (attempt > this._config.maxRetries || !this._isRetryableError(error)) {
          logger.error(`${context}: Failed after ${attempt} attempts. Error not retryable or max retries reached.`);
          break;
        }

        // Calculate delay for next attempt
        const delay = this._calculateDelay(attempt);
        totalDelay += delay;

        logger.info(`${context}: Retrying in ${delay}ms (attempt ${attempt + 1}/${this._config.maxRetries + 1})`);

        await this._sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this._config.maxRetries + 1,
      totalDelay,
    };
  }

  // Helper method for fetch requests
  async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    context: string = 'fetch',
  ): Promise<RetryResult<Response>> {
    return this.executeWithRetry(async () => {
      const response = await fetch(url, options);

      // Check if response indicates a retryable error
      if (!response.ok && this._config.retryableStatusCodes.includes(response.status)) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).statusCode = response.status;
        throw error;
      }

      return response;
    }, context);
  }
}

// Create default retry handlers for different scenarios
export const defaultRetryHandler = new RetryHandler();

export const aggressiveRetryHandler = new RetryHandler({
  maxRetries: 5,
  baseDelay: 500,
  maxDelay: 60000,
  backoffMultiplier: 1.5,
});

export const conservativeRetryHandler = new RetryHandler({
  maxRetries: 2,
  baseDelay: 2000,
  maxDelay: 10000,
  backoffMultiplier: 3,
});

// Specific handler for rate limit errors with improved backoff
export const rateLimitRetryHandler = new RetryHandler({
  maxRetries: 4, // Increased retries for rate limits
  baseDelay: 5000, // Start with 5 seconds for rate limits
  maxDelay: 120000, // Max 2 minutes for rate limits
  backoffMultiplier: 2.5, // More aggressive backoff
  retryableStatusCodes: [429, 502, 503, 504],
  retryableErrorMessages: [
    'too many requests',
    'rate limit',
    'temporarily rate-limited upstream',
    'rate-limited',
    'quota exceeded',
  ],
});

export { RetryHandler };
