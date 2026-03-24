import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  navigationMode: 'tabs' | 'drawer';
  theme: 'light' | 'dark' | 'auto';

  setNavigationMode: (mode: 'tabs' | 'drawer') => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'auto') => Promise<void>;
  initialize: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  navigationMode: 'tabs',
  theme: 'light',

  setNavigationMode: async (mode) => {
    await AsyncStorage.setItem('navigation_mode', mode);
    set({ navigationMode: mode });
  },

  setTheme: async (theme) => {
    await AsyncStorage.setItem('theme', theme);
    set({ theme });
  },

  initialize: async () => {
    try {
      const [navMode, theme] = await Promise.all([
        AsyncStorage.getItem('navigation_mode'),
        AsyncStorage.getItem('theme'),
      ]);

      set({
        navigationMode: (navMode as 'tabs' | 'drawer') || 'tabs',
        theme: (theme as 'light' | 'dark' | 'auto') || 'light',
      });
    } catch (error) {
      console.error('Failed to initialize settings store:', error);
    }
  },
}));
