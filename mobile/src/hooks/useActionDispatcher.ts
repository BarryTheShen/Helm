/**
 * useActionDispatcher — centralized SDUI action handler.
 *
 * Replaces all the `console.log('[SDUI action]', action)` stubs across tabs.
 * Dispatches client-side actions (navigate, open_url, copy_text, dismiss, toggle)
 * directly via React Native APIs, and routes server_action to the backend.
 */
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { ApiClient } from '@/services/api';
import type { SDUIAction } from '@/types/sdui';
import type { ActionDispatcher } from '@/components/sdui/SDUIRenderer';

export function useActionDispatcher(): ActionDispatcher {
  const router = useRouter();
  const { token, serverUrl, logout } = useAuthStore();
  const ws = useWebSocket();

  return useCallback(
    (action: SDUIAction) => {
      switch (action.type) {
        case 'navigate': {
          const target = action.screen;
          // Map module IDs to tab routes
          const tabRoutes: Record<string, string> = {
            home: '/(tabs)/home',
            chat: '/(tabs)/chat',
            modules: '/(tabs)/modules',
            calendar: '/(tabs)/calendar',
            forms: '/(tabs)/forms',
            alerts: '/(tabs)/alerts',
            settings: '/(tabs)/settings',
          };
          const route = tabRoutes[target] ?? target;
          try {
            router.push(route as any);
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
          if (ws) {
            ws.send({
              type: 'chat_message',
              content: action.message,
              conversation_id: 'default',
            });
            // Navigate to chat tab so user can see the response
            router.push('/(tabs)/chat' as any);
          }
          break;
        }

        case 'toggle': {
          // Toggle is handled locally by the component that owns the state
          // This is a no-op at the dispatcher level — components should handle it
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
    [router, token, serverUrl, logout, ws],
  );
}
