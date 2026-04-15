/**
 * useActionDispatcher — centralized SDUI action handler.
 *
 * Replaces all the `console.log('[SDUI action]', action)` stubs across tabs.
 * Dispatches client-side actions (navigate, open_url, copy_text, dismiss, toggle)
 * directly via React Native APIs, and routes server_action to the backend.
 */
import { useCallback, useRef } from 'react';
import { Alert, Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useComponentStateStore } from '@/stores/componentStateStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { ApiClient } from '@/services/api';
import { executeCompositeAction } from '@/utils/actionEngine';
import { clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIAction } from '@/types/sdui';
import type { ActionDispatcher } from '@/components/sdui/SDUIRenderer';

const TAB_ROUTES: Record<string, Href> = {
  home: '/(tabs)/home',
  chat: '/(tabs)/chat',
  modules: '/(tabs)/modules',
  calendar: '/(tabs)/calendar',
  forms: '/(tabs)/forms',
  alerts: '/(tabs)/alerts',
  settings: '/(tabs)/settings',
};

function resolveNavigationTarget(target: string): Href | null {
  if (target.startsWith('/')) {
    return target as Href;
  }

  const tabRoute = TAB_ROUTES[target];
  if (tabRoute) {
    return tabRoute;
  }

  if (target.startsWith('custom-')) {
    return `/module/${encodeURIComponent(target)}` as Href;
  }

  return null;
}

export function useActionDispatcher(): ActionDispatcher {
  const router = useRouter();
  const { token, serverUrl, logout } = useAuthStore();
  const ws = useWebSocket();
  const componentStateStore = useComponentStateStore();

  // Keep a ref to the latest dispatch for use in async composite actions
  const dispatchRef = useRef<ActionDispatcher>();

  const dispatch = useCallback(
    (action: SDUIAction) => {
      switch (action.type) {
        case 'navigate': {
          const target = action.screen;
          if (!target) {
            Alert.alert('Navigation Error', 'Missing navigation target');
            break;
          }

          const route = resolveNavigationTarget(target);
          if (!route) {
            Alert.alert('Navigation Error', `Unknown navigation target "${target}"`);
            break;
          }

          try {
            router.push(route);
          } catch {
            Alert.alert('Navigation Error', `Could not navigate to "${target}"`);
          }
          break;
        }

        case 'go_back': {
          if (router.canGoBack()) {
            router.back();
          }
          break;
        }

        case 'open_url': {
          const url = action.url;
          // Only allow http/https/mailto/tel schemes
          if (/^(https?|mailto|tel):/.test(url)) {
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', `Could not open: ${url}`);
            });
          }
          break;
        }

        case 'copy_text': {
          Clipboard.setStringAsync(action.text).then(() => {
            Alert.alert('Copied', 'Text copied to clipboard');
          });
          break;
        }

        case 'dismiss': {
          if (router.canGoBack()) {
            router.back();
          }
          break;
        }

        case 'open_sheet': {
          // For now, sheets are not yet implemented as a modal system
          // This will be extended when modal routing is added
          break;
        }

        case 'server_action': {
          if (!token || !serverUrl) {
            Alert.alert('Error', 'Not connected to server');
            return;
          }
          const api = new ApiClient(serverUrl, token, logout);
          api.executeAction(action.function, action.params ?? {}).catch((err: Error) => {
            Alert.alert('Action Failed', err.message);
          });
          break;
        }

        case 'send_to_agent': {
          console.warn('[useActionDispatcher] send_to_agent is deprecated. Use server_action or api_call instead.');
          if (ws) {
            ws.send({
              type: 'chat_message',
              content: action.message,
              conversation_id: 'default',
            });
            router.push('/(tabs)/chat' as Href);
          }
          break;
        }

        case 'toggle': {
          // Toggle is handled locally by the component that owns the state
          break;
        }

        case 'submit_form': {
          if (!token || !serverUrl) {
            Alert.alert('Error', 'Not connected to server');
            return;
          }
          // Collect form data from component state store
          const allStates = componentStateStore.states;
          const formData: Record<string, any> = {};
          if (action.formId && allStates[action.formId]) {
            Object.assign(formData, allStates[action.formId]);
          } else {
            // Collect all component states as form data
            for (const [compId, state] of Object.entries(allStates)) {
              if (state.value !== undefined) {
                formData[compId] = state.value;
              }
            }
          }
          const submitBody = { ...formData, ...(action.params ?? {}) };
          fetch(`${serverUrl}/api/actions/execute`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(submitBody),
          }).catch((err: Error) => {
            Alert.alert('Submit Failed', err.message);
          });
          break;
        }

        case 'set_component_state': {
          componentStateStore.setComponentState(action.componentId, action.key, action.value);
          break;
        }

        case 'set_variable': {
          if (!token || !serverUrl) return;
          fetch(`${serverUrl}/api/variables`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: action.name,
              value: action.value,
              scope: action.scope,
            }),
          }).catch((err: Error) => {
            console.warn('[useActionDispatcher] set_variable failed:', err.message);
          });
          break;
        }

        case 'show_notification': {
          const titleMap: Record<string, string> = {
            success: 'Success',
            error: 'Error',
            info: 'Info',
            warning: 'Warning',
          };
          const title = titleMap[action.notificationType ?? 'info'] ?? 'Info';
          Alert.alert(title, action.message);
          break;
        }

        case 'show_alert': {
          const buttons = action.buttons?.map((btn) => ({
            text: btn.text,
            onPress: btn.action ? () => dispatchRef.current?.(btn.action!) : undefined,
          }));
          Alert.alert(action.title, action.message, buttons ?? [{ text: 'OK' }]);
          break;
        }

        case 'haptic': {
          // expo-haptics is optional — try dynamic import, no-op if unavailable
          try {
            const Haptics = require('expo-haptics');
            const styleMap: Record<string, any> = {
              light: Haptics.ImpactFeedbackStyle?.Light,
              medium: Haptics.ImpactFeedbackStyle?.Medium,
              heavy: Haptics.ImpactFeedbackStyle?.Heavy,
            };
            if (action.style === 'success' || action.style === 'error') {
              const notificationType = action.style === 'success'
                ? Haptics.NotificationFeedbackType?.Success
                : Haptics.NotificationFeedbackType?.Error;
              if (notificationType !== undefined) {
                Haptics.notificationAsync(notificationType);
              }
            } else if (styleMap[action.style] !== undefined) {
              Haptics.impactAsync(styleMap[action.style]);
            }
          } catch {
            // expo-haptics not available — no-op
          }
          break;
        }

        case 'share': {
          Share.share({
            message: action.content,
            title: action.title,
          }).catch(() => {
            // User cancelled or share failed — no-op
          });
          break;
        }

        case 'chain':
        case 'conditional':
        case 'delay': {
          const executeSimple = async (a: SDUIAction) => {
            dispatchRef.current?.(a);
          };
          const resolveCondition = (expr: string): boolean => {
            // Simple truthiness check: look up expression in component states
            const parts = expr.trim().split('.');
            if (parts.length >= 2 && parts[0] === 'component') {
              const compId = parts[1];
              const key = parts.slice(2).join('.');
              return Boolean(componentStateStore.getComponentState(compId, key || 'value'));
            }
            // Bare value check
            return Boolean(componentStateStore.getComponentState(parts[0], parts[1] ?? 'value'));
          };
          executeCompositeAction(action, executeSimple, resolveCondition).catch((err: Error) => {
            console.warn('[useActionDispatcher] Composite action failed:', err.message);
          });
          break;
        }

        case 'refresh_data': {
          if (action.dataSourceId) {
            clearDataSourceCache(action.dataSourceId);
          } else {
            clearDataSourceCache();
          }
          break;
        }

        default: {
          // Handle api_call type: make a direct request to the specified path
          const legacy = action as any;
          if (legacy.type === 'api_call' && token && serverUrl) {
            const method: string = legacy.method ?? 'POST';
            const path: string = legacy.path ?? '';
            const body: Record<string, unknown> = legacy.body ?? {};
            fetch(`${serverUrl}${path}`, {
              method,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: method !== 'GET' ? JSON.stringify(body) : undefined,
            }).catch((err: Error) => {
              Alert.alert('Action Failed', err.message);
            });
          }
          break;
        }
      }
    },
    [router, token, serverUrl, logout, ws, componentStateStore],
  );

  dispatchRef.current = dispatch;

  return dispatch;
}
