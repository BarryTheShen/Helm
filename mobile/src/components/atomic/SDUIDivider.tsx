/**
 * SDUIDivider — Tier 2 atomic component.
 * Horizontal/vertical line for visual separation.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';

interface SDUIDividerProps {
  direction?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  indent?: number;
}

export function SDUIDivider({
  direction = 'horizontal',
  thickness = 1,
  color,
  indent = 0,
}: SDUIDividerProps) {
  const resolvedColor = resolveColor(color, themeColors.divider);

  if (direction === 'vertical') {
    return (
      <View
        style={{
          width: thickness,
          backgroundColor: resolvedColor,
          marginVertical: indent,
          alignSelf: 'stretch',
        }}
      />
    );
  }

  return (
    <View
      style={{
        height: thickness,
        backgroundColor: resolvedColor,
        marginHorizontal: indent,
      }}
    />
  );
}
