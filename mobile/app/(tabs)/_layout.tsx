import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme/colors';
import { WebSocketProvider, useWebSocket } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/stores/authStore';
import { useTabsStore } from '@/stores/tabsStore';
import { ApiClient } from '@/services/api';

/**
 * Loads tab visibility from the server and keeps it in sync via WebSocket.
 *
 * Why a separate component: useWebSocket() requires a WebSocketProvider ancestor,
 * so this must live inside <WebSocketProvider> rather than in TabsLayout itself.
 */
function TabsConfigSync() {
  const { token, serverUrl, logout } = useAuthStore();
  const ws = useWebSocket();
  const setHiddenTabs = useTabsStore((s) => s.setHiddenTabs);

  // Initial load: fetch which tabs are hidden from the REST API.
  useEffect(() => {
    if (!token || !serverUrl) return;
    const api = new ApiClient(serverUrl, token, logout);
    api.getModules()
      .then((data) => {
        const hidden = data.modules
          .filter((m) => !m.enabled)
          .map((m) => m.id);
        setHiddenTabs(hidden);
      })
      .catch(() => {
        // On error keep all tabs visible — safer than hiding them.
      });
  }, [token, serverUrl]);

  // Live updates: when the AI hides/shows a tab, the backend pushes tabs_updated.
  useEffect(() => {
    if (!ws) return;
    return ws.onMessage((msg: any) => {
      if (msg.type === 'tabs_updated' && Array.isArray(msg.modules)) {
        const hidden = msg.modules
          .filter((m: any) => !m.enabled)
          .map((m: any) => m.id as string);
        setHiddenTabs(hidden);
      }
    });
  }, [ws]);

  return null;
}

export default function TabsLayout() {
  const hiddenTabs = useTabsStore((s) => s.hiddenTabs);
  // href: null hides the tab from the nav bar while keeping the route accessible.
  const tabHref = (name: string) => (hiddenTabs.includes(name) ? null : undefined);

  return (
    <WebSocketProvider>
      <TabsConfigSync />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            href: tabHref('home'),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🏠</Text>,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            href: tabHref('chat'),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>💬</Text>,
          }}
        />
        <Tabs.Screen
          name="modules"
          options={{
            title: 'Modules',
            href: tabHref('modules'),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🧩</Text>,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            href: tabHref('calendar'),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>📅</Text>,
          }}
        />
        <Tabs.Screen
          name="forms"
          options={{
            title: 'Forms',
            href: tabHref('forms'),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>📝</Text>,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            href: tabHref('alerts'),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🔔</Text>,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            href: tabHref('settings'),
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>⚙️</Text>,
          }}
        />
      </Tabs>
    </WebSocketProvider>
  );
}

