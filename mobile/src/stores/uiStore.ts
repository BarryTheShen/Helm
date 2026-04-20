import { create } from 'zustand';
import Toast from 'react-native-toast-message';

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

  showError: (message, retry) => {
    set({ errorBanner: { message, retry } });
    Toast.show({ type: 'error', text1: message });
  },

  hideError: () => set({ errorBanner: null }),
}));
