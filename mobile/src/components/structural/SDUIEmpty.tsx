/**
 * SDUIEmpty — A simple vertical container for stacking child components.
 *
 * Props:
 * - gap: spacing between children (default: 8)
 * - padding: uniform padding (default: 0)
 * - backgroundColor: background color (default: transparent)
 * - children: array of child components
 */
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

interface SDUIEmptyProps {
  gap?: number;
  padding?: number;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export function SDUIEmpty({ gap = 8, padding = 0, backgroundColor, children }: SDUIEmptyProps) {
  const containerStyle: ViewStyle = {
    flexDirection: 'column',
    gap,
    padding,
    backgroundColor: backgroundColor || 'transparent',
  };

  return <View style={containerStyle}>{children}</View>;
}
