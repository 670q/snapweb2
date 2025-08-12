import React from 'react';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  stack?: string;
  sanitized: boolean;
}

export interface LoggerConfig {
  maxEntries: number;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  sensitiveKeys: string[];
  maskPatterns: RegExp[];
  environment: 'development' | 'production' | 'test';
}

const DEFAULT_CONFIG: LoggerConfig = {
  maxEntries: 1000,
  enableConsole: true,
  enableStorage: true,
  enableRemote: false,
  sensitiveKeys: [
    'password',
    'token',
    'apiKey',
    'secret',
    'key',
    'auth',
    'authorization',
    'cookie',
    'session',
    'credit',
    'card',
    'ssn',
    'social',
    'email',
    'phone',
    'address',
  ],
  maskPatterns: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g, // Phone
    /\b[A-Za-z0-9]{20,}\b/g, // Long tokens
    /bearer\s+[A-Za-z0-9._-]+/gi, // Bearer tokens
    /api[_-]?key[\s:=]+[A-Za-z0-9._-]+/gi, // API keys
  ],
  environment: 'production',
};

export class SecureLogger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private sessionId: string;
  private userId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.initializeStorage();
  }

  /**
   * توليد معرف جلسة فريد
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * تهيئة التخزين المحلي
   */
  private initializeStorage(): void {
    if (this.config.enableStorage && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('secure_logs');

        if (stored) {
          const parsedLogs = JSON.parse(stored);
          this.logs = parsedLogs.slice(-this.config.maxEntries);
        }
      } catch (error) {
        console.warn('Failed to load stored logs:', error);
      }
    }
  }

  /**
   * تنظيف البيانات الحساسة
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map((item) => this.sanitizeData(item));
      }

      const sanitized: any = {};

      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();

        // فحص المفاتيح الحساسة
        if (this.config.sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey.toLowerCase()))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * تنظيف النصوص
   */
  private sanitizeString(text: string): string {
    let sanitized = text;

    // تطبيق أنماط الإخفاء
    this.config.maskPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[MASKED]');
    });

    return sanitized;
  }

  /**
   * إنشاء معرف فريد للسجل
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * تسجيل رسالة
   */
  private log(level: LogEntry['level'], message: string, context?: Record<string, any>, error?: Error): void {
    const entry: LogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level,
      message: this.sanitizeString(message),
      context: context ? this.sanitizeData(context) : undefined,
      userId: this.userId,
      sessionId: this.sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      stack: error?.stack ? this.sanitizeString(error.stack) : undefined,
      sanitized: true,
    };

    // إضافة للسجلات المحلية
    this.logs.push(entry);

    // الحفاظ على الحد الأقصى للسجلات
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries);
    }

    // حفظ في التخزين المحلي
    if (this.config.enableStorage) {
      this.saveToStorage();
    }

    // طباعة في وحدة التحكم
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // إرسال للخادم البعيد
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.sendToRemote(entry);
    }
  }

  /**
   * طباعة في وحدة التحكم
   */
  private logToConsole(entry: LogEntry): void {
    const { level, message, context } = entry;
    const logMethod = level === 'critical' ? console.error : (console[level as keyof Console] as any) || console.log;

    if (context) {
      logMethod(`[${level.toUpperCase()}] ${message}`, context);
    } else {
      logMethod(`[${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * حفظ في التخزين المحلي
   */
  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('secure_logs', JSON.stringify(this.logs));
      } catch (error) {
        console.warn('Failed to save logs to storage:', error);
      }
    }
  }

  /**
   * إرسال للخادم البعيد
   */
  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // فشل في الإرسال - لا نريد إنشاء حلقة لا نهائية من الأخطاء
      if (this.config.enableConsole) {
        console.warn('Failed to send log to remote endpoint:', error);
      }
    }
  }

  /**
   * تسجيل رسالة تصحيح
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * تسجيل رسالة معلومات
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * تسجيل رسالة تحذير
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * تسجيل رسالة خطأ
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, context, error);
  }

  /**
   * تسجيل رسالة خطأ حرج
   */
  critical(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('critical', message, context, error);
  }

  /**
   * تسجيل خطأ React
   */
  logReactError(error: Error, errorInfo: { componentStack: string }): void {
    this.error('React Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorName: error.name,
      errorMessage: error.message,
    });
  }

  /**
   * تسجيل خطأ API
   */
  logApiError(url: string, method: string, status: number, error: Error, requestData?: any): void {
    this.error('API Request Failed', error, {
      url: this.sanitizeString(url),
      method,
      status,
      requestData: requestData ? this.sanitizeData(requestData) : undefined,
    });
  }

  /**
   * تسجيل نشاط المستخدم
   */
  logUserActivity(action: string, details?: Record<string, any>): void {
    this.info(`User Activity: ${action}`, {
      action,
      details: details ? this.sanitizeData(details) : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * تسجيل أداء العملية
   */
  logPerformance(operation: string, duration: number, details?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      details: details ? this.sanitizeData(details) : undefined,
    });
  }

  /**
   * تعيين معرف المستخدم
   */
  setUserId(userId: string): void {
    this.userId = this.sanitizeString(userId);
  }

  /**
   * مسح معرف المستخدم
   */
  clearUserId(): void {
    this.userId = undefined;
  }

  /**
   * الحصول على السجلات
   */
  getLogs(filter?: { level?: LogEntry['level']; since?: number; limit?: number }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter?.level) {
      filteredLogs = filteredLogs.filter((log) => log.level === filter.level);
    }

    if (filter?.since) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      filteredLogs = filteredLogs.slice(-filter.limit);
    }

    return filteredLogs;
  }

  /**
   * تصدير السجلات
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'message', 'userId', 'sessionId', 'url'];
      const csvRows = [headers.join(',')];

      this.logs.forEach((log) => {
        const row = [
          new Date(log.timestamp).toISOString(),
          log.level,
          `"${log.message.replace(/"/g, '""')}"`,
          log.userId || '',
          log.sessionId,
          log.url || '',
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    }

    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * مسح السجلات
   */
  clearLogs(): void {
    this.logs = [];

    if (this.config.enableStorage && typeof window !== 'undefined') {
      localStorage.removeItem('secure_logs');
    }
  }

  /**
   * إحصائيات السجلات
   */
  getLogStats(): {
    total: number;
    byLevel: Record<LogEntry['level'], number>;
    oldestTimestamp?: number;
    newestTimestamp?: number;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        critical: 0,
      } as Record<LogEntry['level'], number>,
      oldestTimestamp: undefined as number | undefined,
      newestTimestamp: undefined as number | undefined,
    };

    if (this.logs.length > 0) {
      stats.oldestTimestamp = this.logs[0].timestamp;
      stats.newestTimestamp = this.logs[this.logs.length - 1].timestamp;

      this.logs.forEach((log) => {
        stats.byLevel[log.level]++;
      });
    }

    return stats;
  }
}

// إنشاء instance افتراضي
export const secureLogger = new SecureLogger();

// Hook لاستخدام secure logger في React
export function useSecureLogger(config?: Partial<LoggerConfig>) {
  const logger = React.useMemo(() => new SecureLogger(config), [config]);

  const logError = React.useCallback(
    (message: string, error?: Error, context?: Record<string, any>) => {
      logger.error(message, error, context);
    },
    [logger],
  );

  const logInfo = React.useCallback(
    (message: string, context?: Record<string, any>) => {
      logger.info(message, context);
    },
    [logger],
  );

  const logWarning = React.useCallback(
    (message: string, context?: Record<string, any>) => {
      logger.warn(message, context);
    },
    [logger],
  );

  const logUserActivity = React.useCallback(
    (action: string, details?: Record<string, any>) => {
      logger.logUserActivity(action, details);
    },
    [logger],
  );

  const logPerformance = React.useCallback(
    (operation: string, duration: number, details?: Record<string, any>) => {
      logger.logPerformance(operation, duration, details);
    },
    [logger],
  );

  return {
    logError,
    logInfo,
    logWarning,
    logUserActivity,
    logPerformance,
    setUserId: (userId: string) => logger.setUserId(userId),
    clearUserId: () => logger.clearUserId(),
    getLogs: (filter?: Parameters<typeof logger.getLogs>[0]) => logger.getLogs(filter),
    exportLogs: (format?: 'json' | 'csv') => logger.exportLogs(format),
    clearLogs: () => logger.clearLogs(),
    getLogStats: () => logger.getLogStats(),
  };
}

// مساعدات للتسجيل
export const logHelpers = {
  /**
   * تسجيل بداية العملية
   */
  startOperation: (operation: string, context?: Record<string, any>) => {
    secureLogger.info(`Starting operation: ${operation}`, context);
    return Date.now();
  },

  /**
   * تسجيل انتهاء العملية
   */
  endOperation: (operation: string, startTime: number, context?: Record<string, any>) => {
    const duration = Date.now() - startTime;
    secureLogger.logPerformance(operation, duration, context);

    return duration;
  },

  /**
   * تسجيل خطأ مع السياق الكامل
   */
  logErrorWithContext: (error: Error, operation: string, context?: Record<string, any>) => {
    secureLogger.error(`Error in ${operation}`, error, {
      operation,
      ...context,
    });
  },
};

export default SecureLogger;
