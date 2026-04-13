import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[110] flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
        isOffline
          ? 'bg-red-600 text-white'
          : 'bg-green-600 text-white'
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Some features may not work.</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4" />
          <span>Back online!</span>
        </>
      )}
    </div>
  );
}
