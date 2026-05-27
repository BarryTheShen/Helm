/**
 * WebSocketContext — provides a single shared WebSocket connection to all
 * tab screens.  Prevents multiple concurrent connections from the same session.
 *
 * Why: each tab was creating its own WebSocketService on mount, leading to
 * N duplicate connections.  A single shared connection lets all tabs subscribe
 * to the message stream via useWebSocket().
 *
 * The ws instance is stable (same object reference for the lifetime of the
 * auth session) so useWebSocket() consumers never need to re-subscribe unless
 * the token/serverUrl changes.
 */

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { WebSocketService } from '@/services/websocket';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { usePreviewStore } from '@/stores/previewStore';

const WebSocketContext = createContext<WebSocketService | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, serverUrl, deviceId } = useAuthStore();
  const { setConnected, showError, hideError } = useUIStore();
  const { loadAppConfig, updateFromWebSocket } = useAppConfigStore();
  const [ws, setWs] = useState<WebSocketService | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token || !serverUrl) return;

    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    const service = new WebSocketService(wsUrl, token);

    // Two-phase disconnect feedback:
    //   500ms  → subtle "Reconnecting..." banner
    //   3 consecutive close events → "Connection lost" with manual retry
    // ReconnectingWebSocket fires 'close' on every failed attempt, so we
    // count consecutive disconnects to decide when to escalate.
    let disconnectCount = 0;
    const MAX_SOFT_RETRIES = 3;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    service.onConnect(() => {
      clearReconnectTimer();
      disconnectCount = 0;
      setConnected(true);
      hideError();
    });

    service.onDisconnect(() => {
      setConnected(false);
      disconnectCount++;

      if (disconnectCount >= MAX_SOFT_RETRIES) {
        // Retries exhausted — escalate to hard error with manual retry
        clearReconnectTimer();
        showError('Connection lost. Please check your connection or try logging in again.', () => {
          disconnectCount = 0;
          hideError();
          service.connect();
        });
      } else if (!reconnectTimerRef.current) {
        // First disconnect — show soft banner after 500ms
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          showError('Reconnecting…');
        }, 500);
      }
    });

    // Handle WebSocket events
    let lastPublishedVersion: string | null = null;

    service.onMessage((message: any) => {
      if (message.type === 'device_app_assigned' && message.device_id === deviceId) {
        // App has been assigned to this device
        if (serverUrl && token && deviceId) {
          loadAppConfig(serverUrl, token, deviceId).then(() => {
            router.replace('/(tabs)/home');
          }).catch((error) => {
            console.error('Failed to load app config after assignment:', error);
          });
        }
      } else if (message.type === 'app_config_update' && message.config) {
        // App config has been updated
        updateFromWebSocket(message.config);
      } else if (message.type === 'preview_session_started' && message.session_id) {
        // Admin started a device preview
        usePreviewStore.getState().enterPreview(message.session_id);
      } else if (message.type === 'preview_session_ended') {
        // Admin ended the preview session
        usePreviewStore.getState().exitPreview();
      } else if (message.type === 'app_version_published' && message.version_number) {
        // A new app version was published — reload config immediately (FF4-APP-004)
        // NOTE: Backend sends version_number (int), not a "version" string.
        // The display_name contains the full human-readable version label.
        const versionLabel = message.version_number;
        const displayName: string | undefined = message.display_name;
        const assignedAppId = useAppConfigStore.getState().appConfig?.app_id;
        const targetsThisDevice =
          !message.app_id || !assignedAppId || message.app_id === assignedAppId;
        if (targetsThisDevice && serverUrl && token && deviceId) {
          loadAppConfig(serverUrl, token, deviceId).catch((err) =>
            console.error('Failed to reload app config after publish:', err)
          );
        }
        if (lastPublishedVersion !== String(versionLabel)) {
          lastPublishedVersion = String(versionLabel);
          Toast.show({
            type: 'info',
            text1: displayName
              ? `🔄 ${displayName}`
              : `🔄 App updated to v${versionLabel}`,
            text2: 'Your app has been updated',
            visibilityTime: 5000,
          });
        }
      }
    });

    service.connect();
    setWs(service);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      service.disconnect();
      setWs(null);
    };
  }, [token, serverUrl, deviceId]);

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

/** Returns the shared WebSocket service, or null before auth is ready. */
export function useWebSocket(): WebSocketService | null {
  return useContext(WebSocketContext);
}
