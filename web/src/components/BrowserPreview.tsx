/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { usePreviewStore } from '../stores/usePreviewStore';
import { SDUIPreview } from './SDUIPreview';
import { api } from '../lib/api';
import {
  collectModuleIdsFromAppConfig,
  resolveModuleScreen,
  type ModuleVersionPolicyRef,
} from '../lib/previewResolver';

/**
 * BrowserPreview — Full app preview in web admin (FF4-APP-014).
 * Resolves app working draft + per-module versions (not legacy mock screens).
 */
interface BrowserPreviewProps {
  appId: string;
  onClose: () => void;
}

export function BrowserPreview({ appId, onClose }: BrowserPreviewProps) {
  const { previewAppConfig, exitPreview } = usePreviewStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  const [resolvedScreens, setResolvedScreens] = useState<Record<string, any>>({});
  const [resolvedCount, setResolvedCount] = useState(0);

  useEffect(() => {
    const loadPreviewData = async () => {
      setLoading(true);
      setError(null);
      setResolvedScreens({});
      setResolvedCount(0);

      try {
        const draftResponse = await api.get<{ config_json: Record<string, unknown> }>(
          `/api/apps/${appId}/draft`,
        );
        const appConfig = draftResponse.config_json ?? previewAppConfig ?? {};
        const policies = previewAppConfig?.moduleReferences ?? [];

        const policyByModule = new Map<string, ModuleVersionPolicyRef>();
        for (const ref of policies) {
          policyByModule.set(ref.moduleId, ref);
        }

        const moduleIds = collectModuleIdsFromAppConfig(appConfig as {
          bottom_bar_config?: Array<{ module_instance_id?: string; module_type?: string }>;
          launchpad_config?: Array<string | { module_instance_id?: string }>;
        });

        const bottomBar = (appConfig.bottom_bar_config ?? previewAppConfig?.bottom_bar_config ?? []) as Array<{
          module_instance_id: string;
          module_type?: string;
          name?: string;
          icon?: string;
        }>;

        const screenMap: Record<string, any> = {};
        let loaded = 0;

        await Promise.all(
          moduleIds.map(async (moduleInstanceId) => {
            const slot = bottomBar.find(s => s.module_instance_id === moduleInstanceId);
            const screen = await resolveModuleScreen(
              moduleInstanceId,
              slot?.module_type,
              policyByModule.get(moduleInstanceId),
            );
            if (screen) {
              screenMap[moduleInstanceId] = screen;
              loaded += 1;
            }
          }),
        );

        setResolvedScreens(screenMap);
        setResolvedCount(loaded);

        const defaultModule =
          (appConfig.default_launch_module_instance_id as string | undefined)
          ?? (appConfig.default_launch_module_id as string | undefined)
          ?? bottomBar[0]?.module_instance_id
          ?? moduleIds[0]
          ?? null;

        setCurrentModuleId(defaultModule);
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

  const bottomBar = previewAppConfig?.bottom_bar_config ?? [];
  const currentScreenData = currentModuleId ? resolvedScreens[currentModuleId] : null;
  const currentSlot = bottomBar.find((s: { module_instance_id: string }) => s.module_instance_id === currentModuleId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Preview in Web Admin</h2>
              <p className="text-xs text-gray-500">
                {previewAppConfig?.name || 'Loading...'}
              </p>
            </div>
          </div>
          <button
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
                  onClick={handleClose}
                  className="mt-4 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-20 bg-gray-50 border-r border-gray-200 shrink-0 flex flex-col items-center py-4 gap-2">
                {bottomBar.map((slot: any) => (
                  <button
                    key={slot.module_instance_id}
                    onClick={() => setCurrentModuleId(slot.module_instance_id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      currentModuleId === slot.module_instance_id
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{slot.icon}</span>
                    <span className="text-[9px] font-medium truncate max-w-[60px]">
                      {slot.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex-1 flex items-center justify-center bg-gray-100 p-8 overflow-auto">
                <div className="relative">
                  <div className="w-[375px] h-[812px] bg-white rounded-[3rem] shadow-2xl border-8 border-gray-900 overflow-hidden flex flex-col">
                    <div className="h-11 bg-gray-50 border-b border-gray-200 flex items-center justify-center shrink-0">
                      <div className="text-xs text-gray-500">9:41</div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white">
                      {currentScreenData ? (
                        <SDUIPreview
                          json={currentScreenData}
                          maxWidth={375}
                          maxHeight={700}
                          className="h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm px-6 text-center">
                          {currentSlot?.name
                            ? `No SDUI content resolved for ${currentSlot.name}`
                            : 'Select a module tab'}
                        </div>
                      )}
                    </div>

                    <div className="h-[88px] bg-white border-t border-gray-200 px-4 pb-6 pt-2 shrink-0">
                      <div className="flex items-center justify-around h-full">
                        {bottomBar.map((slot: any) => (
                          <button
                            key={slot.module_instance_id}
                            onClick={() => setCurrentModuleId(slot.module_instance_id)}
                            className={`flex flex-col items-center gap-1 min-w-0 transition-colors ${
                              currentModuleId === slot.module_instance_id
                                ? 'text-blue-600'
                                : 'text-gray-600'
                            }`}
                          >
                            <span className="text-2xl">{slot.icon}</span>
                            <span className="text-[10px] truncate max-w-[60px]">
                              {slot.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-64 bg-gray-50 border-l border-gray-200 shrink-0 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Preview Info</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p><span className="font-medium">Mode:</span> Web Admin</p>
                      <p><span className="font-medium">Device:</span> iPhone (375x812)</p>
                      <p><span className="font-medium">Module:</span> {currentSlot?.name ?? '—'}</p>
                      <p><span className="font-medium">Screens loaded:</span> {resolvedCount}</p>
                    </div>
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
