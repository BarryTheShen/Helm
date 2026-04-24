import { useEffect, useState } from 'react';
import { X, Smartphone } from 'lucide-react';
import { usePreviewStore } from '../stores/usePreviewStore';
import { SDUIPreview } from './SDUIPreview';

interface BrowserPreviewProps {
  appId: string;
  onClose: () => void;
}

export function BrowserPreview({ appId, onClose }: BrowserPreviewProps) {
  const { previewAppConfig, exitPreview } = usePreviewStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'chat' | 'modules' | 'calendar' | 'forms'>('home');

  useEffect(() => {
    const loadPreviewData = async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: Replace with actual API call to /api/preview/browser
        // const response = await api.post(`/api/preview/browser`, { app_id: appId });
        // startPreview(response.config, 'browser');

        // Mock preview data for now
        await new Promise(resolve => setTimeout(resolve, 500));
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
        setLoading(false);
      }
    };

    void loadPreviewData();
  }, [appId]);

  const handleClose = () => {
    exitPreview();
    onClose();
  };

  // Mock SDUI screen data for demonstration
  const mockScreens: Record<string, any> = {
    home: {
      rows: [
        {
          id: 'row-1',
          height: 'auto',
          cells: [
            {
              id: 'cell-1',
              width: '100%',
              content: {
                id: 'text-1',
                type: 'Text',
                props: {
                  content: 'Welcome to Home',
                  variant: 'heading',
                  fontSize: 24,
                  fontWeight: '700',
                },
              },
            },
          ],
        },
        {
          id: 'row-2',
          height: 'auto',
          cells: [
            {
              id: 'cell-2',
              width: '100%',
              content: {
                id: 'button-1',
                type: 'Button',
                props: {
                  label: 'Get Started',
                  variant: 'primary',
                  size: 'lg',
                },
              },
            },
          ],
        },
      ],
    },
    chat: {
      rows: [
        {
          id: 'row-1',
          height: 'auto',
          cells: [
            {
              id: 'cell-1',
              width: '100%',
              content: {
                id: 'chat-1',
                type: 'ChatModule',
                props: {},
              },
            },
          ],
        },
      ],
    },
    modules: {
      rows: [
        {
          id: 'row-1',
          height: 'auto',
          cells: [
            {
              id: 'cell-1',
              width: '100%',
              content: {
                id: 'text-1',
                type: 'Text',
                props: {
                  content: 'Available Modules',
                  variant: 'heading',
                },
              },
            },
          ],
        },
      ],
    },
    calendar: {
      rows: [
        {
          id: 'row-1',
          height: 'auto',
          cells: [
            {
              id: 'cell-1',
              width: '100%',
              content: {
                id: 'calendar-1',
                type: 'CalendarModule',
                props: {},
              },
            },
          ],
        },
      ],
    },
    forms: {
      rows: [
        {
          id: 'row-1',
          height: 'auto',
          cells: [
            {
              id: 'cell-1',
              width: '100%',
              content: {
                id: 'text-1',
                type: 'Text',
                props: {
                  content: 'Forms',
                  variant: 'heading',
                },
              },
            },
          ],
        },
      ],
    },
  };

  const currentScreenData = mockScreens[currentScreen];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Browser Preview</h2>
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

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500">Loading preview...</p>
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
              {/* Left Sidebar - Tab Navigation */}
              <div className="w-20 bg-gray-50 border-r border-gray-200 shrink-0 flex flex-col items-center py-4 gap-2">
                {previewAppConfig?.bottom_bar_config.map((slot: any) => (
                  <button
                    key={slot.module_instance_id}
                    onClick={() => setCurrentScreen(slot.module_type)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      currentScreen === slot.module_type
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

              {/* Center - iPhone Mockup with SDUI Content */}
              <div className="flex-1 flex items-center justify-center bg-gray-100 p-8 overflow-auto">
                <div className="relative">
                  {/* iPhone Frame */}
                  <div className="w-[375px] h-[812px] bg-white rounded-[3rem] shadow-2xl border-8 border-gray-900 overflow-hidden flex flex-col">
                    {/* Status Bar */}
                    <div className="h-11 bg-gray-50 border-b border-gray-200 flex items-center justify-center shrink-0">
                      <div className="text-xs text-gray-500">9:41</div>
                    </div>

                    {/* Content Area - SDUI Renderer */}
                    <div className="flex-1 overflow-y-auto bg-white">
                      {currentScreenData ? (
                        <SDUIPreview
                          json={currentScreenData}
                          maxWidth={375}
                          maxHeight={700}
                          className="h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                          No content for {currentScreen}
                        </div>
                      )}
                    </div>

                    {/* Bottom Bar */}
                    <div className="h-[88px] bg-white border-t border-gray-200 px-4 pb-6 pt-2 shrink-0">
                      <div className="flex items-center justify-around h-full">
                        {previewAppConfig?.bottom_bar_config.map((slot: any) => (
                          <button
                            key={slot.module_instance_id}
                            onClick={() => setCurrentScreen(slot.module_type)}
                            className={`flex flex-col items-center gap-1 min-w-0 transition-colors ${
                              currentScreen === slot.module_type
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

              {/* Right Sidebar - Info */}
              <div className="w-64 bg-gray-50 border-l border-gray-200 shrink-0 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Preview Info</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">Mode:</span> Browser
                      </p>
                      <p>
                        <span className="font-medium">Device:</span> iPhone (375x812)
                      </p>
                      <p>
                        <span className="font-medium">Current Screen:</span> {currentScreen}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-700 mb-2">Interactions</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>✓ Tab navigation</p>
                      <p>✓ Component rendering</p>
                      <p>⚠️ Actions (read-only)</p>
                      <p>⚠️ Live data (mocked)</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 italic">
                      This is a browser-based preview. For full interactivity, use device preview.
                    </p>
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
