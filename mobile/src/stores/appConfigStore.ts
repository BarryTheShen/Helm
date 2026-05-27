import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CACHED_CONFIG_KEY = 'cached_app_config';

interface AppConfigState {
  appConfig: AppConfig | null;
  isLoading: boolean;
  error: string | null;
  /** Timestamp of the last successful fetch. Null if never fetched. */
  lastSyncedAt: string | null;
  /** Whether we're serving a cached (offline) config. */
  isOffline: boolean;

  loadAppConfig: (serverUrl: string, token: string, deviceId: string) => Promise<void>;
  updateFromWebSocket: (config: Partial<AppConfig> & Record<string, unknown>) => void;
  clearAppConfig: () => void;
  /** Retrieve the cached config from AsyncStorage on app startup. */
  hydrateFromCache: () => Promise<void>;
}

export const useAppConfigStore = create<AppConfigState>((set, get) => ({
  appConfig: null,
  isLoading: false,
  error: null,
  lastSyncedAt: null,
  isOffline: false,

  /**
   * Load app config from the backend.
   *
   * FF4-EDGE-005: On success, the config is cached to AsyncStorage so it
   * survives app restarts. On failure, the LAST KNOWN GOOD config is kept
   * in state (not cleared to null), and the store switches to offline mode.
   *
   * FF4-EDGE-006: If the device encounters a render failure with the new
   * version, the old cached config remains available in AsyncStorage and
   * the store's appConfig field is NOT replaced until rendering succeeds.
   *
   * SECURITY CONSIDERATION (A6): The token is accepted as a plain-string
   * parameter from the caller (WebSocketContext). Ideally the store would
   * read the token internally from useAuthStore() to avoid passing it
   * through the call chain, but the current callers already hold the token
   * in their scope. This is a pragmatic trade-off: the token never leaves
   * the process boundary (it's used only in the Authorization header), and
   * the parameter pattern keeps the store testable without mocking auth.
   * If the security posture tightens, refactor to read token from authStore
   * inside this function instead of accepting it as a parameter.
   */
  loadAppConfig: async (serverUrl: string, token: string, deviceId: string) => {
    const { appConfig: currentConfig } = get();
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
      const now = new Date().toISOString();

      // Cache to AsyncStorage for offline support (FF4-EDGE-005)
      try {
        await AsyncStorage.setItem(
          CACHED_CONFIG_KEY,
          JSON.stringify({ config, syncedAt: now })
        );
      } catch (storageError) {
        console.warn('Failed to cache app config:', storageError);
      }

      set({
        appConfig: config,
        isLoading: false,
        error: null,
        lastSyncedAt: now,
        isOffline: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load app config';

      if (currentConfig) {
        // FF4-EDGE-006: Keep the last known good version on failure.
        // The user still sees the previous config until the next
        // successful fetch. Mark as offline so UI can show a banner.
        console.warn('App config fetch failed — keeping cached version:', errorMessage);
        set({
          isLoading: false,
          error: errorMessage,
          isOffline: true,
        });
      } else {
        // No cached config available — clear state
        set({
          appConfig: null,
          isLoading: false,
          error: errorMessage,
          isOffline: true,
        });
      }
      throw error;
    }
  },

  /**
   * Restore a previously cached app config from AsyncStorage.
   * Call this during app startup before the first fetch so the
   * UI can render immediately while the network request is in flight.
   */
  hydrateFromCache: async () => {
    try {
      const stored = await AsyncStorage.getItem(CACHED_CONFIG_KEY);
      if (stored) {
        const { config, syncedAt } = JSON.parse(stored);
        set({
          appConfig: config,
          lastSyncedAt: syncedAt,
          isOffline: false,
        });
      }
    } catch (error) {
      console.warn('Failed to hydrate app config from cache:', error);
    }
  },

  updateFromWebSocket: (config: Partial<AppConfig> & Record<string, unknown>) => {
    const now = new Date().toISOString();
    const current = get().appConfig;
    const merged = current
      ? { ...current, ...config, dark_mode: config.dark_mode ?? current.dark_mode }
      : (config as AppConfig);

    // Also cache WebSocket-updated config for offline use
    AsyncStorage.setItem(
      CACHED_CONFIG_KEY,
      JSON.stringify({ config: merged, syncedAt: now })
    ).catch((err) => console.warn('Failed to cache WS config:', err));
    set({ appConfig: merged, error: null, isOffline: false, lastSyncedAt: now });
  },

  clearAppConfig: () => {
    AsyncStorage.removeItem(CACHED_CONFIG_KEY).catch(() => {});
    set({
      appConfig: null,
      isLoading: false,
      error: null,
      lastSyncedAt: null,
      isOffline: false,
    });
  },
}));
