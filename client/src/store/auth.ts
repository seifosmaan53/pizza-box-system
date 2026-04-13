import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthStore {
  accessToken: string | null;
  user: AuthUser | null;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

// User is persisted to localStorage; accessToken is in-memory only.
// We use two separate stores to achieve this.

// In-memory store for access token (never persisted)
const tokenStore = { token: null as string | null };

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,

      setAccessToken: (token) => {
        tokenStore.token = token;
        set({ accessToken: token });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        tokenStore.token = null;
        set({ accessToken: null, user: null });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist `user`, not `accessToken`
      partialize: (state) => ({ user: state.user }),
    }
  )
);

// Utility to get raw token without subscribing
export const getAccessToken = () => tokenStore.token;
