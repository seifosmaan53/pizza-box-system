import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/store/ui';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { toggleAiChat, setKeyboardHelpOpen } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // ? — Show keyboard shortcuts help
      if (e.key === '?' && !isMod) {
        e.preventDefault();
        setKeyboardHelpOpen(true);
        return;
      }

      // / — Focus search (if one exists on page)
      if (e.key === '/' && !isMod) {
        const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      // Escape — Close panels/modals
      if (e.key === 'Escape') {
        setKeyboardHelpOpen(false);
        return;
      }

      // g + key — "Go to" navigation (pressed in quick succession)
      // We use Alt+key for reliability
      if (e.altKey && !e.shiftKey) {
        switch (e.key) {
          case 'd': e.preventDefault(); navigate('/'); break;
          case 's': e.preventDefault(); navigate('/stores'); break;
          case 'i': e.preventDefault(); navigate('/invoices'); break;
          case 'w': e.preventDefault(); navigate('/inventory/warehouse'); break;
          case 'a': e.preventDefault(); navigate('/analytics'); break;
          case 'p': e.preventDefault(); navigate('/profile'); break;
          case 'c': e.preventDefault(); toggleAiChat(); break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, toggleAiChat, setKeyboardHelpOpen]);
}
