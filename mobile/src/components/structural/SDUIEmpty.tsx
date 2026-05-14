/**
 * SDUIEmpty — Simple vertical container for stacking child components.
 * Simplified: no gap, padding, or background. Just a flex column.
 *
 * REQ-ID: FF4-EC-001 — Vertical row concept (flexDirection: 'column', flex: 1)
 * REQ-ID: FF4-EC-003 — Component fitting: children fill available width (alignItems: 'stretch')
 * REQ-ID: FF4-EC-004 — No separate layout system — inherits from flex layout
 * REQ-ID: FF4-EC-005 — Real editable component with SDUI props (dispatch, dataBinding)
 * REQ-ID: FF4-EC-006 — No extra styling (no gap/padding/background)
 *
 * dispatch and dataBinding are accepted from the SDUI renderer (which passes
 * them unconditionally to all registry components) and forwarded to children
 * via SDUIContext. The Empty container itself does not directly consume
 * dispatch (it has no interactive elements) or dataBinding (it is a structural
 * container; children handle their own data binding).
 */
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { SDUIDataBinding, SDUIAction } from '@/types/sdui';
import { SDUIDispatchProvider, SDUIDataBindingProvider } from '@/contexts/SDUIContext';

interface SDUIEmptyProps {
  children?: React.ReactNode;
  /** Injected by the SDUI renderer for action dispatch */
  dispatch?: (action: SDUIAction) => void;
  /** Data binding for connected data sources */
  dataBinding?: SDUIDataBinding;
}

export function SDUIEmpty({ children, dispatch, dataBinding }: SDUIEmptyProps) {
  const containerStyle: ViewStyle = {
    flexDirection: 'column',
    flex: 1,
    alignItems: 'stretch', // FF4-EC-003: children fill available width
  };

  // Wrap children with context providers so descendant components can
  // access dispatch and dataBinding via useSDUIDispatch / useSDUIDataBinding.
  // This satisfies FF4-EC-005: Empty is a first-class registry component
  // that accepts SDUI props and forwards them appropriately.
  return (
    <SDUIDispatchProvider dispatch={dispatch}>
      <SDUIDataBindingProvider dataBinding={dataBinding}>
        <View style={containerStyle}>{children}</View>
      </SDUIDataBindingProvider>
    </SDUIDispatchProvider>
  );
}
