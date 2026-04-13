/**
 * SDUIContainer — Tier 1 structural component.
 * Flexbox container for layout. Used by developers/templates, not directly by AI.
 * Supports card styling (surfaceElevated + borderRadius + shadow).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { resolveColor, themeColors, themeShadows } from '../../theme/tokens';

interface SDUIContainerProps {
  direction?: 'row' | 'column';
  gap?: number;
  padding?: number;
  backgroundColor?: string;
  borderRadius?: number;
  shadow?: 'sm' | 'md' | 'lg';
  flex?: number;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  children?: React.ReactNode;
}

export function SDUIContainer({
  direction = 'column',
  gap = 0,
  padding = 0,
  backgroundColor,
  borderRadius = 0,
  shadow,
  flex,
  align,
  justify,
  children,
}: SDUIContainerProps) {
  const shadowStyle = shadow ? themeShadows[shadow] : {};

  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap,
          padding,
          backgroundColor: backgroundColor ? resolveColor(backgroundColor) : undefined,
          borderRadius,
          flex,
          alignItems: align,
          justifyContent: justify,
        },
        shadowStyle as any,
      ]}
    >
      {children}
    </View>
  );
}
