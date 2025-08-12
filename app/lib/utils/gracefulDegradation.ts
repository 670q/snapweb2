import React from 'react';
import { toast } from 'react-toastify';

export interface ServiceStatus {
  name: string;
  isAvailable: boolean;
  lastChecked: number;
  responseTime?: number;
  error?: string;
}

export interface DegradationConfig {
  checkInterval: number;
  timeout: number;
  retryAttempts: number;
  fallbackMode: 'offline' | 'limited' | 'cached' | 'alternative';
  onServiceDown?: (service: string) => void;
  onServiceUp?: (service: string) => void;
}

const DEFAULT_CONFIG: DegradationConfig = {
  checkInterval: 30000, // 30 seconds
  timeout: 10000, // 10 seconds
  retryAttempts: 3,
  fallbackMode: 'limited',
};

export class GracefulDegradationManager {
  private services = new Map<string, ServiceStatus>();
  private config: DegradationConfig;
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor(config: Partial<DegradationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * تسجيل خدمة للمراقبة
   */
  registerService(
    name: string,
    healthCheckUrl: string,
    options?: {
      checkInterval?: number;
      timeout?: number;
      headers?: Record<string, string>;
    },
  ): void {
    this.services.set(name, {
      name,
      isAvailable: true,
      lastChecked: 0,
    });

    // بدء مراقبة الخدمة
    this.startHealthCheck(name, healthCheckUrl, options);
  }

  /**
   * إلغاء تسجيل خدمة
   */
  unregisterService(name: string): void {
    const interval = this.healthCheckIntervals.get(name);

    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(name);
    }

    this.services.delete(name);
  }

  /**
   * فحص حالة خدمة
   */
  async checkServiceHealth(
    name: string,
    url: string,
    options?: {
      timeout?: number;
      headers?: Record<string, string>;
    },
  ): Promise<ServiceStatus> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.config.timeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        headers: options?.headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      const status: ServiceStatus = {
        name,
        isAvailable: response.ok,
        lastChecked: Date.now(),
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };

      this.updateServiceStatus(name, status);

      return status;
    } catch (error) {
      const status: ServiceStatus = {
        name,
        isAvailable: false,
        lastChecked: Date.now(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };

      this.updateServiceStatus(name, status);

      return status;
    }
  }

  /**
   * بدء مراقبة دورية للخدمة
   */
  private startHealthCheck(
    name: string,
    url: string,
    options?: {
      checkInterval?: number;
      timeout?: number;
      headers?: Record<string, string>;
    },
  ): void {
    const interval = options?.checkInterval || this.config.checkInterval;

    // فحص أولي
    this.checkServiceHealth(name, url, options);

    // فحص دوري
    const intervalId = setInterval(() => {
      this.checkServiceHealth(name, url, options);
    }, interval);

    this.healthCheckIntervals.set(name, intervalId);
  }

  /**
   * تحديث حالة الخدمة
   */
  private updateServiceStatus(name: string, newStatus: ServiceStatus): void {
    const oldStatus = this.services.get(name);
    this.services.set(name, newStatus);

    // إشعار عند تغيير الحالة
    if (oldStatus && oldStatus.isAvailable !== newStatus.isAvailable) {
      if (newStatus.isAvailable) {
        this.config.onServiceUp?.(name);
        toast.success(`تم استعادة خدمة ${name}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });
      } else {
        this.config.onServiceDown?.(name);
        toast.warning(`خدمة ${name} غير متاحة حالياً`, {
          position: 'bottom-right',
          autoClose: 5000,
        });
      }
    }
  }

  /**
   * فحص ما إذا كانت الخدمة متاحة
   */
  isServiceAvailable(name: string): boolean {
    const service = this.services.get(name);
    return service?.isAvailable ?? false;
  }

  /**
   * الحصول على حالة جميع الخدمات
   */
  getAllServicesStatus(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * تنفيذ عملية مع graceful degradation
   */
  async executeWithDegradation<T>(
    serviceName: string,
    primaryOperation: () => Promise<T>,
    fallbackOptions?: {
      fallbackOperation?: () => Promise<T>;
      cachedResult?: T;
      offlineMessage?: string;
      useCache?: boolean;
      cacheKey?: string;
      cacheTTL?: number;
    },
  ): Promise<T> {
    const isAvailable = this.isServiceAvailable(serviceName);

    // إذا كانت الخدمة متاحة، جرب العملية الأساسية
    if (isAvailable) {
      try {
        const result = await primaryOperation();

        // حفظ في الكاش إذا كان مطلوباً
        if (fallbackOptions?.useCache && fallbackOptions?.cacheKey) {
          this.setCache(
            fallbackOptions.cacheKey,
            result,
            fallbackOptions.cacheTTL || 300000, // 5 minutes default
          );
        }

        return result;
      } catch (error) {
        // تحديث حالة الخدمة عند الفشل
        this.services.set(serviceName, {
          name: serviceName,
          isAvailable: false,
          lastChecked: Date.now(),
          error: error instanceof Error ? error.message : String(error),
        });

        // الانتقال للخيارات البديلة
        return this.handleFallback(serviceName, fallbackOptions, error);
      }
    }

    // إذا كانت الخدمة غير متاحة، استخدم الخيارات البديلة
    return this.handleFallback(serviceName, fallbackOptions);
  }

  /**
   * التعامل مع الخيارات البديلة
   */
  private async handleFallback<T>(
    serviceName: string,
    fallbackOptions?: {
      fallbackOperation?: () => Promise<T>;
      cachedResult?: T;
      offlineMessage?: string;
      useCache?: boolean;
      cacheKey?: string;
    },
    originalError?: any,
  ): Promise<T> {
    // محاولة استخدام الكاش
    if (fallbackOptions?.useCache && fallbackOptions?.cacheKey) {
      const cached = this.getCache(fallbackOptions.cacheKey);

      if (cached) {
        toast.info(`استخدام البيانات المحفوظة لخدمة ${serviceName}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });
        return cached;
      }
    }

    // محاولة العملية البديلة
    if (fallbackOptions?.fallbackOperation) {
      try {
        const result = await fallbackOptions.fallbackOperation();
        toast.info(`تم استخدام الخدمة البديلة لـ ${serviceName}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });

        return result;
      } catch (fallbackError) {
        console.warn(`Fallback operation failed for ${serviceName}:`, fallbackError);
      }
    }

    // استخدام النتيجة المحفوظة مسبقاً
    if (fallbackOptions?.cachedResult !== undefined) {
      toast.info(`استخدام البيانات الافتراضية لخدمة ${serviceName}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
      return fallbackOptions.cachedResult;
    }

    // إظهار رسالة عدم الاتصال
    const message = fallbackOptions?.offlineMessage || `خدمة ${serviceName} غير متاحة حالياً. يرجى المحاولة لاحقاً.`;

    toast.error(message, {
      position: 'bottom-right',
      autoClose: 5000,
    });

    throw originalError || new Error(`Service ${serviceName} is unavailable`);
  }

  /**
   * حفظ البيانات في الكاش
   */
  setCache(key: string, data: any, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * استرجاع البيانات من الكاش
   */
  getCache<T = any>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > cached.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * مسح الكاش
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * فحص الاتصال بالإنترنت
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * تنظيف الموارد
   */
  cleanup(): void {
    this.healthCheckIntervals.forEach((interval) => clearInterval(interval));
    this.healthCheckIntervals.clear();
    this.services.clear();
    this.cache.clear();
  }
}

// إنشاء instance افتراضي
export const gracefulDegradation = new GracefulDegradationManager();

// Hook لاستخدام graceful degradation في React
export function useGracefulDegradation(config?: Partial<DegradationConfig>) {
  const manager = React.useMemo(() => new GracefulDegradationManager(config), [config]);
  const [servicesStatus, setServicesStatus] = React.useState<ServiceStatus[]>([]);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    // مراقبة حالة الاتصال
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // تحديث حالة الخدمات دورياً
    const interval = setInterval(() => {
      setServicesStatus(manager.getAllServicesStatus());
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      manager.cleanup();
    };
  }, [manager]);

  const executeWithFallback = React.useCallback(
    async <T>(
      serviceName: string,
      primaryOperation: () => Promise<T>,
      fallbackOptions?: Parameters<typeof manager.executeWithDegradation>[2],
    ) => {
      return manager.executeWithDegradation(serviceName, primaryOperation, fallbackOptions);
    },
    [manager],
  );

  const registerService = React.useCallback(
    (name: string, healthCheckUrl: string, options?: Parameters<typeof manager.registerService>[2]) => {
      manager.registerService(name, healthCheckUrl, options);
    },
    [manager],
  );

  return {
    servicesStatus,
    isOnline,
    executeWithFallback,
    registerService,
    isServiceAvailable: (name: string) => manager.isServiceAvailable(name),
    setCache: (key: string, data: any, ttl?: number) => manager.setCache(key, data, ttl),
    getCache: <T>(key: string) => manager.getCache<T>(key),
    clearCache: (key?: string) => manager.clearCache(key),
  };
}

// مساعدات للخدمات الشائعة
export const serviceHelpers = {
  /**
   * تكوين خدمة API
   */
  configureApiService: (baseUrl: string, name = 'API') => {
    gracefulDegradation.registerService(name, `${baseUrl}/health`, {
      checkInterval: 30000,
      timeout: 10000,
    });
  },

  /**
   * تكوين خدمة الذكاء الاصطناعي
   */
  configureAIService: (name: string, healthUrl: string) => {
    gracefulDegradation.registerService(name, healthUrl, {
      checkInterval: 60000, // فحص كل دقيقة
      timeout: 15000, // timeout أطول للذكاء الاصطناعي
    });
  },

  /**
   * تكوين خدمة قاعدة البيانات
   */
  configureDatabaseService: (healthUrl: string) => {
    gracefulDegradation.registerService('Database', healthUrl, {
      checkInterval: 20000,
      timeout: 5000,
    });
  },
};

export default GracefulDegradationManager;
