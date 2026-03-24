import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { AlertProps } from '@/types/sdui';
import { Card } from '@/components/common/Card';
import { colors, spacing, typography } from '@/theme/colors';

interface AlertComponentProps extends AlertProps {
  onAction?: (action: string, data: any) => void;
}

export function AlertComponent({
  severity,
  title,
  message,
  dismissible,
  onDismiss,
  onAction,
}: AlertComponentProps) {
  const handleDismiss = () => {
    onDismiss?.();
    onAction?.('alert_dismiss', { severity, title });
  };

  const severityColors = {
    info: colors.primary,
    warning: '#FFA500',
    error: colors.error,
    success: '#4CAF50',
  };

  const backgroundColor = severityColors[severity] + '20';
  const borderColor = severityColors[severity];

  return (
    <Card style={[styles.container, { backgroundColor, borderColor }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: borderColor }]}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {dismissible && (
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Text style={[styles.dismissText, { color: borderColor }]}>✕</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.body,
    color: colors.text,
  },
  dismissButton: {
    padding: spacing.sm,
  },
  dismissText: {
    fontSize: 20,
    fontWeight: '600',
  },
});
