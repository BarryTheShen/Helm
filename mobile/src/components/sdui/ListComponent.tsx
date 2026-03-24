import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import type { ListProps } from '@/types/sdui';
import { Card } from '@/components/common/Card';
import { colors, spacing, typography } from '@/theme/colors';

interface ListComponentProps extends ListProps {
  onAction?: (action: string, data: any) => void;
}

export function ListComponent({ items, onAction }: ListComponentProps) {
  const handleItemPress = (item: any) => {
    item.onPress?.();
    onAction?.('list_item_press', { itemId: item.id });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      <Card style={styles.itemCard}>
        {item.icon && <Text style={styles.icon}>{item.icon}</Text>}
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.subtitle && (
            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
          )}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  icon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  itemSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
});
