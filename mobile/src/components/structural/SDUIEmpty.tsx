/**
 * SDUIEmpty — Simple vertical container for stacking child components.
 * Simplified: no gap, padding, or background. Just a flex column.
 */
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';

interface SDUIEmptyProps {
  children?: React.ReactNode;
}

export function SDUIEmpty({ children }: SDUIEmptyProps) {
  const containerStyle: ViewStyle = {
    flexDirection: 'column',
    flex: 1,
  };

  return <View style={containerStyle}>{children}</View>;
}
