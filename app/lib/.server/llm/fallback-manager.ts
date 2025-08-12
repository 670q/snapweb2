import { createScopedLogger } from '~/utils/logger';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { LLMManager } from '~/lib/modules/llm/manager';

const logger = createScopedLogger('fallback-manager');

interface FallbackModel {
  model: string;
  provider: string;
  priority: number; // Lower number = higher priority
}

interface ProviderHealth {
  isHealthy: boolean;
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

interface HealthCheckResult {
  success: boolean;
  responseTime: number;
  error?: string;
}

// Define fallback models in order of preference
const FALLBACK_MODELS: FallbackModel[] = [
  // Primary fallbacks - reliable models
  { model: 'claude-3-5-sonnet-latest', provider: 'Anthropic', priority: 1 },
  { model: 'anthropic/claude-3.5-sonnet', provider: 'OpenRouter', priority: 2 },
  { model: 'anthropic/claude-3-haiku', provider: 'OpenRouter', priority: 3 },

  // Secondary fallbacks - free/reliable options
  { model: 'google/gemini-flash-1.5', provider: 'OpenRouter', priority: 4 },
  { model: 'deepseek/deepseek-coder', provider: 'OpenRouter', priority: 5 },
  { model: 'mistralai/mistral-nemo', provider: 'OpenRouter', priority: 6 },

  // Last resort fallbacks
  { model: 'cohere/command', provider: 'OpenRouter', priority: 7 },

  // Local providers (lower priority but good for offline scenarios)
  { model: 'llama3.2:latest', provider: 'Ollama', priority: 8 },
  { model: 'qwen2.5:latest', provider: 'Ollama', priority: 9 },
  { model: 'mistral:latest', provider: 'Ollama', priority: 10 },
  { model: 'codellama:latest', provider: 'Ollama', priority: 11 },

  // LM Studio models (if available locally)
  { model: 'local-model', provider: 'LMStudio', priority: 12 },

  // OpenAI models (backup)
  { model: 'gpt-4o-mini', provider: 'OpenAI', priority: 13 },
  { model: 'gpt-3.5-turbo', provider: 'OpenAI', priority: 14 },
];

export class FallbackManager {
  private static _instance: FallbackManager;
  private _llmManager: LLMManager;
  private _providerHealth: Map<string, ProviderHealth> = new Map();
  private _healthCheckTimeout = 10000; // 10 seconds
  private _healthCheckCacheDuration = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this._llmManager = LLMManager.getInstance();
  }

  static getInstance(): FallbackManager {
    if (!FallbackManager._instance) {
      FallbackManager._instance = new FallbackManager();
    }

    return FallbackManager._instance;
  }

  /**
   * Perform health check on a provider
   */
  private async _performHealthCheck(
    provider: any,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: any;
    },
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Special handling for local providers
      if (provider.name === 'Ollama') {
        return await this._checkOllamaHealth();
      }

      if (provider.name === 'LMStudio') {
        return await this._checkLMStudioHealth();
      }

      // Create a simple test model instance to check connectivity
      const testModel = provider.staticModels?.[0]?.name || 'test-model';

      // Create timeout promise for health check
      const healthCheckPromise = new Promise<void>((resolve, reject) => {
        try {
          // Try to create model instance - this will validate API keys and connectivity
          const modelInstance = provider.getModelInstance({
            model: testModel,
            serverEnv: options.serverEnv,
            apiKeys: options.apiKeys,
            providerSettings: options.providerSettings,
          });

          if (modelInstance) {
            resolve();
          } else {
            reject(new Error('Failed to create model instance'));
          }
        } catch (error) {
          reject(error);
        }
      });

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Health check timeout'));
        }, this._healthCheckTimeout);
      });

      await Promise.race([healthCheckPromise, timeoutPromise]);

      const responseTime = Date.now() - startTime;
      logger.debug(`Health check passed for ${provider.name} in ${responseTime}ms`);

      return {
        success: true,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      logger.warn(`Health check failed for ${provider.name}: ${error.message}`);

      return {
        success: false,
        responseTime,
        error: error.message,
      };
    }
  }

  /**
   * Check Ollama health by pinging its API
   */
  private async _checkOllamaHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Try to connect to Ollama's default endpoint
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        logger.debug(`🟢 Ollama health check passed in ${responseTime}ms`);
        return {
          success: true,
          responseTime,
        };
      } else {
        throw new Error(`Ollama responded with status ${response.status}`);
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      logger.debug(`🔴 Ollama health check failed: ${error.message}`);

      return {
        success: false,
        responseTime,
        error: error.message,
      };
    }
  }

  /**
   * Check LM Studio health by pinging its API
   */
  private async _checkLMStudioHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Try to connect to LM Studio's default endpoint
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        logger.debug(`🟢 LM Studio health check passed in ${responseTime}ms`);
        return {
          success: true,
          responseTime,
        };
      } else {
        throw new Error(`LM Studio responded with status ${response.status}`);
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      logger.debug(`🔴 LM Studio health check failed: ${error.message}`);

      return {
        success: false,
        responseTime,
        error: error.message,
      };
    }
  }

  /**
   * Check if provider is healthy (with caching)
   */
  private async _isProviderHealthy(
    provider: any,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: any;
    },
  ): Promise<boolean> {
    const providerName = provider.name;
    const now = new Date();
    const cachedHealth = this._providerHealth.get(providerName);

    // Check if we have recent health data
    if (cachedHealth && now.getTime() - cachedHealth.lastChecked.getTime() < this._healthCheckCacheDuration) {
      logger.debug(`Using cached health status for ${providerName}: ${cachedHealth.isHealthy}`);
      return cachedHealth.isHealthy;
    }

    // Perform new health check
    logger.debug(`Performing health check for ${providerName}`);

    const healthResult = await this._performHealthCheck(provider, options);

    // Cache the result
    this._providerHealth.set(providerName, {
      isHealthy: healthResult.success,
      lastChecked: now,
      responseTime: healthResult.responseTime,
      error: healthResult.error,
    });

    return healthResult.success;
  }

  /**
   * Get the next available fallback model when the current model fails
   */
  async getNextFallbackModel(
    failedModel: string,
    failedProvider: string,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: any;
    },
  ): Promise<{ model: string; provider: any } | null> {
    const { apiKeys, providerSettings, serverEnv } = options;

    logger.info(`🔍 البحث عن مزود بديل للنموذج الفاشل: ${failedModel} (${failedProvider})`);

    // Filter out the failed model and sort by priority
    const availableFallbacks = FALLBACK_MODELS.filter(
      (fallback) => !(fallback.model === failedModel && fallback.provider === failedProvider),
    ).sort((a, b) => a.priority - b.priority);

    logger.debug(`📋 تم العثور على ${availableFallbacks.length} مزود بديل محتمل`);

    for (const fallback of availableFallbacks) {
      try {
        // Find the provider instance
        const provider = PROVIDER_LIST.find((p) => p.name === fallback.provider);

        if (!provider) {
          logger.warn(`⚠️ المزود ${fallback.provider} غير موجود، تخطي النموذج البديل ${fallback.model}`);
          continue;
        }

        logger.debug(`🔍 فحص المزود البديل: ${fallback.model} (${fallback.provider})`);

        // Perform health check first
        const isHealthy = await this._isProviderHealthy(provider, {
          apiKeys,
          providerSettings,
          serverEnv,
        });

        if (!isHealthy) {
          logger.debug(`❌ فشل فحص صحة المزود ${fallback.provider}، تخطي هذا المزود`);
          continue;
        }

        logger.debug(`✅ المزود ${fallback.provider} يبدو صحياً، فحص توفر النموذج...`);

        // Check if the model is available in the provider
        const isModelAvailable = await this._isModelAvailable(fallback.model, provider, {
          apiKeys,
          providerSettings,
          serverEnv,
        });

        if (isModelAvailable) {
          logger.info(`🎉 تم العثور على مزود بديل صحي ومتاح: ${fallback.model} (${fallback.provider})`);
          return {
            model: fallback.model,
            provider,
          };
        } else {
          logger.debug(`❌ النموذج البديل ${fallback.model} غير متاح في ${fallback.provider}`);
        }
      } catch (error) {
        logger.warn(`💥 خطأ أثناء فحص المزود البديل ${fallback.model} (${fallback.provider}):`, error);
        continue;
      }
    }

    // If no fallback found, return default (but check its health first)
    logger.warn('⚠️ لا توجد نماذج بديلة متاحة، فحص المزود الافتراضي');

    try {
      logger.debug('🔍 فحص صحة المزود الافتراضي...');

      const isDefaultHealthy = await this._isProviderHealthy(DEFAULT_PROVIDER, {
        apiKeys,
        providerSettings,
        serverEnv,
      });

      if (isDefaultHealthy) {
        logger.info(`✅ المزود الافتراضي متاح: ${DEFAULT_MODEL}`);
        return {
          model: DEFAULT_MODEL,
          provider: DEFAULT_PROVIDER,
        };
      } else {
        logger.warn('❌ المزود الافتراضي غير صحي');
      }
    } catch (error) {
      logger.error('💥 فشل فحص صحة المزود الافتراضي:', error);
    }

    logger.error('🚫 لا توجد مزودات صحية متاحة على الإطلاق');

    return null; // No healthy providers available
  }

  /**
   * Check if a model is available in a provider
   */
  private async _isModelAvailable(
    modelName: string,
    provider: any,
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: any;
    },
  ): Promise<boolean> {
    try {
      // Check static models first
      const staticModels = this._llmManager.getStaticModelListFromProvider(provider);

      if (staticModels.some((m) => m.name === modelName)) {
        return true;
      }

      // Check dynamic models
      const dynamicModels = await this._llmManager.getModelListFromProvider(provider, options);

      return dynamicModels.some((m) => m.name === modelName);
    } catch (error) {
      logger.debug(`Error checking model availability for ${modelName}:`, error);
      return false;
    }
  }

  /**
   * Check if an error indicates we should try a fallback model
   * Only use fallback for severe errors, not temporary unavailability
   */
  shouldUseFallback(error: any): boolean {
    if (!error) {
      return false;
    }

    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode || error.status;

    // Only use fallback for persistent rate limiting (not temporary)
    if (statusCode === 429 && errorMessage.includes('quota exceeded')) {
      return true;
    }

    if (errorMessage.includes('quota exceeded')) {
      return true;
    }

    // Only use fallback for permanent model unavailability
    if (errorMessage.includes('model not supported')) {
      return true;
    }

    if (errorMessage.includes('model discontinued')) {
      return true;
    }

    if (errorMessage.includes('model removed')) {
      return true;
    }

    // Server errors that indicate service is down (not temporary rate limits)
    if (statusCode >= 500 && statusCode !== 503) {
      return true;
    } // Exclude 503 (temporary)

    if (errorMessage.includes('internal server error')) {
      return true;
    }

    if (errorMessage.includes('bad gateway')) {
      return true;
    }

    if (errorMessage.includes('gateway timeout')) {
      return true;
    }

    /*
     * DO NOT use fallback for:
     * - Temporary rate limits (429 without quota exceeded)
     * - Temporary unavailability (503, temporarily rate-limited)
     * - Model not found (404) - could be temporary
     * - "no endpoints found" - often temporary
     */

    return false;
  }
}

export const fallbackManager = FallbackManager.getInstance();
