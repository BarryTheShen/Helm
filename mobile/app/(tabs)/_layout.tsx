import { useEffect } from 'react';
import { Tabs, useRouter, Redirect } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { colors } from '@/theme/colors';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/stores/authStore';
import { useTabsStore } from '@/stores/tabsStore';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { ApiClient } from '@/services/api';
import { MODULE_TYPE_TO_ROUTE } from '@/constants/moduleRoutes';

/**
 * Loads tab visibility and module configs from the server and keeps them in
 * sync via WebSocket. Runs inside <WebSocketProvider> so it can use the WS hook.
 */
function TabsConfigSync() {
  const { token, serverUrl, logout } = useAuthStore();
  const ws = useWebSocket();
  const setHiddenTabs = useTabsStore((s) => s.setHiddenTabs);
  const setModuleConfigs = useTabsStore((s) => s.setModuleConfigs);
  const loadEnabledTabIds = useTabsStore((s) => s.loadEnabledTabIds);
  const loadAppConfig = useAppConfigStore((s) => s.loadAppConfig);

  // Load user's enabled tab IDs from AsyncStorage on mount
  useEffect(() => {
    loadEnabledTabIds();
  }, []);

  // Load app config (bottom bar + launchpad)
  // Note: We need device_id from authStore, but it may not be implemented yet
  // For now, we'll skip this until Phase 4 (Device Registration) is complete
  useEffect(() => {
    if (!token || !serverUrl) return;
    // TODO: Uncomment when device_id is available in authStore (Phase 4)
    // const deviceId = useAuthStore.getState().device_id;
    // if (deviceId) {
    //   loadAppConfig(serverUrl, token, deviceId);
    // }
  }, [token, serverUrl]);

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

      // New system: app config updates (bottom bar + launchpad changes)
      if (msg.type === 'app_config_update' && msg.config) {
        const updateFromWebSocket = useAppConfigStore.getState().updateFromWebSocket;
        updateFromWebSocket(msg.config);
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
  const enabledTabIds = useTabsStore((s) => s.enabledTabIds);
  const appConfig = useAppConfigStore((s) => s.appConfig);

  // Defensive auth guard: if token was cleared (e.g. 401 → logout), redirect
  // to the login screen immediately. This catches cases where the root layout's
  // redirect effect doesn't fire in time.
  if (!token) {
    return <Redirect href={serverUrl ? '/(auth)/login' : '/(auth)/connect'} />;
  }

  // Build a map of module_type → slot_position from bottom_bar_config
  const bottomBarMap = new Map<string, number>();
  if (appConfig?.bottom_bar_config) {
    appConfig.bottom_bar_config.forEach((module) => {
      bottomBarMap.set(module.module_type, module.slot_position);
    });
  }

  // href: null hides the tab from the nav bar while keeping the route accessible.
  // Priority order:
  // 1. If appConfig exists, use bottom_bar_config (new system)
  // 2. Otherwise fall back to legacy hiddenTabs + enabledTabIds (old system)
  const tabHref = (moduleType: string) => {
    if (appConfig) {
      // New system: tab is visible only if it's in bottom_bar_config
      return bottomBarMap.has(moduleType) ? undefined : null;
    } else {
      // Legacy system: tab is shown if (1) it's in enabledTabIds AND (2) it's not in hiddenTabs
      if (hiddenTabs.includes(moduleType)) return null;
      if (!enabledTabIds.includes(moduleType)) return null;
      return undefined;
    }
  };

  // Resolve tab label and icon from app config or legacy module configs
  const tabLabel = (moduleType: string, fallback: string) => {
    // Try app config first (new system)
    if (appConfig?.bottom_bar_config) {
      const module = appConfig.bottom_bar_config.find((m) => m.module_type === moduleType);
      if (module) return module.name;
    }

    // Fall back to legacy module configs
    const cfg = moduleConfigs[moduleType];
    if (!cfg) return fallback;
    const { name, icon } = cfg;
    if (icon && name.startsWith(icon)) {
      return name.slice(icon.length).trimStart() || fallback;
    }
    return name;
  };

  const tabIcon = (moduleType: string, fallback: string) => {
    // Try app config first (new system)
    if (appConfig?.bottom_bar_config) {
      const module = appConfig.bottom_bar_config.find((m) => m.module_type === moduleType);
      if (module) return module.icon;
    }

    // Fall back to legacy module configs
    return moduleConfigs[moduleType]?.icon ?? fallback;
  };

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

