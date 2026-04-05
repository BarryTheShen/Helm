import { create } from 'zustand';

export interface TabModuleConfig {
  name: string;
  icon: string;
}

interface TabsState {
  hiddenTabs: string[];
  moduleConfigs: Record<string, TabModuleConfig>;
  setHiddenTabs: (tabs: string[]) => void;
  setModuleConfigs: (configs: Record<string, TabModuleConfig>) => void;
}

export const useTabsStore = create<TabsState>((set) => ({
  hiddenTabs: [],
  moduleConfigs: {},
  setHiddenTabs: (tabs) => set({ hiddenTabs: tabs }),
  setModuleConfigs: (configs) => set({ moduleConfigs: configs }),
}));
