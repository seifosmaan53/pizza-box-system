import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Warns the user when navigating away from a page with unsaved changes.
 * Uses React Router's useBlocker for in-app navigation and beforeunload for tab close.
 */
export function useUnsavedChanges(isDirty: boolean) {
  // Block in-app navigation
  const blocker = useBlocker(isDirty);

  // Handle browser close/refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return blocker;
}
