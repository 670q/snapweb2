import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { LoadingSpinner } from '~/components/ui/LoadingStates';

interface ProviderSwitchIndicatorProps {
  isVisible: boolean;
  currentProvider?: string;
  targetProvider?: string;
  status: 'searching' | 'connecting' | 'connected' | 'failed';
  attempt?: number;
  maxAttempts?: number;
  onClose?: () => void;
}

export function ProviderSwitchIndicator({
  isVisible,
  currentProvider,
  targetProvider,
  status,
  attempt = 1,
  maxAttempts = 3,
  onClose,
}: ProviderSwitchIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'searching':
        return <LoadingSpinner size="sm" color="primary" />;
      case 'connecting':
        return <LoadingSpinner size="sm" color="primary" />;
      case 'connected':
        return <div className="i-ph:check-circle-fill text-green-500 text-lg" />;
      case 'failed':
        return <div className="i-ph:x-circle-fill text-red-500 text-lg" />;
      default:
        return <LoadingSpinner size="sm" color="primary" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'searching':
        return `🔍 البحث عن مزود بديل... (${attempt}/${maxAttempts})`;
      case 'connecting':
        return `🚀 الاتصال بـ ${targetProvider}...`;
      case 'connected':
        return `✅ تم الاتصال بنجاح بـ ${targetProvider}`;
      case 'failed':
        return `❌ فشل الاتصال بـ ${targetProvider}`;
      default:
        return 'جاري المعالجة...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'searching':
      case 'connecting':
        return 'border-blue-500 bg-blue-50 text-blue-700';
      case 'connected':
        return 'border-green-500 bg-green-50 text-green-700';
      case 'failed':
        return 'border-red-500 bg-red-50 text-red-700';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed top-4 right-4 z-50"
        >
          <div
            className={classNames(
              'flex items-center gap-3 px-4 py-3 rounded-lg border-2 shadow-lg backdrop-blur-sm',
              'min-w-[300px] max-w-[400px]',
              getStatusColor()
            )}
          >
            <div className="flex-shrink-0">{getStatusIcon()}</div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {getStatusMessage()}
              </div>
              
              {currentProvider && targetProvider && status === 'connecting' && (
                <div className="text-xs opacity-75 mt-1">
                  {currentProvider} → {targetProvider}
                </div>
              )}
              
              {status === 'searching' && (
                <div className="text-xs opacity-75 mt-1">
                  فحص المزودات المتاحة...
                </div>
              )}
            </div>
            
            {(status === 'connected' || status === 'failed') && onClose && (
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
                aria-label="إغلاق"
              >
                <div className="i-ph:x text-sm" />
              </button>
            )}
          </div>
          
          {/* Progress bar for connecting status */}
          {status === 'connecting' && (
            <motion.div
              className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for managing provider switch state
export function useProviderSwitchIndicator() {
  const [isVisible, setIsVisible] = React.useState(false);
  const [currentProvider, setCurrentProvider] = React.useState<string>();
  const [targetProvider, setTargetProvider] = React.useState<string>();
  const [status, setStatus] = React.useState<'searching' | 'connecting' | 'connected' | 'failed'>('searching');
  const [attempt, setAttempt] = React.useState(1);
  const [maxAttempts, setMaxAttempts] = React.useState(3);

  const showSearching = React.useCallback((currentProv?: string, maxAtt: number = 3) => {
    setCurrentProvider(currentProv);
    setMaxAttempts(maxAtt);
    setAttempt(1);
    setStatus('searching');
    setIsVisible(true);
  }, []);

  const showConnecting = React.useCallback((targetProv: string, currentProv?: string) => {
    setTargetProvider(targetProv);
    setCurrentProvider(currentProv);
    setStatus('connecting');
    setIsVisible(true);
  }, []);

  const showConnected = React.useCallback((targetProv: string) => {
    setTargetProvider(targetProv);
    setStatus('connected');
    setIsVisible(true);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  }, []);

  const showFailed = React.useCallback((targetProv?: string) => {
    setTargetProvider(targetProv);
    setStatus('failed');
    setIsVisible(true);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setIsVisible(false);
    }, 5000);
  }, []);

  const updateAttempt = React.useCallback((newAttempt: number) => {
    setAttempt(newAttempt);
  }, []);

  const hide = React.useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    currentProvider,
    targetProvider,
    status,
    attempt,
    maxAttempts,
    showSearching,
    showConnecting,
    showConnected,
    showFailed,
    updateAttempt,
    hide,
  };
}