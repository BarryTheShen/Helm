import { create } from 'zustand';
import storage from '@/utils/storage';
import type { User } from '@/types/api';

interface AuthState {
  token: string | null;
  user: User | null;
  serverUrl: string | null;
  isLoading: boolean;

  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  setServerUrl: (url: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  serverUrl: null,
  isLoading: true,

  setToken: async (token) => {
    if (token) {
      await storage.setItem('auth_token', token);
    } else {
      await storage.removeItem('auth_token');
    }
    set({ token });
  },

  setUser: (user) => set({ user }),

  setServerUrl: async (url) => {
    await storage.setItem('server_url', url);
    set({ serverUrl: url });
  },

  logout: async () => {
    await storage.removeItem('auth_token');
    set({ token: null, user: null });
  },

  initialize: async () => {
    try {
      const [token, serverUrl] = await Promise.all([
        storage.getItem('auth_token'),
        storage.getItem('server_url'),
      ]);
      set({ token, serverUrl, isLoading: false });
    } catch (error) {
      console.error('Failed to initialize auth store:', error);
      set({ isLoading: false });
    }
  },
}));
