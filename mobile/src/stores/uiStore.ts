import { create } from 'zustand';

interface UIState {
  isConnected: boolean;
  errorBanner: { message: string; retry?: () => void } | null;

  setConnected: (connected: boolean) => void;
  showError: (message: string, retry?: () => void) => void;
  hideError: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isConnected: true,
  errorBanner: null,

  setConnected: (connected) => set({ isConnected: connected }),

  showError: (message, retry) => set({ errorBanner: { message, retry } }),

  hideError: () => set({ errorBanner: null }),
}));
