import { create } from 'zustand';
import type { ModuleVersionPolicyRef } from '../lib/previewResolver';

export interface PreviewAppConfig {
  id: string;
  name: string;
  icon: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design_tokens: Record<string, any>;
  dark_mode: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bottom_bar_config: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  launchpad_config: any[];
  /** Per-module icon overrides from app config (FF4-APP-001). */
  module_icons?: Record<string, string>;
  /** Per-module enabled flags (FF4-APP-007/014). */
  module_enabled?: Record<string, boolean>;
  /** Per-module version policies from App Editor (FF4-APP-010) */
  moduleReferences?: ModuleVersionPolicyRef[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  screens?: Record<string, any>;
}

interface PreviewState {
  isPreviewMode: boolean;
  previewAppConfig: PreviewAppConfig | null;
  previewType: 'browser' | 'device' | null;
  previewStartTime: number | null;

  // Actions
  startPreview: (config: PreviewAppConfig, type: 'browser' | 'device') => void;
  exitPreview: () => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  isPreviewMode: false,
  previewAppConfig: null,
  previewType: null,
  previewStartTime: null,

  startPreview: (config, type) => set({
    isPreviewMode: true,
    previewAppConfig: config,
    previewType: type,
    previewStartTime: Date.now(),
  }),

  exitPreview: () => set({
    isPreviewMode: false,
    previewAppConfig: null,
    previewType: null,
    previewStartTime: null,
  }),
}));
