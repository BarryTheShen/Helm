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
import { SDUIScreenRenderer, type ActionDispatcher } from '@/components/sdui/SDUIRenderer';
import type { SDUIAction } from '@/types/sdui';
import { colors, spacing, typography } from '@/theme/colors';

const handleAction: ActionDispatcher = (action: SDUIAction) => {
  // Future: dispatch navigate → Expo Router, api_call → fetch, etc.
  console.log('[SDUI action]', action);
};

export default function HomeScreen() {
  const { screen, loading, error, refresh } = useSDUIScreen('home');

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

  return <SDUIScreenRenderer screen={screen} onAction={handleAction} />;
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


