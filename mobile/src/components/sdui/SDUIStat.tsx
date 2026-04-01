import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/theme/colors';

interface SDUIStatProps {
  label: string;
  value: string;
  change?: string;
  change_direction?: 'up' | 'down' | 'neutral';
  icon?: string;
}

export function SDUIStat({ label, value, change, change_direction = 'neutral', icon }: SDUIStatProps) {
  const changeColor =
    change_direction === 'up' ? '#34C759' :
    change_direction === 'down' ? '#FF3B30' :
    colors.textSecondary;
  const changePrefix = change_direction === 'up' ? '▲ ' : change_direction === 'down' ? '▼ ' : '';

  return (
    <View style={styles.container}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {change && (
        <Text style={[styles.change, { color: changeColor }]}>
          {changePrefix}{change}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 72,
  },
  icon: {
    fontSize: 20,
    marginBottom: 2,
  },
  value: {
    ...typography.title3,
    color: colors.text,
    fontWeight: '700',
  },
  label: {
    ...typography.caption1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  change: {
    ...typography.caption2,
    marginTop: 2,
  },
});
