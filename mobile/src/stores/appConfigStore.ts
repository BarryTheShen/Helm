import { create } from 'zustand';

export interface ModuleInstanceConfig {
  module_instance_id: string;
  module_type: string;
  name: string;
  icon: string;
  slot_position: number | null;
}

export interface AppConfig {
  app_id: string;
  name: string;
  icon: string | null;
  splash: string | null;
  theme: Record<string, any>;
  design_tokens: Record<string, any>;
  dark_mode: boolean;
  default_launch_module_id: string | null;
  bottom_bar_config: ModuleInstanceConfig[];
  launchpad_config: ModuleInstanceConfig[];
}

interface AppConfigState {
  appConfig: AppConfig | null;
  isLoading: boolean;
  error: string | null;

  loadAppConfig: (serverUrl: string, token: string, deviceId: string) => Promise<void>;
  updateFromWebSocket: (config: AppConfig) => void;
  clearAppConfig: () => void;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  appConfig: null,
  isLoading: false,
  error: null,

  loadAppConfig: async (serverUrl: string, token: string, deviceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${serverUrl}/api/devices/${deviceId}/config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Device not found or no app assigned');
        }
        throw new Error(`Failed to fetch app config: ${response.statusText}`);
      }

      const config = await response.json();
      set({ appConfig: config, isLoading: false, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load app config';
      set({ appConfig: null, isLoading: false, error: errorMessage });
      throw error;
    }
  },

  updateFromWebSocket: (config: AppConfig) => {
    set({ appConfig: config, error: null });
  },

  clearAppConfig: () => {
    set({ appConfig: null, isLoading: false, error: null });
  },
}));
