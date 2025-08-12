import React from 'react';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'primary' | 'secondary' | 'white';
}

export function LoadingSpinner({ size = 'md', className, color = 'primary' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'text-bolt-elements-button-primary-background',
    secondary: 'text-bolt-elements-textSecondary',
    white: 'text-white',
  };

  return (
    <div className={classNames('animate-spin', sizeClasses[size], colorClasses[color], className)}>
      <div className="i-ph:spinner" />
    </div>
  );
}

interface LoadingDotsProps {
  className?: string;
  color?: 'primary' | 'secondary' | 'white';
}

export function LoadingDots({ className, color = 'primary' }: LoadingDotsProps) {
  const colorClasses = {
    primary: 'bg-bolt-elements-button-primary-background',
    secondary: 'bg-bolt-elements-textSecondary',
    white: 'bg-white',
  };

  return (
    <div className={classNames('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={classNames('w-2 h-2 rounded-full animate-pulse', colorClasses[color])}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  avatar?: boolean;
}

export function LoadingSkeleton({ className, lines = 3, avatar = false }: LoadingSkeletonProps) {
  return (
    <div className={classNames('animate-pulse', className)}>
      {avatar && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-bolt-elements-bg-depth-3 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-bolt-elements-bg-depth-3 rounded w-1/3 mb-2" />
            <div className="h-3 bg-bolt-elements-bg-depth-3 rounded w-1/4" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div
              className="h-4 bg-bolt-elements-bg-depth-3 rounded"
              style={{
                width: `${Math.random() * 40 + 60}%`,
              }}
            />
            {i === lines - 1 && (
              <div
                className="h-4 bg-bolt-elements-bg-depth-3 rounded"
                style={{
                  width: `${Math.random() * 30 + 40}%`,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoadingStateProps {
  type?: 'spinner' | 'dots' | 'skeleton';
  message?: string;
  submessage?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export function LoadingState({
  type = 'spinner',
  message = 'جاري التحميل...',
  submessage,
  className,
  size = 'md',
  fullScreen = false,
}: LoadingStateProps) {
  const content = (
    <div
      className={classNames(
        'flex flex-col items-center justify-center text-center',
        fullScreen ? 'min-h-screen' : 'py-12',
        className,
      )}
    >
      <div className="mb-4">
        {type === 'spinner' && <LoadingSpinner size={size === 'sm' ? 'md' : size === 'lg' ? 'xl' : 'lg'} />}
        {type === 'dots' && <LoadingDots />}
        {type === 'skeleton' && <LoadingSkeleton lines={3} />}
      </div>

      {message && (
        <p
          className={classNames(
            'text-bolt-elements-textSecondary font-medium',
            size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base',
          )}
        >
          {message}
        </p>
      )}

      {submessage && (
        <p className={classNames('text-bolt-elements-textTertiary mt-2', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {submessage}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return <div className="fixed inset-0 bg-bolt-elements-bg-depth-1 z-50">{content}</div>;
  }

  return content;
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  };
  className?: string;
}

export function EmptyState({ icon = 'i-ph:folder-open', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={classNames('flex flex-col items-center justify-center text-center py-12', className)}>
      <div
        className={classNames(
          'w-16 h-16 rounded-full bg-bolt-elements-bg-depth-3 flex items-center justify-center mb-4',
          'text-bolt-elements-textTertiary',
        )}
      >
        <div className={classNames('text-2xl', icon)} />
      </div>

      <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">{title}</h3>

      {description && <p className="text-bolt-elements-textSecondary mb-6 max-w-sm">{description}</p>}

      {action && (
        <Button onClick={action.onClick} variant={action.variant || 'default'} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  onReset?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'حدث خطأ',
  description = 'عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
  error,
  onRetry,
  onReset,
  showDetails = false,
  className,
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message;

  return (
    <div className={classNames('flex flex-col items-center justify-center text-center py-12', className)}>
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <div className="i-ph:warning-circle text-2xl text-red-600 dark:text-red-400" />
      </div>

      <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">{title}</h3>

      <p className="text-bolt-elements-textSecondary mb-6 max-w-sm">{description}</p>

      {showDetails && errorMessage && (
        <details className="mb-6 max-w-md">
          <summary className="text-sm text-bolt-elements-textTertiary cursor-pointer hover:text-bolt-elements-textSecondary transition-colors">
            عرض تفاصيل الخطأ
          </summary>
          <div className="mt-2 p-3 bg-bolt-elements-bg-depth-2 rounded border text-xs font-mono text-bolt-elements-textTertiary text-left overflow-auto max-h-32">
            {errorMessage}
          </div>
        </details>
      )}

      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="default" size="sm">
            إعادة المحاولة
          </Button>
        )}

        {onReset && (
          <Button onClick={onReset} variant="outline" size="sm">
            إعادة تعيين
          </Button>
        )}

        {!onRetry && !onReset && (
          <Button onClick={() => window.location.reload()} variant="default" size="sm">
            إعادة تحميل الصفحة
          </Button>
        )}
      </div>
    </div>
  );
}

// Hook for managing loading states
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [error, setError] = React.useState<Error | string | null>(null);

  const startLoading = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  const setLoadingError = React.useCallback((error: Error | string) => {
    setIsLoading(false);
    setError(error);
  }, []);

  const reset = React.useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  const executeAsync = React.useCallback(
    async (
      asyncFn: () => Promise<any>,
      options?: {
        onSuccess?: (result: any) => void;
        onError?: (error: Error) => void;
      },
    ): Promise<any> => {
      try {
        startLoading();

        const result = await asyncFn();
        stopLoading();
        options?.onSuccess?.(result);

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setLoadingError(error);
        options?.onError?.(error);

        return null;
      }
    },
    [startLoading, stopLoading, setLoadingError],
  );

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setError: setLoadingError,
    reset,
    executeAsync,
  };
}

export default {
  LoadingSpinner,
  LoadingDots,
  LoadingSkeleton,
  LoadingState,
  EmptyState,
  ErrorState,
  useLoadingState,
};
