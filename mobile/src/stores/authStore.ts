import { create } from 'zustand';
import storage from '@/utils/storage';
import type { User } from '@/types/api';

interface AuthState {
  token: string | null;
  user: User | null;
  serverUrl: string | null;
  isLoading: boolean;

  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

  setUser: async (user) => {
    if (user) {
      await storage.setItem('username', user.username);
    } else {
      await storage.removeItem('username');
    }
    set({ user });
  },

  setServerUrl: async (url) => {
    await storage.setItem('server_url', url);
    set({ serverUrl: url });
  },

  logout: async () => {
    const { token, serverUrl } = get();
    if (token && serverUrl) {
      try {
        await fetch(`${serverUrl}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {
        // Server unreachable — still clear local state
      }
    }
    await storage.removeItem('auth_token');
    await storage.removeItem('username');
    set({ token: null, user: null });
  },

  initialize: async () => {
    try {
      const [token, serverUrl, username] = await Promise.all([
        storage.getItem('auth_token'),
        storage.getItem('server_url'),
        storage.getItem('username'),
      ]);
      const user = token && username ? { id: '', username, created_at: '' } : null;
      set({ token, serverUrl, user, isLoading: false });
    } catch (error) {
      console.error('Failed to initialize auth store:', error);
      set({ isLoading: false });
    }
  },
}));
