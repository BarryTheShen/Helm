/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { usePreviewStore } from '../stores/usePreviewStore';
import { SDUIPreview } from './SDUIPreview';
import { AppPhoneShell } from './AppPhoneShell';
import {
  resolveAppPreviewBundle,
  type AppPreviewBundle,
  type PreviewBottomBarSlot,
} from '../lib/previewResolver';

/**
 * BrowserPreview — Full app preview in web admin (FF4-APP-014/020).
 * Resolves app working draft + per-module versions via previewResolver.
 */
interface BrowserPreviewProps {
  appId: string;
  onClose: () => void;
}

export function BrowserPreview({ appId, onClose }: BrowserPreviewProps) {
  const { previewAppConfig, exitPreview } = usePreviewStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<AppPreviewBundle | null>(null);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);

  useEffect(() => {
    const loadPreviewData = async () => {
      setLoading(true);
      setError(null);
      setBundle(null);

      try {
        const resolved = await resolveAppPreviewBundle(appId, previewAppConfig ?? undefined);
        setBundle(resolved);
        setCurrentModuleId(resolved.defaultModuleId);
      } catch (err) {
        console.error('BrowserPreview: failed to load preview', err);
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    void loadPreviewData();
  }, [appId, previewAppConfig]);

  const handleClose = () => {
    exitPreview();
    onClose();
  };

  const bottomBar = bundle?.bottomBar ?? [];
  const launchpadModules = bundle?.launchpadModules ?? [];
  const previewDarkMode = previewAppConfig?.dark_mode ?? bundle?.darkMode ?? false;
  const moduleIcons = (previewAppConfig as { module_icons?: Record<string, string> } | null)?.module_icons
    ?? (bundle?.appConfig?.module_icons as Record<string, string> | undefined)
    ?? {};
  const resolvePreviewIcon = (moduleId: string, fallback: string) =>
    moduleIcons[moduleId] ?? fallback;
  const currentScreenData = currentModuleId && bundle
    ? bundle.resolvedScreens[currentModuleId]
    : null;
  const currentSlot = bottomBar.find(
    (slot: PreviewBottomBarSlot) => slot.module_instance_id === currentModuleId,
  ) ?? launchpadModules.find(mod => mod.module_instance_id === currentModuleId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="browser-preview-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preview in Web Admin</h2>
              <p className="text-xs text-gray-500">
                {previewAppConfig?.name || bundle?.appConfig?.name as string || 'Loading...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close preview"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500">Resolving app draft and module versions...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-600 mb-2">⚠️</div>
                <p className="text-sm text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-4 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center bg-gray-100 p-8 overflow-auto">
                <AppPhoneShell
                  darkMode={previewDarkMode}
                  bottomBar={bottomBar}
                  launchpadModules={launchpadModules}
                  activeModuleId={currentModuleId}
                  onSelectModule={setCurrentModuleId}
                  embeddedModule
                  resolveIcon={resolvePreviewIcon}
                >
                  {currentScreenData ? (
                    <SDUIPreview
                      json={currentScreenData as any}
                      embedded
                      darkMode={previewDarkMode}
                      className="h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm px-6 text-center">
                      {currentSlot?.name
                        ? `No SDUI content resolved for ${currentSlot.name}`
                        : 'Select a module tab'}
                    </div>
                  )}
                </AppPhoneShell>
              </div>

              <div className="w-64 bg-gray-50 border-l border-gray-200 shrink-0 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Preview Info</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p><span className="font-medium">Mode:</span> Web Admin</p>
                      <p><span className="font-medium">Device:</span> iPhone (375x812)</p>
                      <p><span className="font-medium">Theme:</span> {previewDarkMode ? 'Dark' : 'Light'}</p>
                      <p><span className="font-medium">Module:</span> {currentSlot?.name ?? 'Launchpad'}</p>
                      <p><span className="font-medium">Screens loaded:</span> {bundle?.resolvedCount ?? 0}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Navigation</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentModuleId(null)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Show Launchpad
                    </button>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Data source</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>✓ App working draft</p>
                      <p>✓ Module versions / drafts</p>
                      <p>⚠️ Actions (read-only)</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
