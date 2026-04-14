/**
 * ScreenOptions -- Composite component that renders multiple screen previews
 * for the user to choose from. The AI presents 2-3 screen variants; the user
 * taps one to select it, which dispatches a select_screen action.
 *
 * Props (from protocol SDUIScreenOptions):
 *   prompt: string            -- question or instruction for the user
 *   options: Array<{ id, label, description?, screen }>  -- screen variants
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { themeColors } from '../../theme/tokens';
import type { SDUIAction } from '@keel/protocol';

interface ScreenOption {
  id: string;
  label: string;
  description?: string;
  screen: Record<string, any>;
}

interface ScreenOptionsProps {
  prompt: string;
  options: ScreenOption[];
  dispatch?: (action: SDUIAction) => void;
}

export function ScreenOptions({
  prompt,
  options = [],
  dispatch,
}: ScreenOptionsProps) {
  const handleSelect = (optionId: string) => {
    if (!dispatch) return;
    dispatch({ type: 'select_screen', option_id: optionId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{prompt}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.optionsList}
      >
        {options.map(option => (
          <TouchableOpacity
            key={option.id}
            style={styles.optionCard}
            onPress={() => handleSelect(option.id)}
            activeOpacity={0.7}
          >
            <View style={styles.optionPreview}>
              <Text style={styles.previewPlaceholder}>
                {option.screen?.title || option.label}
              </Text>
              {option.screen?.rows && (
                <Text style={styles.previewMeta}>
                  {option.screen.rows.length} row{option.screen.rows.length !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>{option.label}</Text>
              {option.description && (
                <Text style={styles.optionDescription} numberOfLines={2}>
                  {option.description}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  prompt: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  optionsList: {
    gap: 12,
    paddingVertical: 4,
  },
  optionCard: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  optionPreview: {
    height: 140,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  previewPlaceholder: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  previewMeta: {
    fontSize: 13,
    color: '#AEAEB2',
    marginTop: 4,
  },
  optionInfo: {
    padding: 12,
    gap: 4,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  optionDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
});
