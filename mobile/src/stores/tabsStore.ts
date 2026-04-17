import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TabModuleConfig {
  name: string;
  icon: string;
}

interface TabsState {
  hiddenTabs: string[];
  moduleConfigs: Record<string, TabModuleConfig>;
  enabledTabIds: string[];
  setHiddenTabs: (tabs: string[]) => void;
  setModuleConfigs: (configs: Record<string, TabModuleConfig>) => void;
  setEnabledTabIds: (ids: string[]) => Promise<void>;
  loadEnabledTabIds: () => Promise<void>;
  toggleTabEnabled: (tabId: string) => Promise<void>;
}

const STORAGE_KEY = 'enabled_tab_ids';
const DEFAULT_TABS = ['home', 'chat', 'calendar', 'settings'];

export const useTabsStore = create<TabsState>((set, get) => ({
  hiddenTabs: [],
  moduleConfigs: {},
  enabledTabIds: DEFAULT_TABS,

  setHiddenTabs: (tabs) => set({ hiddenTabs: tabs }),

  setModuleConfigs: (configs) => set({ moduleConfigs: configs }),

  setEnabledTabIds: async (ids) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      set({ enabledTabIds: ids });
    } catch (error) {
      console.error('Failed to save enabled tab IDs:', error);
    }
  },

  loadEnabledTabIds: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        set({ enabledTabIds: ids });
      }
    } catch (error) {
      console.error('Failed to load enabled tab IDs:', error);
    }
  },

  toggleTabEnabled: async (tabId: string) => {
    const { enabledTabIds, setEnabledTabIds } = get();
    const isEnabled = enabledTabIds.includes(tabId);

    if (isEnabled) {
      // Remove from enabled list
      const newIds = enabledTabIds.filter(id => id !== tabId);
      await setEnabledTabIds(newIds);
    } else {
      // Add to enabled list
      const newIds = [...enabledTabIds, tabId];
      await setEnabledTabIds(newIds);
    }
  },
}));
