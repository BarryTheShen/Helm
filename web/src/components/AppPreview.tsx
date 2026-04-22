import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SDUIPreview } from './SDUIPreview';
import { Home, MessageCircle, Grid3x3, Calendar, FileText, Bell, Settings } from 'lucide-react';

interface ModuleInfo {
  module_id: string;
  name: string;
  icon: string;
  has_screen: boolean;
  is_custom?: boolean;
}

interface ModuleScreen {
  screen?: any;
  state_json?: any;
}

interface AppPreviewProps {
  onClose: () => void;
}

export function AppPreview({ onClose }: AppPreviewProps) {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [screens, setScreens] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all modules
        const modulesData = await api.get<{ items: ModuleInfo[] }>('/api/sdui/modules');
        const allModules = modulesData.items || [];

        // Filter to only show the main 7 tabs (exclude custom modules for now)
        const mainTabs = allModules.filter(m => !m.is_custom);
        setModules(mainTabs);

        // Fetch screens for all modules that have them
        const screenMap: Record<string, any> = {};

        for (const module of mainTabs) {
          if (module.has_screen) {
            try {
              const screenData = await api.get<ModuleScreen>(`/api/sdui/${module.module_id}`);
              screenMap[module.module_id] = screenData.screen || screenData.state_json || null;
            } catch (err) {
              console.error(`Failed to fetch screen for ${module.module_id}:`, err);
            }
          }
        }

        setScreens(screenMap);

        // Set active tab to first module with a screen, or first module
        const firstWithScreen = mainTabs.find(m => m.has_screen);
        if (firstWithScreen) {
          setActiveTab(firstWithScreen.module_id);
        } else if (mainTabs.length > 0) {
          setActiveTab(mainTabs[0].module_id);
        }
      } catch (err) {
        setError('Failed to load modules');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, []);

  const activeScreen = screens[activeTab];
  const activeModule = modules.find(m => m.module_id === activeTab);

  // Map module IDs to icons
  const getIconComponent = (moduleId: string) => {
    switch (moduleId) {
      case 'home': return Home;
      case 'chat': return MessageCircle;
      case 'modules': return Grid3x3;
      case 'calendar': return Calendar;
      case 'forms': return FileText;
      case 'alerts': return Bell;
      case 'settings': return Settings;
      default: return Grid3x3;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">App Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Phone Frame */}
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto" style={{ width: 375 }}>
            {/* Status bar */}
            <div className="bg-white rounded-t-3xl border border-b-0 border-gray-300 px-6 py-2 flex items-center justify-between text-xs">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <span>📶</span>
                <span>📡</span>
                <span>🔋</span>
              </div>
            </div>

            {/* Screen content */}
            <div className="bg-white border-l border-r border-gray-300" style={{ height: 600, overflow: 'hidden' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Loading modules...
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full text-red-500 text-sm px-4 text-center">
                  {error}
                </div>
              ) : activeScreen ? (
                <div className="h-full overflow-auto">
                  <SDUIPreview json={activeScreen} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm px-4 text-center">
                  No screen available for {activeModule?.name || activeTab}
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="bg-white rounded-b-3xl border border-t-0 border-gray-300 px-2 py-2">
              <div className="flex items-center justify-around">
                {modules.map(module => {
                  const Icon = getIconComponent(module.module_id);
                  const isActive = activeTab === module.module_id;
                  const hasScreen = !!screens[module.module_id];

                  return (
                    <button
                      key={module.module_id}
                      onClick={() => setActiveTab(module.module_id)}
                      disabled={!hasScreen && !loading}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'text-blue-600'
                          : hasScreen
                          ? 'text-gray-600 hover:text-gray-900'
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-[10px]">{module.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Home indicator */}
              <div className="flex items-center justify-center mt-1">
                <div className="w-24 h-1 bg-gray-300 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
