import { useEffect } from 'react';
import { Tabs, useRouter, Redirect } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { colors } from '@/theme/colors';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/stores/authStore';
import { useTabsStore } from '@/stores/tabsStore';
import { ApiClient } from '@/services/api';

/**
 * Loads tab visibility and module configs from the server and keeps them in
 * sync via WebSocket. Runs inside <WebSocketProvider> so it can use the WS hook.
 */
function TabsConfigSync() {
  const { token, serverUrl, logout } = useAuthStore();
  const ws = useWebSocket();
  const setHiddenTabs = useTabsStore((s) => s.setHiddenTabs);
  const setModuleConfigs = useTabsStore((s) => s.setModuleConfigs);

  // Initial load: fetch module list (name, icon, enabled) from REST.
  useEffect(() => {
    if (!token || !serverUrl) return;
    const api = new ApiClient(serverUrl, token, logout);
    api.getModules()
      .then((data) => {
        const hidden = data.modules
          .filter((m) => !m.enabled)
          .map((m) => m.id);
        setHiddenTabs(hidden);

        // Build id → {name, icon} map so tabs can display dynamic labels.
        const configs: Record<string, { name: string; icon: string }> = {};
        data.modules.forEach((m) => { configs[m.id] = { name: m.name, icon: m.icon }; });
        setModuleConfigs(configs);
      })
      .catch(() => {
        // On error keep all tabs visible with default labels.
      });
  }, [token, serverUrl]);

  // Live updates: when the AI hides/shows a tab or renames a module.
  useEffect(() => {
    if (!ws) return;
    return ws.onMessage((msg: any) => {
      if (msg.type === 'tabs_updated' && Array.isArray(msg.modules)) {
        const hidden = msg.modules
          .filter((m: any) => !m.enabled)
          .map((m: any) => m.id as string);
        setHiddenTabs(hidden);

        const configs: Record<string, { name: string; icon: string }> = {};
        msg.modules.forEach((m: any) => { configs[m.id] = { name: m.name, icon: m.icon }; });
        setModuleConfigs(configs);
      }
    });
  }, [ws]);

  return null;
}

/** Small gear button rendered in the header right corner of every tab. */
function SettingsHeaderButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/settings' as any)}
      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <Text style={{ fontSize: 22 }}>⚙️</Text>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { token, serverUrl } = useAuthStore();
  const hiddenTabs = useTabsStore((s) => s.hiddenTabs);
  const moduleConfigs = useTabsStore((s) => s.moduleConfigs);

  // Defensive auth guard: if token was cleared (e.g. 401 → logout), redirect
  // to the login screen immediately. This catches cases where the root layout's
  // redirect effect doesn't fire in time.
  if (!token) {
    return <Redirect href={serverUrl ? '/(auth)/login' : '/(auth)/connect'} />;
  }

  // href: null hides the tab from the nav bar while keeping the route accessible.
  const tabHref = (name: string) => (hiddenTabs.includes(name) ? null : undefined);

  // Resolve tab label and icon from server-provided config, falling back to defaults.
  // Strip leading icon from name to prevent double-icon display when the server
  // (or AI agent rename_tab) stores the emoji as part of the name.
  const tabLabel = (id: string, fallback: string) => {
    const cfg = moduleConfigs[id];
    if (!cfg) return fallback;
    const { name, icon } = cfg;
    if (icon && name.startsWith(icon)) {
      return name.slice(icon.length).trimStart() || fallback;
    }
    return name;
  };
  const tabIcon = (id: string, fallback: string) => moduleConfigs[id]?.icon ?? fallback;

  const headerRight = () => <SettingsHeaderButton />;

  return (
    <>
      <TabsConfigSync />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          // Show a minimal header with the settings gear on every tab.
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: '600' },
          headerRight,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: tabLabel('home', 'Home'),
            tabBarLabel: tabLabel('home', 'Home'),
            href: tabHref('home'),
            tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 22 }}>{tabIcon('home', '🏠')}</Text>,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: tabLabel('chat', 'Chat'),
            tabBarLabel: tabLabel('chat', 'Chat'),
            href: tabHref('chat'),
            tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 22 }}>{tabIcon('chat', '💬')}</Text>,
          }}
        />
        <Tabs.Screen
          name="modules"
          options={{
            title: tabLabel('modules', 'Modules'),
            tabBarLabel: tabLabel('modules', 'Modules'),
            href: tabHref('modules'),
            tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 22 }}>{tabIcon('modules', '🧩')}</Text>,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: tabLabel('calendar', 'Calendar'),
            tabBarLabel: tabLabel('calendar', 'Calendar'),
            href: tabHref('calendar'),
            tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 22 }}>{tabIcon('calendar', '📅')}</Text>,
          }}
        />
        <Tabs.Screen
          name="forms"
          options={{
            title: tabLabel('forms', 'Forms'),
            tabBarLabel: tabLabel('forms', 'Forms'),
            href: tabHref('forms'),
            tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 22 }}>{tabIcon('forms', '📝')}</Text>,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: tabLabel('alerts', 'Alerts'),
            tabBarLabel: tabLabel('alerts', 'Alerts'),
            href: tabHref('alerts'),
            tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 22 }}>{tabIcon('alerts', '🔔')}</Text>,
          }}
        />
        {/* Settings is always hidden from the tab bar — accessible via the header gear button. */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            href: null,
            headerRight: () => null,
          }}
        />
      </Tabs>
    </>
  );
}


