/**
 * SDUIEmpty — Simple vertical container for stacking child components.
 * Simplified: no gap, padding, or background. Just a flex column.
 *
 * REQ-ID: FF4-EC-001 — Vertical row concept (flexDirection: 'column', flex: 1)
 * REQ-ID: FF4-EC-003 — Component fitting: children fill available width (alignItems: 'stretch')
 * REQ-ID: FF4-EC-004 — No separate layout system — inherits from flex layout
 * REQ-ID: FF4-EC-005 — Real editable component with SDUI props (dispatch, dataBinding)
 * REQ-ID: FF4-EC-006 — No extra styling (no gap/padding/background)
 */
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { SDUIDataBinding, SDUIAction } from '@/types/sdui';

interface SDUIEmptyProps {
  children?: React.ReactNode;
  /** Injected by the SDUI renderer for action dispatch */
  dispatch?: (action: SDUIAction) => void;
  /** Data binding for connected data sources */
  dataBinding?: SDUIDataBinding;
}

export function SDUIEmpty({ children }: SDUIEmptyProps) {
  const containerStyle: ViewStyle = {
    flexDirection: 'column',
    flex: 1,
    alignItems: 'stretch', // FF4-EC-003: children fill available width
  };

  return <View style={containerStyle}>{children}</View>;
}
