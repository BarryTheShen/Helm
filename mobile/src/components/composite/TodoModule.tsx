/**
 * TodoModule — Tier 3 composite module.
 * Interactive todo/task list with checkboxes, variable resolution, and data binding.
 * Supports pull-to-refresh when connected to a data source.
 *
 * REQ-IDs:
 *   FF4-TODO-001 — Real functional component with checkbox + strikethrough
 *   FF4-TODO-002 — Daily Planner template uses real Todo component
 *   FF4-TODO-004 — Registered as real component for publish validation
 *
 * Each item supports {{expression}} variable resolution in the text field
 * and strikethrough styling for completed items.
 *
 * Backend integration:
 *  - Load: via dataBinding prop (useDataSource hook)
 *  - Toggle/Add/Delete: via dispatch or callback props
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { colors, spacing } from '@/theme/colors';
import { resolveExpression } from '@/utils/variableResolver';
import { useVariableContext } from '@/hooks/useVariableContext';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIAction, SDUIDataBinding } from '@/types/sdui';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface TodoModuleProps {
  id?: string;
  items?: TodoItem[];
  dataBinding?: SDUIDataBinding;
  placeholder?: string;
  /** Toggle action — either a callback or an SDUIAction to dispatch */
  onToggle?: ((item: TodoItem) => void) | SDUIAction;
  /** Add action — either a callback or an SDUIAction to dispatch */
  onAdd?: ((text: string) => void) | SDUIAction;
  /** Delete action — either a callback or an SDUIAction to dispatch */
  onDelete?: ((item: TodoItem) => void) | SDUIAction;
  onDataRefresh?: () => void;
  /** Injected by the SDUI renderer */
  dispatch?: (action: SDUIAction) => void;
}

export function TodoModule({
  id: _id,
  items: itemsProp = [],
  dataBinding,
  placeholder = 'Add a task…',
  onToggle,
  onAdd,
  onDelete,
  onDataRefresh,
  dispatch,
}: TodoModuleProps) {
  const variableContext = useVariableContext();
  const [refreshing, setRefreshing] = useState(false);
  const [newText, setNewText] = useState('');

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

  /** Merge extra params into an SDUIAction for dispatch. */
  function withParams(action: SDUIAction, extra: Record<string, unknown>): SDUIAction {
    return { ...action, params: { ...((action as Record<string, unknown>).params as Record<string, unknown> ?? {}), ...extra } } as SDUIAction;
  }

  /** Dispatch or call the toggle handler */
  const handleToggle = useCallback((item: TodoItem) => {
    if (typeof onToggle === 'function') {
      onToggle(item);
    } else if (onToggle && dispatch) {
      dispatch(withParams(onToggle, { id: item.id, done: !item.done }));
    }
  }, [onToggle, dispatch]);

  /** Dispatch or call the add handler */
  const handleAdd = useCallback(() => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    if (typeof onAdd === 'function') {
      onAdd(trimmed);
    } else if (onAdd && dispatch) {
      dispatch(withParams(onAdd, { text: trimmed }));
    }
    setNewText('');
  }, [newText, onAdd, dispatch]);

  /** Dispatch or call the delete handler */
  const handleDelete = useCallback((item: TodoItem) => {
    if (typeof onDelete === 'function') {
      onDelete(item);
    } else if (onDelete && dispatch) {
      dispatch(withParams(onDelete, { id: item.id }));
    }
  }, [onDelete, dispatch]);

  const canAdd = newText.trim().length > 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* Add task input */}
      {(onAdd || dispatch) && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newText}
            onChangeText={setNewText}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            onSubmitEditing={canAdd ? handleAdd : undefined}
          />
          <TouchableOpacity
            style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!canAdd}
          >
            <Text style={[styles.addBtnText, !canAdd && styles.addBtnTextDisabled]}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tasks</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Pressable
              style={styles.itemContent}
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
            {/* Delete button */}
            {(onDelete || dispatch) && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', minHeight: 120 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: colors.divider,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  addBtnTextDisabled: {
    color: colors.textTertiary,
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.textSecondary },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
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
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
