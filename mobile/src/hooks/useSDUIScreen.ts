/**
 * useSDUIScreen — fetches the AI-generated SDUI screen for a given module and
 * keeps it in sync with live WebSocket updates.
 *
 * Usage:
 *   const { screen, loading, error, refresh } = useSDUIScreen('calendar');
 *
 * - If screen is null, the tab should render its default fallback UI.
 * - If screen is non-null, the tab should render SDUIScreenRenderer.
 * - The screen state updates in real-time when the AI calls helm_set_screen or
 *   helm_delete_screen via the shared WebSocket connection.
 */

import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import type { SDUIScreen } from '@/types/sdui';

interface SDUIScreenState {
  screen: SDUIScreen | null;
  draft: SDUIScreen | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSDUIScreen(moduleId: string): SDUIScreenState {
  const { token, serverUrl, logout } = useAuthStore();
  const ws = useWebSocket();
  const [screen, setScreen] = useState<SDUIScreen | null>(null);
  const [draft, setDraft] = useState<SDUIScreen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScreen = useCallback(async () => {
    if (!token || !serverUrl) return;
    setLoading(true);
    setError(null);
    try {
      const api = new ApiClient(serverUrl, token, logout);
      const [screenData, draftData] = await Promise.all([
        api.getSDUIScreen(moduleId),
        api.getSDUIDraft(moduleId),
      ]);
      setScreen((screenData.screen as unknown as SDUIScreen) ?? null);
      if (draftData.has_draft) {
        setDraft((draftData.screen as unknown as SDUIScreen) ?? null);
      }
    } catch (err) {
      setError('Failed to load screen');
    } finally {
      setLoading(false);
    }
  }, [moduleId, token, serverUrl, logout]);

  // Load on mount
  useEffect(() => {
    fetchScreen();
  }, [fetchScreen]);

  // Subscribe to live updates from the shared WebSocket
  useEffect(() => {
    if (!ws) return;

    const unsubscribe = ws.onMessage((message: any) => {
      if (message.type === 'sdui_screen_update' && message.module_id === moduleId) {
        // screen is null when the AI deletes the screen (helm_delete_screen)
        setScreen((message.screen as SDUIScreen) ?? null);
        setLoading(false);
      }
      if (message.type === 'sdui_draft_update' && message.module_id === moduleId) {
        setDraft((message.screen as SDUIScreen) ?? null);
      }
      if (message.type === 'sdui_draft_rejected' && message.module_id === moduleId) {
        setDraft(null);
      }
    });

    return unsubscribe;
  }, [ws, moduleId]);

  return { screen, draft, loading, error, refresh: fetchScreen };
}
