import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  sidebarCollapsed: boolean;
  darkMode: boolean;
  aiChatOpen: boolean;
  keyboardHelpOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  toggleAiChat: () => void;
  setAiChatOpen: (open: boolean) => void;
  setKeyboardHelpOpen: (open: boolean) => void;
}

function applyDarkMode(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  try {
    localStorage.setItem('darkMode', dark ? 'true' : 'false');
  } catch {
    // ignore
  }
}

// Read initial dark mode preference
const savedDark = (() => {
  try {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
})();

// Apply on module load
applyDarkMode(savedDark);

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      darkMode: savedDark,
      aiChatOpen: false,
      keyboardHelpOpen: false,

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleDarkMode: () => {
        const next = !get().darkMode;
        applyDarkMode(next);
        set({ darkMode: next });
      },

      setDarkMode: (value) => {
        applyDarkMode(value);
        set({ darkMode: value });
      },

      toggleAiChat: () =>
        set((state) => ({ aiChatOpen: !state.aiChatOpen })),

      setAiChatOpen: (open) => set({ aiChatOpen: open }),

      setKeyboardHelpOpen: (open) => set({ keyboardHelpOpen: open }),

    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        darkMode: state.darkMode,
      }),
    }
  )
);
