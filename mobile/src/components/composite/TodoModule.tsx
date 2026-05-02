/**
 * TodoModule — Tier 3 composite module.
 * Interactive todo/task list with checkboxes, variable resolution, and data binding.
 * Supports pull-to-refresh when connected to a data source.
 *
 * Each item supports {{expression}} variable resolution in the text field
 * and strikethrough styling for completed items.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { colors, spacing } from '@/theme/colors';
import { resolveExpression } from '@/utils/variableResolver';
import { useVariableContext } from '@/hooks/useVariableContext';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIDataBinding } from '@/types/sdui';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface TodoModuleProps {
  items?: TodoItem[];
  dataBinding?: SDUIDataBinding;
  onToggle?: (item: TodoItem) => void;
  onAdd?: (text: string) => void;
  onDataRefresh?: () => void;
}

export function TodoModule({
  items: itemsProp = [],
  dataBinding,
  onToggle,
  onAdd,
  onDataRefresh,
}: TodoModuleProps) {
  const variableContext = useVariableContext();
  const [refreshing, setRefreshing] = useState(false);

  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  const items = useMemo<TodoItem[]>(() => {
    if (dataSourceData && dataSourceData.length > 0) {
      return dataSourceData.map((row, i) => ({
        id: String(row.id ?? i),
        text: String(row.text ?? row.title ?? ''),
        done: Boolean(row.done ?? row.completed ?? false),
      }));
    }
    return itemsProp;
  }, [dataSourceData, itemsProp]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (dataBinding) {
      clearDataSourceCache(dataBinding.dataSourceId);
    }
    const refresh = onDataRefresh ?? dsRefresh;
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [dataBinding, onDataRefresh, dsRefresh]);

  const handleToggle = useCallback((item: TodoItem) => {
    onToggle?.(item);
  }, [onToggle]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tasks</Text>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.itemRow}
            onPress={() => handleToggle(item)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
          >
            <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
              {item.done && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text
              style={[
                styles.itemText,
                item.done && styles.itemTextDone,
              ]}
            >
              {resolveExpression(item.text, variableContext)}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', minHeight: 120 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.textSecondary },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: colors.background,
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  itemTextDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
});
