import { useEffect, useState, useCallback, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api/auth';

const WARNING_BEFORE_MS = 5 * 60 * 1000; // Show warning 5 min before expiry

function decodeTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function SessionTimeoutWarning() {
  const { accessToken, setAccessToken, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [extending, setExtending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    const expMs = decodeTokenExp(accessToken);
    if (!expMs) return;

    const now = Date.now();
    const timeUntilWarning = expMs - now - WARNING_BEFORE_MS;

    if (timeUntilWarning <= 0) {
      // Already within warning window
      setShowWarning(true);
      setRemainingSeconds(Math.max(0, Math.floor((expMs - now) / 1000)));
    } else {
      timerRef.current = setTimeout(() => {
        setShowWarning(true);
        setRemainingSeconds(Math.floor(WARNING_BEFORE_MS / 1000));
      }, timeUntilWarning);
    }

    return clearTimers;
  }, [accessToken, clearTimers]);

  // Countdown when warning is visible
  useEffect(() => {
    if (!showWarning) return;
    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimers();
          setShowWarning(false);
          logout();
          window.location.href = '/login';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [showWarning, clearTimers, logout]);

  const handleExtend = async () => {
    setExtending(true);
    try {
      const data = await authApi.refresh();
      setAccessToken(data.accessToken);
      setShowWarning(false);
    } catch {
      logout();
      window.location.href = '/login';
    } finally {
      setExtending(false);
    }
  };

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 text-center">
        <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4">
          <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Session Expiring Soon
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your session will expire in{' '}
          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Any unsaved work will be lost if you don't extend your session.
        </p>
        <div className="mt-5 flex gap-3 justify-center">
          <button
            onClick={() => { logout(); window.location.href = '/login'; }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Log Out
          </button>
          <button
            onClick={handleExtend}
            disabled={extending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {extending ? 'Extending...' : 'Extend Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
