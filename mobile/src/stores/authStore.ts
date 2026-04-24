import { create } from 'zustand';
import storage from '@/utils/storage';
import type { User } from '@/types/api';

interface AuthState {
  token: string | null;
  user: User | null;
  serverUrl: string | null;
  deviceId: string | null;
  isLoading: boolean;

  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  setDeviceId: (deviceId: string | null) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  serverUrl: null,
  deviceId: null,
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

  setDeviceId: async (deviceId) => {
    if (deviceId) {
      await storage.setItem('device_id', deviceId);
    } else {
      await storage.removeItem('device_id');
    }
    set({ deviceId });
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
    await storage.removeItem('device_id');
    set({ token: null, user: null, deviceId: null });
  },

  initialize: async () => {
    try {
      const [token, serverUrl, username, deviceId] = await Promise.all([
        storage.getItem('auth_token'),
        storage.getItem('server_url'),
        storage.getItem('username'),
        storage.getItem('device_id'),
      ]);

      // If we have credentials, validate the token is still valid
      if (token && serverUrl) {
        try {
          const response = await fetch(`${serverUrl}/api/sessions/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (!response.ok) {
            // Token is invalid - clear stale credentials
            console.log('Stored token is invalid, clearing credentials');
            await storage.removeItem('auth_token');
            await storage.removeItem('username');
            await storage.removeItem('device_id');
            set({ token: null, serverUrl, user: null, deviceId: null, isLoading: false });
            return;
          }
        } catch (error) {
          // Network error - keep credentials and let user retry
          console.log('Could not validate token (network error), keeping credentials');
        }
      }

      const user = token && username ? { id: '', username, created_at: '' } : null;
      set({ token, serverUrl, user, deviceId, isLoading: false });
    } catch (error) {
      console.error('Failed to initialize auth store:', error);
      set({ isLoading: false });
    }
  },
}));
