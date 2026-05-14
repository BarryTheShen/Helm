/**
 * SDUIContext — Inject dispatch and dataBinding to SDUI component trees.
 *
 * The SDUI renderer unconditionally passes `dispatch` and `dataBinding` as
 * props to every component (see V2ComponentRenderer in SDUIRenderer.tsx).
 * Container components like SDUIEmpty accept these props so they function as
 * first-class registry components (FF4-EC-005), but they don't consume them
 * directly — they provide dispatch downward via context so that deeply nested
 * children can access it even if they bypass the standard renderer pipeline.
 *
 * Usage:
 *   import { useSDUIDispatch } from '@/contexts/SDUIContext';
 *   const dispatch = useSDUIDispatch();
 *   if (dispatch) dispatch({ type: 'go_back' });
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { SDUIAction, SDUIDataBinding } from '@/types/sdui';

// ── Dispatch Context ──────────────────────────────────────────────────────────

export type SDUIDispatch = (action: SDUIAction) => void;

const SDUIDispatchContext = createContext<SDUIDispatch | undefined>(undefined);

/**
 * Provider that makes the renderer's dispatch function available to all
 * descendants via useSDUIDispatch(). Container components (SDUIEmpty, Card, etc.)
 * wrap their children with this provider.
 */
export function SDUIDispatchProvider({
  dispatch,
  children,
}: {
  dispatch?: SDUIDispatch;
  children: ReactNode;
}) {
  return (
    <SDUIDispatchContext.Provider value={dispatch}>
      {children}
    </SDUIDispatchContext.Provider>
  );
}

/**
 * Hook to access the dispatch function from the nearest SDUI ancestor.
 * Returns undefined if no provider is in the tree (e.g., outside SDUI rendering).
 */
export function useSDUIDispatch(): SDUIDispatch | undefined {
  return useContext(SDUIDispatchContext);
}

// ── Data Binding Context ──────────────────────────────────────────────────────

const SDUIDataBindingContext = createContext<SDUIDataBinding | undefined>(undefined);

/**
 * Provider that makes the data binding config available to descendants.
 * Container components pass the binding through for children that may
 * need it for pull-to-refresh or field mapping.
 */
export function SDUIDataBindingProvider({
  dataBinding,
  children,
}: {
  dataBinding?: SDUIDataBinding;
  children: ReactNode;
}) {
  return (
    <SDUIDataBindingContext.Provider value={dataBinding}>
      {children}
    </SDUIDataBindingContext.Provider>
  );
}

/**
 * Hook to access the SDUIDataBinding from the nearest container ancestor.
 */
export function useSDUIDataBinding(): SDUIDataBinding | undefined {
  return useContext(SDUIDataBindingContext);
}
