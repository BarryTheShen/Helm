/**
 * SDUIDivider — Tier 2 atomic component.
 * Horizontal/vertical line for visual separation.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';

interface SDUIDividerProps {
  direction?: 'horizontal' | 'vertical';
  thickness?: number | string;
  color?: string;
  indent?: number | string;
  margin?: number | string;
}

function resolveNumericValue(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function SDUIDivider({
  direction = 'horizontal',
  thickness = 1,
  color,
  indent = 0,
  margin = 0,
}: SDUIDividerProps) {
  const resolvedColor = resolveColor(color, themeColors.divider);
  const resolvedThickness = resolveNumericValue(thickness, 1);
  const resolvedIndent = resolveNumericValue(indent, 0);
  const resolvedMargin = resolveNumericValue(margin, 0);

  if (direction === 'vertical') {
    return (
      <View
        style={{
          width: resolvedThickness,
          backgroundColor: resolvedColor,
          marginVertical: resolvedIndent,
          marginHorizontal: resolvedMargin,
          alignSelf: 'stretch',
        }}
      />
    );
  }

  return (
    <View
      style={{
        height: resolvedThickness,
        backgroundColor: resolvedColor,
        marginHorizontal: resolvedIndent,
        marginVertical: resolvedMargin,
      }}
    />
  );
}
