import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DraftPreview } from '@/components/sdui/DraftPreview';
import { SDUIUniversalRenderer } from '@/components/sdui/SDUIRenderer';
import { useActionDispatcher } from '@/hooks/useActionDispatcher';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { ApiClient } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { useTabsStore } from '@/stores/tabsStore';
import { colors, spacing, typography } from '@/theme/colors';

function getRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export default function ModuleDetailScreen() {
  const { moduleId: rawModuleId } = useLocalSearchParams<{ moduleId?: string | string[] }>();
  const moduleId = getRouteParam(rawModuleId);
  const handleAction = useActionDispatcher();
  const { token, serverUrl, logout } = useAuthStore();
  const moduleConfigs = useTabsStore((s) => s.moduleConfigs);
  const { screen, draft, loading, error, refresh } = useSDUIScreen(moduleId);
  const moduleName = moduleConfigs[moduleId]?.name ?? moduleId;

  const handleApproveDraft = async () => {
    if (!token || !serverUrl || !moduleId) return;
    const api = new ApiClient(serverUrl, token, logout);
    await api.executeAction('approve_draft', { module_id: moduleId });
  };

  const handleRejectDraft = async (feedback?: string) => {
    if (!token || !serverUrl || !moduleId) return;
    const api = new ApiClient(serverUrl, token, logout);
    await api.executeAction('reject_draft', { module_id: moduleId, feedback });
  };

  const headerLeft = () => (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      style={{ paddingRight: spacing.sm }}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={{ fontSize: 17, color: colors.primary }}>{Platform.OS === 'web' ? '← Back' : '‹ Back'}</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: moduleName, headerShown: true, headerLeft }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: moduleName, headerShown: true, headerLeft }} />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryLink} onPress={refresh}>Retry</Text>
      </View>
    );
  }

  if (!screen) {
    if (draft) {
      return (
        <>
          <Stack.Screen options={{ title: moduleName, headerShown: true, headerLeft }} />
          <DraftPreview
            draft={draft}
            moduleId={moduleId}
            onApprove={handleApproveDraft}
            onReject={handleRejectDraft}
          />
        </>
      );
    }

    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: moduleName, headerShown: true, headerLeft }} />
        <Text style={styles.emptyTitle}>{moduleName || 'Module'}</Text>
        <Text style={styles.emptyBody}>
          No screen has been configured for this module yet.
        </Text>
        <Text style={styles.emptyHint}>
          Ask the AI to create a screen for this module.
        </Text>
      </View>
    );
  }

  if (draft) {
    return (
      <>
        <Stack.Screen options={{ title: moduleName, headerShown: true, headerLeft }} />
        <DraftPreview
          draft={draft}
          moduleId={moduleId}
          onApprove={handleApproveDraft}
          onReject={handleRejectDraft}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: moduleName, headerShown: true, headerLeft }} />
      <SDUIUniversalRenderer payload={screen} onAction={handleAction} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  emptyTitle: { ...typography.title2, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  emptyHint: { ...typography.footnote, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic', backgroundColor: colors.surface, padding: spacing.md, borderRadius: 10 },
  errorText: { ...typography.body, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  retryLink: { ...typography.body, color: colors.primary, textDecorationLine: 'underline' },
});