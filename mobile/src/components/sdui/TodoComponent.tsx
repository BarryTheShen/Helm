/**
 * TodoComponent — SDUI component for todo list management.
 * Renders items with checkboxes, add input, and delete buttons.
 * Triggers actions for toggle, add, and delete operations.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';
import type { SDUIAction } from '@/types/sdui';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoComponentProps {
  items: TodoItem[];
  placeholder?: string;
  onToggle?: SDUIAction;
  onAdd?: SDUIAction;
  onDelete?: SDUIAction;
  dispatch?: (action: SDUIAction) => void;
}

export function TodoComponent({
  items = [],
  placeholder = 'Add new item...',
  onToggle,
  onAdd,
  onDelete,
  dispatch,
}: TodoComponentProps) {
  const [newItemText, setNewItemText] = useState('');

  const handleToggle = (itemId: string) => {
    if (!onToggle || !dispatch) return;

    // Inject the item id into the action params
    const action = { ...onToggle };
    if (action.type === 'server_action') {
      action.params = { ...action.params, itemId };
    }
    dispatch(action);
  };

  const handleAdd = () => {
    if (!newItemText.trim() || !onAdd || !dispatch) return;

    // Inject the text into the action params
    const action = { ...onAdd };
    if (action.type === 'server_action') {
      action.params = { ...action.params, text: newItemText.trim() };
    }
    dispatch(action);
    setNewItemText('');
  };

  const handleDelete = (itemId: string) => {
    if (!onDelete || !dispatch) return;

    // Inject the item id into the action params
    const action = { ...onDelete };
    if (action.type === 'server_action') {
      action.params = { ...action.params, itemId };
    }
    dispatch(action);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.itemsContainer}>
        {items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleToggle(item.id)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.completed }}
            >
              <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
                {item.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>

            <Text
              style={[
                styles.itemText,
                item.completed && styles.itemTextCompleted,
              ]}
            >
              {item.text}
            </Text>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete item"
            >
              <Text style={styles.deleteIcon}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.addContainer}>
        <TextInput
          style={styles.input}
          value={newItemText}
          onChangeText={setNewItemText}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textSecondary}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          accessibilityLabel="New todo item"
        />
        <TouchableOpacity
          style={[styles.addButton, !newItemText.trim() && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!newItemText.trim()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Add item"
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.divider,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: themeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.background,
  },
  checkboxChecked: {
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    color: themeColors.text,
  },
  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: themeColors.textSecondary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 28,
    color: themeColors.error,
    fontWeight: '300',
  },
  addContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: themeColors.divider,
    backgroundColor: themeColors.surface,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: themeColors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: themeColors.border,
    fontSize: 16,
    color: themeColors.text,
  },
  addButton: {
    width: 44,
    height: 44,
    marginLeft: 8,
    backgroundColor: themeColors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
});
