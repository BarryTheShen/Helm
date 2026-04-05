import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/theme/colors';

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue:   { bg: '#EBF5FF', text: '#007AFF' },
  green:  { bg: '#EDFBF1', text: '#34C759' },
  red:    { bg: '#FFF0EF', text: '#FF3B30' },
  yellow: { bg: '#FFFAE5', text: '#FF9500' },
  gray:   { bg: '#F2F2F7', text: '#8E8E93' },
};

interface SDUIBadgeProps {
  label: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
}

export function SDUIBadge({ label, color = 'blue' }: SDUIBadgeProps) {
  const palette = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.caption1,
    fontWeight: '600',
  },
});
