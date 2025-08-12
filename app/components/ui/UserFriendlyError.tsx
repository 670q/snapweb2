import React from 'react';
import { Button } from './Button';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

interface UserFriendlyErrorProps {
  error?: Error | string;
  title?: string;
  description?: string;
  type?: 'network' | 'authentication' | 'rate_limit' | 'quota' | 'server' | 'unknown';
  provider?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
  retryAfter?: number;
  suggestions?: string[];
}

const ERROR_MESSAGES = {
  network: {
    title: 'مشكلة في الاتصال',
    description: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
    icon: 'i-ph:wifi-x-bold',
    suggestions: ['تحقق من اتصال الإنترنت', 'أعد تحميل الصفحة', 'حاول مرة أخرى خلال دقائق قليلة'],
  },
  authentication: {
    title: 'خطأ في المصادقة',
    description: 'مفتاح API غير صحيح أو منتهي الصلاحية. يرجى التحقق من إعدادات API.',
    icon: 'i-ph:key-bold',
    suggestions: ['تحقق من مفتاح API في الإعدادات', 'تأكد من صحة المفتاح', 'تحقق من صلاحية المفتاح'],
  },
  rate_limit: {
    title: 'تم تجاوز حد المعدل',
    description: 'تم إرسال طلبات كثيرة جداً. يرجى الانتظار قبل المحاولة مرة أخرى.',
    icon: 'i-ph:clock-bold',
    suggestions: ['انتظر قليلاً قبل المحاولة مرة أخرى', 'قلل من عدد الطلبات', 'جرب مزود خدمة آخر'],
  },
  quota: {
    title: 'تم تجاوز الحصة المسموحة',
    description: 'تم استنفاد الحصة المسموحة لهذا المزود. يرجى المحاولة لاحقاً أو استخدام مزود آخر.',
    icon: 'i-ph:gauge-bold',
    suggestions: ['جرب مزود خدمة آخر', 'انتظر حتى تجديد الحصة', 'ترقية خطة الاشتراك إذا أمكن'],
  },
  server: {
    title: 'خطأ في الخادم',
    description: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً.',
    icon: 'i-ph:server-bold',
    suggestions: ['أعد المحاولة خلال دقائق قليلة', 'تحقق من حالة الخدمة', 'جرب مزود خدمة آخر'],
  },
  unknown: {
    title: 'حدث خطأ غير متوقع',
    description: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
    icon: 'i-ph:warning-circle-bold',
    suggestions: ['أعد المحاولة', 'أعد تحميل الصفحة', 'تواصل مع الدعم الفني إذا استمر الخطأ'],
  },
};

export function UserFriendlyError({
  error,
  title,
  description,
  type = 'unknown',
  provider,
  onRetry,
  onDismiss,
  showDetails = false,
  className,
  retryAfter,
  suggestions,
}: UserFriendlyErrorProps) {
  const errorConfig = ERROR_MESSAGES[type];
  const displayTitle = title || errorConfig.title;
  const displayDescription = description || errorConfig.description;
  const displaySuggestions = suggestions || errorConfig.suggestions;

  const errorMessage = typeof error === 'string' ? error : error?.message;

  const handleCopyError = () => {
    const errorDetails = {
      title: displayTitle,
      description: displayDescription,
      provider,
      type,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    };

    navigator.clipboard
      .writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        toast.success('تم نسخ تفاصيل الخطأ', {
          position: 'top-right',
          autoClose: 2000,
        });
      })
      .catch(() => {
        toast.error('فشل في نسخ تفاصيل الخطأ', {
          position: 'top-right',
          autoClose: 2000,
        });
      });
  };

  const formatRetryTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} ثانية`;
    } else if (seconds < 3600) {
      return `${Math.ceil(seconds / 60)} دقيقة`;
    } else {
      return `${Math.ceil(seconds / 3600)} ساعة`;
    }
  };

  return (
    <div
      className={classNames(
        'bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg p-6',
        'max-w-md mx-auto',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={classNames('flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center', {
            'bg-yellow-100 dark:bg-yellow-900/30': type === 'authentication',
            'bg-orange-100 dark:bg-orange-900/30': type === 'rate_limit',
            'bg-purple-100 dark:bg-purple-900/30': type === 'quota',
            'bg-blue-100 dark:bg-blue-900/30': type === 'network',
            'bg-red-100 dark:bg-red-900/30': type === 'server',
            'bg-gray-100 dark:bg-gray-900/30': type === 'unknown',
          })}
        >
          <div
            className={classNames(
              'text-xl',
              {
                'text-yellow-600 dark:text-yellow-400': type === 'authentication',
                'text-orange-600 dark:text-orange-400': type === 'rate_limit',
                'text-purple-600 dark:text-purple-400': type === 'quota',
                'text-blue-600 dark:text-blue-400': type === 'network',
                'text-red-600 dark:text-red-400': type === 'server',
                'text-gray-600 dark:text-gray-400': type === 'unknown',
              },
              errorConfig.icon,
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-1">{displayTitle}</h3>
          {provider && <p className="text-sm text-bolt-elements-textSecondary mb-2">المزود: {provider}</p>}
          <p className="text-bolt-elements-textSecondary leading-relaxed">{displayDescription}</p>

          {retryAfter && (
            <p className="text-sm text-bolt-elements-textTertiary mt-2">
              يمكن المحاولة مرة أخرى خلال: {formatRetryTime(retryAfter)}
            </p>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary transition-colors"
            aria-label="إغلاق"
          >
            <div className="i-ph:x text-lg" />
          </button>
        )}
      </div>

      {/* Suggestions */}
      {displaySuggestions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">اقتراحات للحل:</h4>
          <ul className="space-y-1">
            {displaySuggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-bolt-elements-textSecondary">
                <div className="i-ph:check-circle text-green-500 mt-0.5 flex-shrink-0" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error Details */}
      {showDetails && errorMessage && (
        <details className="mb-4">
          <summary className="text-sm font-medium text-bolt-elements-textSecondary cursor-pointer hover:text-bolt-elements-textPrimary transition-colors">
            تفاصيل الخطأ التقنية
          </summary>
          <div className="mt-2 p-3 bg-bolt-elements-bg-depth-1 rounded border text-xs font-mono text-bolt-elements-textTertiary overflow-auto max-h-32">
            {errorMessage}
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="default"
            size="sm"
            disabled={retryAfter ? retryAfter > 0 : false}
            className="flex-1 min-w-0"
          >
            {retryAfter && retryAfter > 0 ? `إعادة المحاولة خلال ${formatRetryTime(retryAfter)}` : 'إعادة المحاولة'}
          </Button>
        )}

        {showDetails && (
          <Button onClick={handleCopyError} variant="secondary" size="sm" className="flex items-center gap-2">
            <div className="i-ph:copy" />
            نسخ التفاصيل
          </Button>
        )}

        <Button
          onClick={() => window.location.reload()}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
        >
          <div className="i-ph:arrow-clockwise" />
          إعادة تحميل
        </Button>
      </div>
    </div>
  );
}

// Hook for easy error display
export function useUserFriendlyError() {
  const showError = React.useCallback((errorProps: Omit<UserFriendlyErrorProps, 'onDismiss'>) => {
    const errorId = `error-${Date.now()}`;

    toast.error(
      <UserFriendlyError
        {...errorProps}
        onDismiss={() => toast.dismiss(errorId)}
        className="!bg-transparent !border-0 !p-0 !max-w-none"
      />,
      {
        toastId: errorId,
        position: 'top-center',
        autoClose: false,
        closeButton: false,
        className: '!bg-transparent !p-0',
        bodyClassName: '!p-0',
      },
    );

    return errorId;
  }, []);

  const dismissError = React.useCallback((errorId: string) => {
    toast.dismiss(errorId);
  }, []);

  return { showError, dismissError };
}

export default UserFriendlyError;
