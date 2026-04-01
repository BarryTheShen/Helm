/**
 * useBreakpoint — returns the current size class for responsive layouts.
 *
 * Two breakpoints:
 *   - 'compact' (phone): width < 768
 *   - 'regular' (tablet/iPad): width >= 768
 *
 * Used by the Row-by-Row SDUI renderer to pick the correct layout variant
 * for each row (compact = stacked, regular = side-by-side).
 */
import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

export type SizeClass = 'compact' | 'regular';

const BREAKPOINT = 768;

function getSizeClass(): SizeClass {
  const { width } = Dimensions.get('window');
  return width >= BREAKPOINT ? 'regular' : 'compact';
}

export function useBreakpoint(): SizeClass {
  const [sizeClass, setSizeClass] = useState<SizeClass>(getSizeClass);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setSizeClass(window.width >= BREAKPOINT ? 'regular' : 'compact');
    });
    return () => subscription.remove();
  }, []);

  return sizeClass;
}
