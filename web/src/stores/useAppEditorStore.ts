import { create } from 'zustand';

export interface ModuleInstance {
  module_instance_id: string;
  module_type: string;
  name: string;
  icon: string;
  status: 'active' | 'disabled';
  template_id: string | null;
}

export interface BottomBarSlot {
  module_instance_id: string;
  module_type: string;
  name: string;
  icon: string;
  slot_position: number; // 0-4
}

export interface App {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  splash: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design_tokens: Record<string, any>;
  dark_mode: boolean;
  default_launch_module_instance_id: string | null;
  bottom_bar_config: BottomBarSlot[];
  launchpad_config: ModuleInstance[];
  /** Per-module icon overrides keyed by module_instance_id (FF4-APP-001/013) */
  module_icons?: Record<string, string>;
  /** Per-module enabled flag; omitted or true = enabled (FF4-APP-007/014) */
  module_enabled?: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

interface AppEditorState {
  currentAppId: string | null;
  apps: App[];
  selectedModuleId: string | null;
  isDragging: boolean;

  // Actions
  setCurrentApp: (appId: string | null) => void;
  setApps: (apps: App[]) => void;
  setSelectedModule: (moduleId: string | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  updateApp: (appId: string, updates: Partial<App>) => void;
  addApp: (app: App) => void;
  removeApp: (appId: string) => void;
}

export const useAppEditorStore = create<AppEditorState>((set) => ({
  currentAppId: null,
  apps: [],
  selectedModuleId: null,
  isDragging: false,

  setCurrentApp: (appId) => set({ currentAppId: appId }),

  setApps: (apps) => set({ apps }),

  setSelectedModule: (moduleId) => set({ selectedModuleId: moduleId }),

  setIsDragging: (isDragging) => set({ isDragging }),

  updateApp: (appId, updates) => set((state) => ({
    apps: state.apps.map((app) =>
      app.id === appId ? { ...app, ...updates } : app
    ),
  })),

  addApp: (app) => set((state) => ({
    apps: [...state.apps, app],
  })),

  removeApp: (appId) => set((state) => ({
    apps: state.apps.filter((app) => app.id !== appId),
    currentAppId: state.currentAppId === appId ? null : state.currentAppId,
  })),
}));
