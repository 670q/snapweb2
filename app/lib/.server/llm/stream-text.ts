import { convertToCoreMessages, streamText as _streamText, type Message } from 'ai';
import { MAX_TOKENS, type FileMap } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { discussPrompt } from '~/lib/common/prompts/discuss-prompt';
import type { DesignScheme } from '~/types/design-scheme';
import { rateLimitRetryHandler } from '~/lib/.server/retry-handler';
import { fallbackManager } from './fallback-manager';
import { toast } from 'react-toastify';

export type Messages = Message[];

export interface StreamingOptions extends Omit<Parameters<typeof _streamText>[0], 'model'> {
  supabaseConnection?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

const logger = createScopedLogger('stream-text');

function sanitizeText(text: string): string {
  let sanitized = text.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
  sanitized = sanitized.replace(/<think>.*?<\/think>/s, '');
  sanitized = sanitized.replace(/<boltAction type="file" filePath="package-lock\.json">[\s\S]*?<\/boltAction>/g, '');

  return sanitized.trim();
}

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
  chatMode?: 'discuss' | 'build';
  designScheme?: DesignScheme;
}) {
  const {
    messages,
    env: serverEnv,
    options,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    contextFiles,
    summary,
    chatMode,
    designScheme,
  } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  let processedMessages = messages.map((message) => {
    const newMessage = { ...message };

    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;
      newMessage.content = sanitizeText(content);
    } else if (message.role == 'assistant') {
      newMessage.content = sanitizeText(message.content);
    }

    // Sanitize all text parts in parts array, if present
    if (Array.isArray(message.parts)) {
      newMessage.parts = message.parts.map((part) =>
        part.type === 'text' ? { ...part, text: sanitizeText(part.text) } : part,
      );
    }

    return newMessage;
  });

  let provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;
  logger.info(
    `Max tokens for model ${modelDetails.name} is ${dynamicMaxTokens} based on ${modelDetails.maxTokenAllowed} or ${MAX_TOKENS}`,
  );

  let systemPrompt =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      designScheme,
      supabase: {
        isConnected: options?.supabaseConnection?.isConnected || false,
        hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
        credentials: options?.supabaseConnection?.credentials || undefined,
      },
    }) ?? getSystemPrompt();

  if (chatMode === 'build' && contextFiles && contextOptimization) {
    const codeContext = createFilesContext(contextFiles, true);

    systemPrompt = `${systemPrompt}

    Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.
    CONTEXT BUFFER:
    ---
    ${codeContext}
    ---
    `;

    if (summary) {
      systemPrompt = `${systemPrompt}
      below is the chat history till now
      CHAT SUMMARY:
      ---
      ${props.summary}
      ---
      `;

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
    }
  }

  const effectiveLockedFilePaths = new Set<string>();

  if (files) {
    for (const [filePath, fileDetails] of Object.entries(files)) {
      if (fileDetails?.isLocked) {
        effectiveLockedFilePaths.add(filePath);
      }
    }
  }

  if (effectiveLockedFilePaths.size > 0) {
    const lockedFilesListString = Array.from(effectiveLockedFilePaths)
      .map((filePath) => `- ${filePath}`)
      .join('\n');
    systemPrompt = `${systemPrompt}

    IMPORTANT: The following files are locked and MUST NOT be modified in any way. Do not suggest or make any changes to these files. You can proceed with the request but DO NOT make any changes to these files specifically:
    ${lockedFilesListString}
    ---
    `;
  } else {
    console.log('No locked files found from any source for prompt.');
  }

  logger.info(`Sending llm call to ${provider.name} with model ${modelDetails.name}`);

  // console.log(systemPrompt, processedMessages);

  // Enhanced retry and fallback system with timeout and better error handling
  let currentModelDetails = modelDetails;
  let fallbackAttempted = false;
  let fallbackCount = 0;
  const maxFallbackAttempts = 3;
  const requestTimeout = 30000; // 30 seconds timeout

  // Create timeout promise
  const createTimeoutPromise = (timeoutMs: number) => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  };

  // Enhanced LLM call with timeout
  const executeStreamTextWithTimeout = async (modelInstance: any, systemText: string, maxTokens: number) => {
    const streamPromise = _streamText({
      model: modelInstance,
      system: systemText,
      maxTokens,
      messages: convertToCoreMessages(processedMessages as any),
      ...options,
    });

    return Promise.race([
      streamPromise,
      createTimeoutPromise(requestTimeout)
    ]);
  };

  // Main execution with enhanced fallback
  let retryResult: any;
  
  while (fallbackCount <= maxFallbackAttempts) {
    try {
      logger.info(`Attempt ${fallbackCount + 1}: Using ${currentModelDetails.name} (${provider.name})`);
      
      // Show fallback notification to user if this is not the first attempt
      if (fallbackCount > 0) {
        logger.info(`🔄 جاري المحاولة مع مزود بديل: ${currentModelDetails.name}`);
        logger.info(`📡 محاولة الاتصال بالمزود البديل...`);
      }

      retryResult = await rateLimitRetryHandler.executeWithRetry(async () => {
        return await executeStreamTextWithTimeout(
          provider.getModelInstance({
            model: currentModelDetails.name,
            serverEnv,
            apiKeys,
            providerSettings,
          }),
          chatMode === 'build' ? systemPrompt : discussPrompt(),
          currentModelDetails.maxTokenAllowed || dynamicMaxTokens
        );
      }, `LLM call to ${provider.name} (attempt ${fallbackCount + 1})`);

      if (retryResult.success) {
        if (fallbackCount > 0) {
          logger.info(`🎉 نجح المزود البديل: ${currentModelDetails.name} (${provider.name})`);
          logger.info(`📡 تم تأسيس الاتصال بنجاح، جاري معالجة طلبك...`);
        }
        
        if (retryResult.attempts > 1) {
          logger.info(
            `LLM call succeeded after ${retryResult.attempts} attempts with ${retryResult.totalDelay}ms total delay`,
          );
        }
        
        return retryResult.data!;
      }

      // Check if we should try fallback
      if (fallbackManager.shouldUseFallback(retryResult.error) && fallbackCount < maxFallbackAttempts) {
        logger.warn(`Provider failed, trying fallback. Error: ${retryResult.error?.message}`);
        logger.info('🔄 جاري البحث عن مزود بديل...');
        
        // Emit provider switch event for UI indicator
        if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
          logger.info('PROVIDER_SWITCH_START', { 
            currentProvider: provider.name, 
            maxAttempts: maxFallbackAttempts 
          });
        }
        
        const fallback = await fallbackManager.getNextFallbackModel(currentModelDetails.name, provider.name, {
          apiKeys,
          providerSettings,
          serverEnv,
        });

        if (fallback) {
          // Update provider and model for next attempt
          provider = fallback.provider;
          
          // Get model details for fallback
          const fallbackStaticModels = LLMManager.getInstance().getStaticModelListFromProvider(fallback.provider);
          let fallbackModelDetails = fallbackStaticModels.find((m) => m.name === fallback.model);

          if (!fallbackModelDetails) {
            const fallbackModelsList = await LLMManager.getInstance().getModelListFromProvider(fallback.provider, {
              apiKeys,
              providerSettings,
              serverEnv: serverEnv as any,
            });
            fallbackModelDetails = fallbackModelsList.find((m) => m.name === fallback.model);
          }

          if (fallbackModelDetails) {
            logger.info(`✅ تم العثور على مزود بديل: ${fallback.model} (${fallback.provider.name})`);
            logger.info(`🚀 جاري الاتصال بالمزود البديل...`);
            
            // Emit connecting event
            if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
              logger.info('PROVIDER_SWITCH_CONNECTING', { 
                targetProvider: fallback.provider.name,
                targetModel: fallback.model,
                currentProvider: provider.name 
              });
            }
            
            currentModelDetails = fallbackModelDetails;
            fallbackCount++;
            continue; // Try with fallback
          }
        } else {
          logger.warn(`⚠️ لا توجد مزودات بديلة متاحة، المحاولة ${fallbackCount + 1}/${maxFallbackAttempts}`);
        }
      }

      // If we reach here, no more fallbacks available or shouldn't use fallback
      throw retryResult.error || new Error('LLM call failed');
      
    } catch (error: any) {
      logger.error(`Attempt ${fallbackCount + 1} failed:`, error);
      
      // If this is the last attempt, throw the error
      if (fallbackCount >= maxFallbackAttempts) {
        const errorMessage = error?.message || 'Unknown error';
        const isTemporaryError = 
          errorMessage.includes('temporarily rate-limited') ||
          errorMessage.includes('no endpoints found') ||
          errorMessage.includes('timeout') ||
          error?.statusCode === 429;

        if (isTemporaryError) {
          logger.error(`💥 جميع المزودين غير متاحين مؤقتاً: ${errorMessage}`);
          throw new Error(
            `⚠️ جميع المزودين غير متاحين مؤقتاً. يرجى المحاولة مرة أخرى لاحقاً. آخر خطأ: ${errorMessage}`
          );
        } else {
          logger.error(`💥 فشل في جميع المحاولات بعد ${fallbackCount + 1} محاولات`);
          logger.error(`🚫 لا توجد مزودات ذكاء اصطناعي متاحة حالياً`);
          throw new Error(`⚠️ فشل في الاتصال بجميع المزودين المتاحين. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى. آخر خطأ: ${errorMessage}`);
        }
      }
      
      // Try to get next fallback for next iteration
      try {
        const fallback = await fallbackManager.getNextFallbackModel(currentModelDetails.name, provider.name, {
          apiKeys,
          providerSettings,
          serverEnv,
        });

        if (fallback) {
          provider = fallback.provider;
          const fallbackStaticModels = LLMManager.getInstance().getStaticModelListFromProvider(fallback.provider);
          let fallbackModelDetails = fallbackStaticModels.find((m) => m.name === fallback.model);

          if (!fallbackModelDetails) {
            const fallbackModelsList = await LLMManager.getInstance().getModelListFromProvider(fallback.provider, {
              apiKeys,
              providerSettings,
              serverEnv: serverEnv as any,
            });
            fallbackModelDetails = fallbackModelsList.find((m) => m.name === fallback.model);
          }

          if (fallbackModelDetails) {
            currentModelDetails = fallbackModelDetails;
            fallbackCount++;
            continue;
          }
        }
      } catch (fallbackError) {
        logger.error('Error getting fallback:', fallbackError);
      }
      
      // No more fallbacks available
      throw error;
    }
  }

  // If we reach here, all attempts failed
  throw new Error('⚠️ فشل في الاتصال بجميع المزودين المتاحين. يرجى المحاولة مرة أخرى لاحقاً.');
}
