/**
 * Home screen — fully SDUI-driven.
 *
 * The AI generates a SDUIScreen JSON via helm_set_screen("home", ...) and the
 * screen updates in real-time over the shared WebSocket (WebSocketProvider in
 * the tab layout).  No code changes or app rebuild needed.
 *
 * Empty state is shown when no screen has been set.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { SDUIUniversalRenderer } from '@/components/sdui/SDUIRenderer';
import { DraftPreview } from '@/components/sdui/DraftPreview';
import { useActionDispatcher } from '@/hooks/useActionDispatcher';
import { useAuthStore } from '@/stores/authStore';
import { ApiClient } from '@/services/api';
import { colors, spacing, typography } from '@/theme/colors';

export default function HomeScreen() {
  const handleAction = useActionDispatcher();
  const { token, serverUrl, logout } = useAuthStore();
  const { screen, draft, loading, error, refresh } = useSDUIScreen('home');

  const handleApproveDraft = async () => {
    if (!token || !serverUrl) return;
    const api = new ApiClient(serverUrl, token, logout);
    await api.executeAction('approve_draft', { module_id: 'home' });
  };

  const handleRejectDraft = async (feedback?: string) => {
    if (!token || !serverUrl) return;
    const api = new ApiClient(serverUrl, token, logout);
    await api.executeAction('reject_draft', { module_id: 'home', feedback });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryLink} onPress={refresh}>Retry</Text>
      </View>
    );
  }

  if (!screen) {
    // Show draft preview if a draft exists but no live screen
    if (draft) {
      return (
        <DraftPreview
          draft={draft}
          moduleId="home"
          onApprove={handleApproveDraft}
          onReject={handleRejectDraft}
        />
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🏠</Text>
        <Text style={styles.emptyTitle}>Home</Text>
        <Text style={styles.emptyBody}>
          Ask the AI to set up your Home screen.{'\n'}
          It can display calendars, stats, tasks, forms, and more — in any layout you describe.
        </Text>
        <Text style={styles.emptyHint}>
          Try: "Set up my home screen with a morning greeting, upcoming events, and a quick stats row"
        </Text>
      </View>
    );
  }

  // Show draft overlay if there's a pending draft on top of the live screen
  if (draft) {
    return (
      <DraftPreview
        draft={draft}
        moduleId="home"
        onApprove={handleApproveDraft}
        onReject={handleRejectDraft}
      />
    );
  }

  return <SDUIUniversalRenderer payload={screen} onAction={handleAction} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...typography.title2, color: colors.text, marginBottom: spacing.sm },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  emptyHint: { ...typography.footnote, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic', backgroundColor: colors.surface, padding: spacing.md, borderRadius: 10 },
  errorText: { ...typography.body, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  retryLink: { ...typography.body, color: colors.primary, textDecorationLine: 'underline' },
});


