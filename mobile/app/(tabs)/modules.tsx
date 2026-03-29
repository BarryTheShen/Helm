import { useState, useEffect } from 'react';
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
import { ApiClient } from '@/services/api';
import { Card } from '@/components/common/Card';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { colors, spacing, typography } from '@/theme/colors';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { SDUIScreenRenderer, type ActionDispatcher } from '@/components/sdui/SDUIRenderer';
import type { SDUIAction } from '@/types/sdui';

const handleAction: ActionDispatcher = (action: SDUIAction) => console.log('[SDUI action]', action);

interface Module {
  id: string;
  name: string;
  description?: string;
  icon: string;
  enabled?: boolean;
}

export default function ModulesScreen() {
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const { screen: sduiScreen } = useSDUIScreen('modules');

  useEffect(() => {
    if (token && serverUrl) loadModules();
  }, [token, serverUrl]);

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

  const handleModulePress = (module: Module) => {
    // Navigate to module detail screen or trigger module action
    console.log('Module pressed:', module.id);
  };

  const renderModule = ({ item }: { item: Module }) => (
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
          <Text style={styles.moduleDescription}>{item.description}</Text>
        </View>
        <View style={[styles.statusBadge, item.enabled && styles.enabledBadge]}>
          <Text style={styles.statusText}>{item.enabled ? 'Enabled' : 'Disabled'}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (sduiScreen) {
    return <SDUIScreenRenderer screen={sduiScreen} onAction={handleAction} />;
  }

  return (
    <View style={styles.container}>
      {errorBanner && (
        <ErrorBanner
          message={errorBanner.message}
          onRetry={errorBanner.retry}
          onDismiss={hideError}
        />
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.textSecondary + '20',
  },
  enabledBadge: {
    backgroundColor: colors.primary + '20',
  },
  statusText: {
    ...typography.caption1,
    color: colors.textSecondary,
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
