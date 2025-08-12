import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { toast } from 'react-toastify';
import { Button } from './Button';
import { classNames } from '~/utils/classNames';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error safely without exposing sensitive information
    const sanitizedError = {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
      componentStack: errorInfo.componentStack?.split('\n').slice(0, 3).join('\n'),
      timestamp: new Date().toISOString(),
    };

    console.error('ErrorBoundary caught an error:', sanitizedError);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Show user-friendly toast notification
    toast.error('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.', {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
      });
    } else {
      toast.error('تم الوصول للحد الأقصى من المحاولات. يرجى إعادة تحميل الصفحة.');
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          className={classNames(
            'flex flex-col items-center justify-center min-h-[400px] p-8 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor',
            this.props.className,
          )}
        >
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-2">حدث خطأ غير متوقع</h2>
          <p className="text-bolt-elements-textSecondary text-center mb-6 max-w-md">
            نعتذر، حدث خطأ أثناء تحميل هذا الجزء من التطبيق. يمكنك المحاولة مرة أخرى أو إعادة تحميل الصفحة.
          </p>

          {this.props.showErrorDetails && this.state.error && (
            <details className="mb-6 p-4 bg-bolt-elements-background-depth-2 rounded border border-bolt-elements-borderColor max-w-2xl">
              <summary className="cursor-pointer text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
                تفاصيل الخطأ (للمطورين)
              </summary>
              <div className="mt-2 text-sm font-mono text-bolt-elements-textSecondary">
                <div className="mb-2">
                  <strong>الرسالة:</strong> {this.state.error.message}
                </div>
                {this.state.error.stack && (
                  <div className="mb-2">
                    <strong>المكدس:</strong>
                    <pre className="mt-1 text-xs overflow-auto max-h-32">
                      {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex gap-3">
            {this.state.retryCount < this.maxRetries && (
              <Button onClick={this.handleRetry} variant="default" size="sm">
                المحاولة مرة أخرى ({this.maxRetries - this.state.retryCount} محاولات متبقية)
              </Button>
            )}
            <Button onClick={this.handleReload} variant="outline" size="sm">
              إعادة تحميل الصفحة
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Hook version for functional components
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    const sanitizedError = {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      timestamp: new Date().toISOString(),
      ...errorInfo,
    };

    console.error('Error caught by useErrorHandler:', sanitizedError);

    toast.error('حدث خطأ أثناء العملية. يرجى المحاولة مرة أخرى.', {
      position: 'top-right',
      autoClose: 5000,
    });
  }, []);

  return { handleError };
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>,
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
