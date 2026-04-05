/**
 * Forms screen — SDUI-driven.
 *
 * The AI creates forms via helm_set_screen("forms", ...) using the "form"
 * component type with typed fields (text, email, checkbox, select, etc.).
 * Until the AI has set up a form, an empty state is shown instead of the
 * placeholder quick-form that was here before.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSDUIScreen } from '@/hooks/useSDUIScreen';
import { SDUIUniversalRenderer } from '@/components/sdui/SDUIRenderer';
import { useActionDispatcher } from '@/hooks/useActionDispatcher';
import { colors, spacing, typography } from '@/theme/colors';

export default function FormsScreen() {
  const handleAction = useActionDispatcher();
  const { screen, loading, error, refresh } = useSDUIScreen('forms');

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
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyTitle}>Forms</Text>
        <Text style={styles.emptyBody}>
          This screen is empty.{'\n'}
          Ask the AI to create a form for you.
        </Text>
        <Text style={styles.emptyHint}>
          Try: "Create a feedback form with name, rating, and comments fields"
        </Text>
      </View>
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

