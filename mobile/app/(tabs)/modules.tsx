import { useState, useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useTabsStore } from '@/stores/tabsStore';
import { ApiClient } from '@/services/api';
import { Card } from '@/components/common/Card';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { colors, spacing, typography } from '@/theme/colors';
import type { Module, Template } from '@/types/api';

const BUILT_IN_MODULE_ROUTES: Record<string, string> = {
  home: '/(tabs)/home',
  chat: '/(tabs)/chat',
  modules: '/(tabs)/modules',
  calendar: '/(tabs)/calendar',
  forms: '/(tabs)/forms',
  alerts: '/(tabs)/alerts',
  settings: '/(tabs)/settings',
};

type ViewMode = 'modules' | 'store';

export default function ModulesScreen() {
  const router = useRouter();
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const { enabledTabIds, toggleTabEnabled } = useTabsStore();
  const [modules, setModules] = useState<Module[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('modules');

  useEffect(() => {
    if (token && serverUrl) {
      if (viewMode === 'modules') {
        loadModules();
      } else {
        loadTemplates();
      }
    }
  }, [token, serverUrl, viewMode]);

  const loadModules = async () => {
    if (!token || !serverUrl) return;

    try {
      setLoading(true);
      const api = new ApiClient(serverUrl, token, logout);
      const data = await api.getModules();
      setModules(data.modules);
      hideError();
    } catch (error) {
      showError('Failed to load modules', loadModules);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    if (!token || !serverUrl) return;

    try {
      setLoading(true);
      const api = new ApiClient(serverUrl, token, logout);
      const data = await api.getTemplates();
      setTemplates(data.items);
      hideError();
    } catch (error) {
      showError('Failed to load templates', loadTemplates);
    } finally {
      setLoading(false);
    }
  };

  const handleModulePress = (module: Module) => {
    const builtInRoute = BUILT_IN_MODULE_ROUTES[module.id];

    if (builtInRoute) {
      router.push(builtInRoute as Href);
      return;
    }

    router.push(`/module/${encodeURIComponent(module.id)}` as Href);
  };

  const handleToggleTab = async (moduleId: string) => {
    await toggleTabEnabled(moduleId);
  };

  const isTabEnabled = (moduleId: string) => {
    return enabledTabIds.includes(moduleId);
  };

  const renderModule = ({ item }: { item: Module }) => {
    const tabEnabled = isTabEnabled(item.id);

    return (
      <TouchableOpacity
        onPress={() => handleModulePress(item)}
        activeOpacity={0.7}
      >
        <Card style={styles.moduleCard}>
          <View style={styles.moduleIcon}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <View style={styles.moduleContent}>
            <Text style={styles.moduleName}>{item.name}</Text>
            <Text style={styles.moduleDescription}>
              {BUILT_IN_MODULE_ROUTES[item.id] ? 'Built-in module' : 'Custom module'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleToggleTab(item.id)}
            style={[styles.toggleButton, tabEnabled && styles.toggleButtonActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleButtonText, tabEnabled && styles.toggleButtonTextActive]}>
              {tabEnabled ? 'Remove' : 'Add'}
            </Text>
          </TouchableOpacity>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderTemplate = ({ item }: { item: Template }) => (
    <TouchableOpacity
      onPress={() => router.push(`/template/${encodeURIComponent(item.id)}` as Href)}
      activeOpacity={0.7}
    >
      <Card style={styles.templateCard}>
        <View style={styles.templateContent}>
          <Text style={styles.templateName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.templateDescription}>{item.description}</Text>
          )}
          <View style={styles.templateMeta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            {item.is_public && (
              <View style={styles.publicBadge}>
                <Text style={styles.publicText}>Public</Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (viewMode === 'modules') {
      return (
        <FlatList
          data={modules}
          renderItem={renderModule}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No modules available</Text>
            </View>
          }
        />
      );
    }

    return (
      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No templates available</Text>
          </View>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      {errorBanner && (
        <ErrorBanner
          message={errorBanner.message}
          onRetry={errorBanner.retry}
          onDismiss={hideError}
        />
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'modules' && styles.tabActive]}
          onPress={() => setViewMode('modules')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, viewMode === 'modules' && styles.tabTextActive]}>
            My Modules
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'store' && styles.tabActive]}
          onPress={() => setViewMode('store')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, viewMode === 'store' && styles.tabTextActive]}>
            Module Store
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  moduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 24,
  },
  moduleContent: {
    flex: 1,
  },
  moduleName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  moduleDescription: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    ...typography.caption1,
    color: colors.primary,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  templateCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  templateDescription: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
  },
  categoryText: {
    ...typography.caption1,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  publicBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.success + '20',
  },
  publicText: {
    ...typography.caption1,
    color: colors.success,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
