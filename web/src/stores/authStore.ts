import { create } from 'zustand';
import { api } from '../lib/api';

interface AuthState {
  token: string | null;
  user: { id: string; username: string; role: string } | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const clearAuthState = () => {
    console.log('[Auth] clearAuthState — logged out');
    api.setToken(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    set({ token: null, user: null, isLoading: false });
  };

  api.setUnauthorizedHandler(clearAuthState);

  return {
    token: null,
    user: null,
    isLoading: true,
    login: async (username, password) => {
      console.log('[Auth] login() — user:', username);
      try {
        const data = await api.post<{ session_token: string; user_id: string; username: string; role: string }>(
          '/auth/login',
          {
            username,
            password,
            device_name: 'Admin Panel',
            device_id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : String(Date.now()),
          },
          {
            includeAuth: false,
            suppressUnauthorizedHandler: true,
          },
        );
        const token = data.session_token;
        api.setToken(token);
        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_user', JSON.stringify({ id: data.user_id, username: data.username, role: data.role }));
        console.log(`[Auth] login() — success: ${data.username} (${data.role})`);
        set({ token, user: { id: data.user_id, username: data.username, role: data.role }, isLoading: false });
      } catch (err) {
        console.error('[Auth] login() — failed:', err instanceof Error ? err.message : err);
        throw err;
      }
    },
    logout: () => {
      console.log('[Auth] logout()');
      void api.post('/auth/logout').catch(() => {});
      clearAuthState();
    },
    initialize: () => {
      const token = localStorage.getItem('admin_token');
      if (token) {
        const user = JSON.parse(localStorage.getItem('admin_user') || 'null') as AuthState['user'];
        console.log(`[Auth] initialize() — found existing token, user: ${user?.username ?? 'unknown'}`);
        api.setToken(token);
        set({ token, user, isLoading: false });
      } else {
        console.log('[Auth] initialize() — no existing token');
        set({ isLoading: false });
      }
    },
  };
});
