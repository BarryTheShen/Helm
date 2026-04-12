/**
 * useSDUIScreen — fetches the AI-generated SDUI screen for a given module and
 * keeps it in sync with live WebSocket updates.
 *
 * Usage:
 *   const { screen, loading, error, refresh } = useSDUIScreen('calendar');
 *
 * - If screen is null, the tab should render its default fallback UI.
 * - If screen is non-null, the tab should render SDUIUniversalRenderer.
 * - Supports both V1 (section-based SDUIScreen) and V2 (row-based SDUIPage).
 * - The screen state updates in real-time when the AI calls helm_set_screen or
 *   helm_delete_screen via the shared WebSocket connection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClient } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import type { SDUIPayload } from '@/types/sdui';

const INITIAL_VERSION = -1;

interface VersionedScreenResponse {
  screen: Record<string, unknown> | null;
  version?: number;
}

interface VersionedDraftResponse {
  screen: Record<string, unknown> | null;
  has_draft: boolean;
  version?: number;
}

interface VersionGuardOptions {
  nextVersion: number | null;
  currentVersion: number;
  startedVersion?: number;
  allowEqualVersion?: boolean;
  isLatestIfVersionMissing?: boolean;
}

interface ApplyVersionOptions {
  startedVersion?: number;
  allowEqualVersion?: boolean;
  isLatestIfVersionMissing?: boolean;
  clearDraft?: boolean;
}

interface SDUIScreenMessage {
  type?: string;
  module_id?: string;
  screen?: unknown;
  version?: unknown;
}

function normalizeVersion(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function shouldApplyVersion({
  nextVersion,
  currentVersion,
  startedVersion,
  allowEqualVersion = true,
  isLatestIfVersionMissing = true,
}: VersionGuardOptions): boolean {
  if (nextVersion !== null) {
    return allowEqualVersion ? nextVersion >= currentVersion : nextVersion > currentVersion;
  }

  // Versionless fetch responses are only safe if they belong to the latest in-flight request.
  if (!isLatestIfVersionMissing) {
    return false;
  }

  if (startedVersion === undefined) {
    return true;
  }

  return currentVersion === startedVersion;
}

interface SDUIScreenState {
  screen: SDUIPayload | null;
  draft: SDUIPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSDUIScreen(moduleId: string): SDUIScreenState {
  const { token, serverUrl, logout } = useAuthStore();
  const ws = useWebSocket();
  const [screen, setScreen] = useState<SDUIPayload | null>(null);
  const [draft, setDraft] = useState<SDUIPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sourceKey = `${moduleId}:${token ?? ''}:${serverUrl ?? ''}`;
  const sourceKeyRef = useRef(sourceKey);
  const requestIdRef = useRef(0);
  const liveVersionRef = useRef(INITIAL_VERSION);
  const draftVersionRef = useRef(INITIAL_VERSION);
  const wsHandlerRef = useRef<(message: SDUIScreenMessage) => void>(() => {});

  useEffect(() => {
    sourceKeyRef.current = sourceKey;
    requestIdRef.current = 0;
    liveVersionRef.current = INITIAL_VERSION;
    draftVersionRef.current = INITIAL_VERSION;
  }, [sourceKey]);

  const applyLiveScreen = useCallback((
    nextScreen: SDUIPayload | null,
    versionValue: unknown,
    options: ApplyVersionOptions = {},
  ): boolean => {
    const nextVersion = normalizeVersion(versionValue);

    if (!shouldApplyVersion({
      nextVersion,
      currentVersion: liveVersionRef.current,
      startedVersion: options.startedVersion,
      allowEqualVersion: options.allowEqualVersion,
      isLatestIfVersionMissing: options.isLatestIfVersionMissing,
    })) {
      return false;
    }

    if (nextVersion !== null) {
      liveVersionRef.current = nextVersion;
    }

    setScreen(nextScreen);

    if (options.clearDraft) {
      draftVersionRef.current = 0;
      setDraft(null);
    }

    setError(null);
    setLoading(false);
    return true;
  }, []);

  const applyDraftScreen = useCallback((
    nextDraft: SDUIPayload | null,
    versionValue: unknown,
    options: ApplyVersionOptions = {},
  ): boolean => {
    const nextVersion = normalizeVersion(versionValue);

    if (!shouldApplyVersion({
      nextVersion,
      currentVersion: draftVersionRef.current,
      startedVersion: options.startedVersion,
      allowEqualVersion: options.allowEqualVersion,
      isLatestIfVersionMissing: options.isLatestIfVersionMissing,
    })) {
      return false;
    }

    if (nextVersion !== null) {
      draftVersionRef.current = nextVersion;
    } else if (nextDraft === null) {
      draftVersionRef.current = 0;
    }

    setDraft(nextDraft);
    setError(null);
    setLoading(false);
    return true;
  }, []);

  const fetchScreen = useCallback(async () => {
    if (!token || !serverUrl) return;

    setLoading(true);
    setError(null);

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const requestKey = sourceKey;
    const startedLiveVersion = liveVersionRef.current;
    const startedDraftVersion = draftVersionRef.current;

    try {
      const api = new ApiClient(serverUrl, token, logout);
      const [screenData, draftData] = await Promise.all([
        api.getSDUIScreen(moduleId) as Promise<VersionedScreenResponse>,
        api.getSDUIDraft(moduleId) as Promise<VersionedDraftResponse>,
      ]);

      if (requestKey !== sourceKeyRef.current) {
        return;
      }

      const isLatestRequest = requestId === requestIdRef.current;
      applyLiveScreen((screenData.screen as SDUIPayload) ?? null, screenData.version, {
        startedVersion: startedLiveVersion,
        isLatestIfVersionMissing: isLatestRequest,
      });
      applyDraftScreen(
        draftData.has_draft ? ((draftData.screen as SDUIPayload) ?? null) : null,
        draftData.version,
        {
          startedVersion: startedDraftVersion,
          isLatestIfVersionMissing: isLatestRequest,
        },
      );
    } catch (err) {
      if (requestKey === sourceKeyRef.current && requestId === requestIdRef.current) {
        setError('Failed to load screen');
      }
    } finally {
      if (requestKey === sourceKeyRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [applyDraftScreen, applyLiveScreen, logout, moduleId, serverUrl, sourceKey, token]);

  // Load on mount
  useEffect(() => {
    fetchScreen();
  }, [fetchScreen]);

  wsHandlerRef.current = (message: SDUIScreenMessage) => {
    if (message.module_id !== moduleId) {
      return;
    }

    if (message.type === 'sdui_screen_update') {
      applyLiveScreen((message.screen as SDUIPayload) ?? null, message.version, {
        allowEqualVersion: false,
        clearDraft: true,
      });
      return;
    }

    if (message.type === 'sdui_draft_update') {
      applyDraftScreen((message.screen as SDUIPayload) ?? null, message.version, {
        allowEqualVersion: false,
      });
      return;
    }

    if (message.type === 'sdui_draft_available' || message.type === 'draft_available') {
      if (message.screen) {
        applyDraftScreen((message.screen as SDUIPayload) ?? null, message.version, {
          allowEqualVersion: false,
        });
      } else {
        void fetchScreen();
      }
      return;
    }

    if (message.type === 'sdui_draft_rejected') {
      void fetchScreen();
    }
  };

  // Subscribe to live updates from the shared WebSocket
  useEffect(() => {
    if (!ws) return;

    const unsubscribe = ws.onMessage((message: SDUIScreenMessage) => wsHandlerRef.current(message));

    return unsubscribe;
  }, [ws]);

  return { screen, draft, loading, error, refresh: fetchScreen };
}
