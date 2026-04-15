/**
 * componentStateStore — cross-component state for SDUI variable system.
 *
 * Components register their state on mount and unregister on unmount.
 * Other components (or the variable resolver) can read state by componentId + key.
 */
import { create } from 'zustand';

interface ComponentStateStore {
  states: Record<string, Record<string, any>>;
  getComponentState: (componentId: string, key: string) => any;
  setComponentState: (componentId: string, key: string, value: any) => void;
  registerComponent: (componentId: string, initialState?: Record<string, any>) => void;
  unregisterComponent: (componentId: string) => void;
}

export const useComponentStateStore = create<ComponentStateStore>((set, get) => ({
  states: {},

  getComponentState: (componentId, key) => {
    return get().states[componentId]?.[key];
  },

  setComponentState: (componentId, key, value) => {
    set((state) => ({
      states: {
        ...state.states,
        [componentId]: {
          ...state.states[componentId],
          [key]: value,
        },
      },
    }));
  },

  registerComponent: (componentId, initialState) => {
    set((state) => ({
      states: {
        ...state.states,
        [componentId]: initialState ?? {},
      },
    }));
  },

  unregisterComponent: (componentId) => {
    set((state) => {
      const { [componentId]: _, ...rest } = state.states;
      return { states: rest };
    });
  },
}));
