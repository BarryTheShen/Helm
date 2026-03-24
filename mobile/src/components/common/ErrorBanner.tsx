import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { colors, spacing, typography } from '@/theme/colors';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {onRetry && (
          <Button title="Retry" onPress={onRetry} variant="outline" style={styles.button} />
        )}
        {onDismiss && (
          <Button title="Dismiss" onPress={onDismiss} variant="outline" style={styles.button} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: 8,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  message: {
    ...typography.body,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    borderColor: '#FFFFFF',
  },
});
