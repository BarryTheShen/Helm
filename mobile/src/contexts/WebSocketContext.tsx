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

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { WebSocketService } from '@/services/websocket';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const WebSocketContext = createContext<WebSocketService | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token, serverUrl } = useAuthStore();
  const { setConnected, showError, hideError } = useUIStore();
  const [ws, setWs] = useState<WebSocketService | null>(null);

  useEffect(() => {
    if (!token || !serverUrl) return;

    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    const service = new WebSocketService(wsUrl, token);

    service.onConnect(() => {
      setConnected(true);
      hideError();
    });

    service.onDisconnect(() => {
      setConnected(false);
      showError('Connection lost', () => service.connect());
    });

    service.connect();
    setWs(service);

    return () => {
      service.disconnect();
      setWs(null);
    };
  }, [token, serverUrl]);

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
