import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { usePreviewStore } from '../stores/usePreviewStore';
import { PreviewPicker } from './PreviewPicker';
import { BrowserPreview } from './BrowserPreview';

interface AppSummary {
  id: string;
  name: string;
  icon?: string | null;
  theme?: Record<string, unknown>;
  design_tokens?: Record<string, unknown>;
  dark_mode?: boolean;
  bottom_bar_config?: unknown[];
  launchpad_config?: unknown[];
}

interface AppPreviewFlowProps {
  onClose: () => void;
}

/**
 * FF3-APP-PREVIEW-001 / FF4-APP-014: Browser + device preview using the same flow as App Editor.
 */
export function AppPreviewFlow({ onClose }: AppPreviewFlowProps) {
  const startPreview = usePreviewStore(s => s.startPreview);
  const exitPreview = usePreviewStore(s => s.exitPreview);
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<AppSummary | null>(null);
  const [showPicker, setShowPicker] = useState(true);
  const [showBrowser, setShowBrowser] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadDefaultApp = async () => {
      setLoading(true);
      try {
        const list = await api.getApps({ limit: 1 });
        const first = list.items?.[0] as AppSummary | undefined;
        if (!first?.id) {
          toast.error('No app found. Create an app in App Editor first.');
          onClose();
          return;
        }
        const detail = await api.getApp(first.id) as AppSummary;
        if (!cancelled) {
          setApp(detail);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load app for preview');
          onClose();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDefaultApp();
    return () => {
      cancelled = true;
    };
  }, [onClose]);

  const handleClose = () => {
    exitPreview();
    onClose();
  };

  const handleBrowserPreview = () => {
    if (!app) return;
    startPreview(
      {
        id: app.id,
        name: app.name,
        icon: app.icon ?? '📱',
        theme: app.theme ?? {},
        design_tokens: app.design_tokens ?? {},
        dark_mode: Boolean(app.dark_mode),
        bottom_bar_config: app.bottom_bar_config ?? [],
        launchpad_config: app.launchpad_config ?? [],
      },
      'browser',
    );
    setShowPicker(false);
    setShowBrowser(true);
  };

  if (loading || !app) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg px-8 py-6 text-sm text-gray-600">Loading app preview…</div>
      </div>
    );
  }

  return (
    <>
      {showPicker && (
        <PreviewPicker
          appId={app.id}
          onSelectBrowser={handleBrowserPreview}
          onClose={handleClose}
        />
      )}
      {showBrowser && (
        <BrowserPreview appId={app.id} onClose={handleClose} />
      )}
    </>
  );
}
