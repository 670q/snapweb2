import { toast } from 'react-toastify';

interface ErrorDetails {
  message: string;
  code?: string | number;
  status?: number;
  retryAfter?: number;
  provider?: string;
  timestamp?: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryConfig: RetryConfig;

  private constructor(config: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  static getInstance(config?: Partial<RetryConfig>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }

    return ErrorHandler.instance;
  }

  /**
   * Handle API errors with user-friendly messages
   */
  handleApiError(error: any, context?: string): ErrorDetails {
    const errorDetails = this.parseError(error);
    const userMessage = this.getUserFriendlyMessage(errorDetails, context);

    // Log error safely
    this.logError(errorDetails, context);

    // Show user notification
    this.showUserNotification(userMessage, errorDetails);

    return errorDetails;
  }

  /**
   * Handle LLM-specific errors
   */
  handleLLMError(error: any, provider?: string): ErrorDetails {
    const errorDetails = this.parseError(error);
    errorDetails.provider = provider;

    const userMessage = this.getLLMErrorMessage(errorDetails);

    this.logError(errorDetails, 'LLM');
    this.showUserNotification(userMessage, errorDetails);

    return errorDetails;
  }

  /**
   * Retry mechanism with exponential backoff
   */
  async withRetry<T>(operation: () => Promise<T>, config: Partial<RetryConfig> = {}, context?: string): Promise<T> {
    const retryConfig = { ...this.retryConfig, ...config };
    let lastError: any;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === retryConfig.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          break;
        }

        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, attempt),
          retryConfig.maxDelay,
        );

        console.log(
          `Retrying ${context || 'operation'} in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`,
        );
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Parse error object to extract useful information
   */
  private parseError(error: any): ErrorDetails {
    const details: ErrorDetails = {
      message: 'حدث خطأ غير متوقع',
      timestamp: new Date().toISOString(),
    };

    if (error?.response) {
      // HTTP error
      details.status = error.response.status;
      details.message = error.response.data?.message || error.message || details.message;
      details.code = error.response.data?.code || error.code;

      if (error.response.headers?.['retry-after']) {
        details.retryAfter = parseInt(error.response.headers['retry-after']);
      }
    } else if (error?.message) {
      details.message = error.message;
      details.code = error.code;
    } else if (typeof error === 'string') {
      details.message = error;
    }

    return details;
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(errorDetails: ErrorDetails, context?: string): string {
    const { status, message } = errorDetails;

    switch (status) {
      case 400:
        return 'طلب غير صحيح. يرجى التحقق من البيانات المدخلة.';
      case 401:
        return 'غير مصرح لك بالوصول. يرجى تسجيل الدخول مرة أخرى.';
      case 403:
        return 'ليس لديك صلاحية للقيام بهذا الإجراء.';
      case 404:
        return 'المورد المطلوب غير موجود.';
      case 429:
        const retryMessage = errorDetails.retryAfter
          ? ` يرجى المحاولة مرة أخرى خلال ${errorDetails.retryAfter} ثانية.`
          : ' يرجى المحاولة مرة أخرى لاحقاً.';
        return 'تم تجاوز الحد المسموح من الطلبات.' + retryMessage;
      case 500:
        return 'خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.';
      case 502:
      case 503:
      case 504:
        return 'الخدمة غير متاحة حالياً. يرجى المحاولة مرة أخرى لاحقاً.';
      default:
        if (message.toLowerCase().includes('network')) {
          return 'مشكلة في الاتصال بالإنترنت. يرجى التحقق من اتصالك.';
        }

        if (message.toLowerCase().includes('timeout')) {
          return 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.';
        }

        return context
          ? `حدث خطأ في ${context}. يرجى المحاولة مرة أخرى.`
          : 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
    }
  }

  /**
   * Get LLM-specific error message
   */
  private getLLMErrorMessage(errorDetails: ErrorDetails): string {
    const { message, provider } = errorDetails;

    if (message.toLowerCase().includes('quota') || message.toLowerCase().includes('limit')) {
      return `تم تجاوز حد الاستخدام${provider ? ` لـ ${provider}` : ''}. يرجى المحاولة لاحقاً أو استخدام نموذج آخر.`;
    }

    if (message.toLowerCase().includes('api key') || message.toLowerCase().includes('authentication')) {
      return `مشكلة في مفتاح API${provider ? ` لـ ${provider}` : ''}. يرجى التحقق من الإعدادات.`;
    }

    if (message.toLowerCase().includes('not found')) {
      return `النموذج المطلوب غير متاح${provider ? ` في ${provider}` : ''}. يرجى اختيار نموذج آخر.`;
    }

    return `حدث خطأ في خدمة الذكاء الاصطناعي${provider ? ` (${provider})` : ''}. يرجى المحاولة مرة أخرى.`;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error?.response?.status;

    // Retry on network errors, timeouts, and server errors
    if (!status) {
      return true;
    }

    // Retry on 5xx errors and 429 (rate limit)
    return status >= 500 || status === 429;
  }

  /**
   * Show user notification
   */
  private showUserNotification(message: string, errorDetails: ErrorDetails) {
    const isWarning = errorDetails.status === 429 || errorDetails.status === 503;

    if (isWarning) {
      toast.warn(message, {
        position: 'top-right',
        autoClose: errorDetails.retryAfter ? errorDetails.retryAfter * 1000 : 8000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } else {
      toast.error(message, {
        position: 'top-right',
        autoClose: 6000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }

  /**
   * Log error safely without exposing sensitive information
   */
  private logError(errorDetails: ErrorDetails, context?: string) {
    const logData = {
      context,
      status: errorDetails.status,
      code: errorDetails.code,
      message: errorDetails.message,
      provider: errorDetails.provider,
      timestamp: errorDetails.timestamp,

      // Don't log full stack traces or sensitive data
    };

    console.error('ErrorHandler:', logData);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions for common use cases
export const handleApiError = (error: any, context?: string) => errorHandler.handleApiError(error, context);

export const handleLLMError = (error: any, provider?: string) => errorHandler.handleLLMError(error, provider);

export const withRetry = <T>(operation: () => Promise<T>, config?: Partial<RetryConfig>, context?: string) =>
  errorHandler.withRetry(operation, config, context);

// React hook for error handling
export function useErrorHandler() {
  return {
    handleApiError,
    handleLLMError,
    withRetry,
  };
}
