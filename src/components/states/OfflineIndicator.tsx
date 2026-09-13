import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '../shared/Button';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedBanner(true);
      setTimeout(() => {
        setShowReconnectedBanner(false);
      }, 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualRetry = () => {
    setIsRetrying(true);
    fetch('/api/health')
      .then(() => {
        setIsOnline(true);
        setShowReconnectedBanner(true);
        setTimeout(() => setShowReconnectedBanner(false), 3000);
      })
      .catch(() => {
        setIsOnline(false);
      })
      .finally(() => {
        setIsRetrying(false);
      });
  };

  if (isOnline && !showReconnectedBanner) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 animate-in slide-in-from-top duration-200">
      {!isOnline ? (
        <div 
          role="alert" 
          aria-live="assertive"
          className="bg-amber-600 text-white px-4 py-2.5 shadow-lg flex items-center justify-between text-xs font-semibold"
        >
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              <strong>Internet Connection Lost:</strong> Real-time queue updates and sound announcements are paused until reconnected.
            </span>
          </div>
          <Button
            type="button"
            variant="Secondary"
            size="sm"
            onClick={handleManualRetry}
            disabled={isRetrying}
            isLoading={isRetrying}
            className="shrink-0 bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            Retry
          </Button>
        </div>
      ) : (
        <div 
          role="status" 
          aria-live="polite"
          className="bg-emerald-600 text-white px-4 py-2 shadow-lg flex items-center justify-center gap-2 text-xs font-bold"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Connection restored. Real-time medical queue synchronization is active.</span>
        </div>
      )}
    </div>
  );
};
