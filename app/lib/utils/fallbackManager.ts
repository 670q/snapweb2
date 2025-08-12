import { toast } from 'react-toastify';
import { errorHandler } from './errorHandler';

interface FallbackProvider {
  name: string;
  priority: number;
  isAvailable: boolean;
  lastFailure?: Date;
  failureCount: number;
  maxFailures: number;
}

interface FallbackConfig {
  maxRetries: number;
  retryDelay: number;
  circuitBreakerTimeout: number; // Time to wait before retrying a failed provider
  fallbackMessage?: string;
}

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  maxRetries: 3,
  retryDelay: 2000,
  circuitBreakerTimeout: 5 * 60 * 1000, // 5 minutes
  fallbackMessage: 'جاري المحاولة مع مزود بديل...',
};

export class FallbackManager {
  private static instance: FallbackManager;
  private providers: Map<string, FallbackProvider> = new Map();
  private config: FallbackConfig;
  private activeRequests: Map<string, Promise<any>> = new Map();

  private constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
    this.initializeProviders();
  }

  static getInstance(config?: Partial<FallbackConfig>): FallbackManager {
    if (!FallbackManager.instance) {
      FallbackManager.instance = new FallbackManager(config);
    }

    return FallbackManager.instance;
  }

  private initializeProviders() {
    // Initialize common AI providers with priority order
    const defaultProviders = [
      { name: 'OpenRouter', priority: 1, maxFailures: 3 },
      { name: 'OpenAI', priority: 2, maxFailures: 3 },
      { name: 'Anthropic', priority: 3, maxFailures: 3 },
      { name: 'Google', priority: 4, maxFailures: 3 },
      { name: 'Cohere', priority: 5, maxFailures: 3 },
    ];

    defaultProviders.forEach((provider) => {
      this.providers.set(provider.name, {
        ...provider,
        isAvailable: true,
        failureCount: 0,
      });
    });
  }

  /**
   * Execute operation with fallback support
   */
  async executeWithFallback<T>(
    operation: (provider: string) => Promise<T>,
    preferredProvider?: string,
    context?: string,
  ): Promise<T> {
    const requestId = `${context || 'request'}_${Date.now()}`;

    // Check if there's already an active request for the same context
    if (context && this.activeRequests.has(context)) {
      return this.activeRequests.get(context)!;
    }

    const promise = this.executeWithFallbackInternal(operation, preferredProvider, context);

    if (context) {
      this.activeRequests.set(context, promise);
      promise.finally(() => {
        this.activeRequests.delete(context);
      });
    }

    return promise;
  }

  private async executeWithFallbackInternal<T>(
    operation: (provider: string) => Promise<T>,
    preferredProvider?: string,
    context?: string,
  ): Promise<T> {
    const availableProviders = this.getAvailableProviders(preferredProvider);

    if (availableProviders.length === 0) {
      throw new Error('لا توجد مزودين متاحين حالياً. يرجى المحاولة لاحقاً.');
    }

    let lastError: any;
    let attemptCount = 0;

    for (const provider of availableProviders) {
      if (attemptCount >= this.config.maxRetries) {
        break;
      }

      try {
        console.log(`Attempting ${context || 'operation'} with provider: ${provider.name}`);

        // Show fallback message if not the first attempt
        if (attemptCount > 0) {
          toast.info(`${this.config.fallbackMessage} (${provider.name})`, {
            position: 'top-right',
            autoClose: 3000,
          });
        }

        const result = await operation(provider.name);

        // Reset failure count on success
        this.resetProviderFailures(provider.name);

        return result;
      } catch (error: any) {
        lastError = error;
        attemptCount++;

        console.warn(`Provider ${provider.name} failed:`, error.message);

        // Record failure
        this.recordProviderFailure(provider.name, error);

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.log(`Non-retryable error from ${provider.name}, trying next provider`);
          continue;
        }

        // Add delay before next attempt
        if (attemptCount < this.config.maxRetries && availableProviders.length > attemptCount) {
          await this.delay(this.config.retryDelay * attemptCount);
        }
      }
    }

    // All providers failed
    const errorDetails = errorHandler.handleApiError(lastError, context);
    throw new Error(`فشل في جميع المزودين المتاحين. آخر خطأ: ${errorDetails.message}`);
  }

  /**
   * Get available providers sorted by priority
   */
  private getAvailableProviders(preferredProvider?: string): FallbackProvider[] {
    const now = new Date();

    // Update provider availability based on circuit breaker
    this.providers.forEach((provider, name) => {
      if (!provider.isAvailable && provider.lastFailure) {
        const timeSinceFailure = now.getTime() - provider.lastFailure.getTime();

        if (timeSinceFailure > this.config.circuitBreakerTimeout) {
          provider.isAvailable = true;
          provider.failureCount = 0;
          console.log(`Provider ${name} is now available again`);
        }
      }
    });

    let availableProviders = Array.from(this.providers.values())
      .filter((provider) => provider.isAvailable)
      .sort((a, b) => a.priority - b.priority);

    // Move preferred provider to front if specified and available
    if (preferredProvider) {
      const preferred = availableProviders.find((p) => p.name === preferredProvider);

      if (preferred) {
        availableProviders = [preferred, ...availableProviders.filter((p) => p.name !== preferredProvider)];
      }
    }

    return availableProviders;
  }

  /**
   * Record provider failure
   */
  private recordProviderFailure(providerName: string, error: any) {
    const provider = this.providers.get(providerName);

    if (!provider) {
      return;
    }

    provider.failureCount++;
    provider.lastFailure = new Date();

    // Disable provider if it exceeds max failures
    if (provider.failureCount >= provider.maxFailures) {
      provider.isAvailable = false;
      console.warn(`Provider ${providerName} disabled due to repeated failures`);

      toast.warn(`المزود ${providerName} غير متاح مؤقتاً. جاري التبديل لمزود آخر.`, {
        position: 'top-right',
        autoClose: 5000,
      });
    }
  }

  /**
   * Reset provider failure count
   */
  private resetProviderFailures(providerName: string) {
    const provider = this.providers.get(providerName);

    if (provider) {
      provider.failureCount = 0;
      provider.isAvailable = true;
      delete provider.lastFailure;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error?.response?.status || error?.statusCode;
    const message = error?.message?.toLowerCase() || '';

    // Don't retry on authentication errors
    if (status === 401 || message.includes('api key') || message.includes('unauthorized')) {
      return false;
    }

    // Don't retry on quota exceeded (but do try other providers)
    if (message.includes('quota') && !message.includes('rate limit')) {
      return false;
    }

    // Retry on network errors, timeouts, and server errors
    return (
      !status || // Network errors
      status >= 500 || // Server errors
      status === 429 || // Rate limits
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection')
    );
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Record<string, { isAvailable: boolean; failureCount: number; lastFailure?: Date }> {
    const status: Record<string, any> = {};

    this.providers.forEach((provider, name) => {
      status[name] = {
        isAvailable: provider.isAvailable,
        failureCount: provider.failureCount,
        lastFailure: provider.lastFailure,
      };
    });

    return status;
  }

  /**
   * Manually enable/disable provider
   */
  setProviderAvailability(providerName: string, isAvailable: boolean) {
    const provider = this.providers.get(providerName);

    if (provider) {
      provider.isAvailable = isAvailable;

      if (isAvailable) {
        provider.failureCount = 0;
        delete provider.lastFailure;
      }
    }
  }

  /**
   * Add or update provider
   */
  addProvider(name: string, priority: number, maxFailures: number = 3) {
    this.providers.set(name, {
      name,
      priority,
      maxFailures,
      isAvailable: true,
      failureCount: 0,
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear all active requests (useful for cleanup)
   */
  clearActiveRequests() {
    this.activeRequests.clear();
  }
}

// Export singleton instance
export const fallbackManager = FallbackManager.getInstance();

// Utility functions
export const executeWithFallback = <T>(
  operation: (provider: string) => Promise<T>,
  preferredProvider?: string,
  context?: string,
) => fallbackManager.executeWithFallback(operation, preferredProvider, context);

export const getProviderStatus = () => fallbackManager.getProviderStatus();

export const setProviderAvailability = (providerName: string, isAvailable: boolean) =>
  fallbackManager.setProviderAvailability(providerName, isAvailable);

// React hook for fallback management
export function useFallbackManager() {
  return {
    executeWithFallback,
    getProviderStatus,
    setProviderAvailability,
    clearActiveRequests: () => fallbackManager.clearActiveRequests(),
  };
}
