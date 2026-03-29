import { create } from 'zustand';

interface TabsState {
  hiddenTabs: string[];
  setHiddenTabs: (tabs: string[]) => void;
}

export const useTabsStore = create<TabsState>((set) => ({
  hiddenTabs: [],
  setHiddenTabs: (tabs) => set({ hiddenTabs: tabs }),
}));
