import { create } from 'zustand';

interface PreviewState {
  /** Whether the app is in preview mode (admin previewing changes). */
  isPreviewMode: boolean;
  /** The preview session ID, if active. */
  sessionId: string | null;

  /** Enter preview mode for the given session. */
  enterPreview: (sessionId: string) => void;
  /** Exit preview mode. */
  exitPreview: () => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  isPreviewMode: false,
  sessionId: null,

  enterPreview: (sessionId: string) => {
    set({ isPreviewMode: true, sessionId });
  },

  exitPreview: () => {
    set({ isPreviewMode: false, sessionId: null });
  },
}));
