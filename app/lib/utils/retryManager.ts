import React from 'react';
import { toast } from 'react-toastify';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
  onRetry?: (attempt: number, error: Error) => void;
  onMaxAttemptsReached?: (error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMITED',
    'SERVER_ERROR',
    'SERVICE_UNAVAILABLE',
    'TEMPORARY_FAILURE',
  ],
};

export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * تحديد ما إذا كان الخطأ قابل للإعادة
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // فحص أنواع الأخطاء القابلة للإعادة
    const retryablePatterns = [
      'network',
      'timeout',
      'rate limit',
      'server error',
      'service unavailable',
      'temporary',
      'connection',
      'fetch',
      'abort',
    ];

    return (
      this.config.retryableErrors.some(
        (retryableError) =>
          errorMessage.includes(retryableError.toLowerCase()) || errorName.includes(retryableError.toLowerCase()),
      ) || retryablePatterns.some((pattern) => errorMessage.includes(pattern) || errorName.includes(pattern))
    );
  }

  /**
   * حساب تأخير الإعادة باستخدام exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * delay;

    // إضافة jitter لتجنب thundering herd
    return Math.min(delay + jitter, this.config.maxDelay);
  }

  /**
   * تنفيذ عملية مع إعادة المحاولة
   */
  async executeWithRetry<T>(operation: () => Promise<T>, customConfig?: Partial<RetryConfig>): Promise<RetryResult<T>> {
    const config = customConfig ? { ...this.config, ...customConfig } : this.config;
    const startTime = Date.now();
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // إذا كان هذا آخر محاولة أو الخطأ غير قابل للإعادة
        if (attempt === config.maxAttempts || !this.isRetryableError(lastError)) {
          break;
        }

        // استدعاء callback للإعادة
        config.onRetry?.(attempt, lastError);

        // انتظار قبل المحاولة التالية
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);

        // إظهار رسالة للمستخدم
        if (attempt < config.maxAttempts) {
          toast.info(`إعادة المحاولة ${attempt + 1}/${config.maxAttempts}...`, {
            position: 'bottom-right',
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      }
    }

    // استدعاء callback عند الوصول للحد الأقصى من المحاولات
    config.onMaxAttemptsReached?.(lastError!);

    return {
      success: false,
      error: lastError!,
      attempts: config.maxAttempts,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * إعادة محاولة طلب HTTP
   */
  async retryHttpRequest<T>(
    url: string,
    options: RequestInit = {},
    customConfig?: Partial<RetryConfig>,
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(async () => {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // timeout بعد 30 ثانية
      });

      if (!response.ok) {
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        // تحديد نوع الخطأ بناءً على status code
        if (response.status >= 500) {
          throw new Error(`SERVER_ERROR: ${errorMessage}`);
        } else if (response.status === 429) {
          throw new Error(`RATE_LIMITED: ${errorMessage}`);
        } else if (response.status === 408) {
          throw new Error(`TIMEOUT: ${errorMessage}`);
        } else {
          throw new Error(errorMessage);
        }
      }

      return response.json() as T;
    }, customConfig);
  }

  /**
   * إعادة محاولة عملية async عامة
   */
  async retryAsync<T>(
    asyncFn: () => Promise<T>,
    options?: {
      maxAttempts?: number;
      baseDelay?: number;
      onRetry?: (attempt: number, error: Error) => void;
      retryCondition?: (error: Error) => boolean;
    },
  ): Promise<T> {
    const config: Partial<RetryConfig> = {
      maxAttempts: options?.maxAttempts,
      baseDelay: options?.baseDelay,
      onRetry: options?.onRetry,
    };

    // إضافة شرط إعادة مخصص
    if (options?.retryCondition) {
      const originalRetryableErrors = this.config.retryableErrors;
      config.retryableErrors = ['CUSTOM_RETRY_CONDITION'];

      const result = await this.executeWithRetry(async () => {
        try {
          return await asyncFn();
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          if (options.retryCondition!(err)) {
            err.name = 'CUSTOM_RETRY_CONDITION';
          }

          throw err;
        }
      }, config);

      // استعادة الإعدادات الأصلية
      this.config.retryableErrors = originalRetryableErrors;

      if (result.success) {
        return result.data!;
      } else {
        throw result.error!;
      }
    }

    const result = await this.executeWithRetry(asyncFn, config);

    if (result.success) {
      return result.data!;
    } else {
      throw result.error!;
    }
  }

  /**
   * إنشاء wrapper للدوال مع retry تلقائي
   */
  createRetryWrapper<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    config?: Partial<RetryConfig>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const result = await this.executeWithRetry(() => fn(...args), config);

      if (result.success) {
        return result.data!;
      } else {
        throw result.error!;
      }
    };
  }

  /**
   * إعادة محاولة مع circuit breaker
   */
  async retryWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerConfig?: {
      failureThreshold: number;
      resetTimeout: number;
    },
  ): Promise<T> {
    const cbConfig = {
      failureThreshold: 5,
      resetTimeout: 60000,
      ...circuitBreakerConfig,
    };

    // تنفيذ circuit breaker بسيط
    const circuitKey = operation.toString();
    const now = Date.now();

    // فحص حالة circuit breaker
    const circuitState = this.getCircuitState(circuitKey);

    if (circuitState.isOpen && now - circuitState.lastFailure < cbConfig.resetTimeout) {
      throw new Error('Circuit breaker is open - service temporarily unavailable');
    }

    try {
      const result = await this.retryAsync(operation);

      // إعادة تعيين circuit breaker عند النجاح
      this.resetCircuitState(circuitKey);

      return result;
    } catch (error) {
      // تحديث circuit breaker عند الفشل
      this.updateCircuitState(circuitKey, cbConfig.failureThreshold);
      throw error;
    }
  }

  private circuitStates = new Map<
    string,
    {
      failures: number;
      lastFailure: number;
      isOpen: boolean;
    }
  >();

  private getCircuitState(key: string) {
    return (
      this.circuitStates.get(key) || {
        failures: 0,
        lastFailure: 0,
        isOpen: false,
      }
    );
  }

  private updateCircuitState(key: string, threshold: number) {
    const state = this.getCircuitState(key);
    state.failures++;
    state.lastFailure = Date.now();
    state.isOpen = state.failures >= threshold;
    this.circuitStates.set(key, state);
  }

  private resetCircuitState(key: string) {
    this.circuitStates.set(key, {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// إنشاء instance افتراضي
export const defaultRetryManager = new RetryManager();

// Hook لاستخدام retry manager في React
export function useRetryManager(config?: Partial<RetryConfig>) {
  const retryManager = React.useMemo(() => new RetryManager(config), [config]);

  const retryOperation = React.useCallback(
    async <T>(operation: () => Promise<T>, customConfig?: Partial<RetryConfig>) => {
      return retryManager.executeWithRetry(operation, customConfig);
    },
    [retryManager],
  );

  const retryHttp = React.useCallback(
    async <T>(url: string, options?: RequestInit, customConfig?: Partial<RetryConfig>) => {
      return retryManager.retryHttpRequest<T>(url, options, customConfig);
    },
    [retryManager],
  );

  return {
    retryOperation,
    retryHttp,
    retryManager,
  };
}

// Utility functions
export const retryUtils = {
  /**
   * إنشاء retry config للطلبات السريعة
   */
  fastRetry: (): Partial<RetryConfig> => ({
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
  }),

  /**
   * إنشاء retry config للطلبات البطيئة
   */
  slowRetry: (): Partial<RetryConfig> => ({
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 30000,
  }),

  /**
   * إنشاء retry config للطلبات الحرجة
   */
  criticalRetry: (): Partial<RetryConfig> => ({
    maxAttempts: 10,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
  }),
};

export default RetryManager;
