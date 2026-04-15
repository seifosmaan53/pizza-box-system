import { useEffect } from 'react';

/**
 * Warns the user when navigating away from a page with unsaved changes.
 * Uses the browser's native beforeunload event for both tab close and refresh.
 * Compatible with classic <BrowserRouter> (no data router required).
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
