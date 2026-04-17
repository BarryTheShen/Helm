import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SDUIPreview } from './SDUIPreview';
import { Home, MessageCircle, Calendar, Newspaper, Settings } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  screen_json: any;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

interface TabConfig {
  id: string;
  label: string;
  icon: typeof Home;
  category: string;
}

const TABS: TabConfig[] = [
  { id: 'home', label: 'Home', icon: Home, category: 'dashboard' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, category: 'custom' },
  { id: 'planner', label: 'Planner', icon: Calendar, category: 'planner' },
  { id: 'feed', label: 'Feed', icon: Newspaper, category: 'custom' },
  { id: 'settings', label: 'Settings', icon: Settings, category: 'custom' },
];

interface AppPreviewProps {
  onClose: () => void;
}

export function AppPreview({ onClose }: AppPreviewProps) {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch templates for each category
        const categories = ['dashboard', 'custom', 'planner'];
        const templateMap: Record<string, Template> = {};

        for (const category of categories) {
          try {
            const data = await api.get<PaginatedResponse<Template>>(
              `/api/templates?category=${category}&limit=1`
            );

            if (data.items && data.items.length > 0) {
              const templateListItem = data.items[0];
              // Fetch full template details to get screen_json
              const template = await api.get<Template>(`/api/templates/${templateListItem.id}`);

              // Map first template of each category to tabs
              if (category === 'dashboard') {
                templateMap['home'] = template;
              } else if (category === 'planner') {
                templateMap['planner'] = template;
              } else if (category === 'custom') {
                // Assign to remaining tabs
                if (!templateMap['chat']) templateMap['chat'] = template;
                else if (!templateMap['feed']) templateMap['feed'] = template;
                else if (!templateMap['settings']) templateMap['settings'] = template;
              }
            }
          } catch (err) {
            console.error(`Failed to fetch ${category} templates:`, err);
          }
        }

        setTemplates(templateMap);
      } catch (err) {
        setError('Failed to load templates');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  const activeTemplate = templates[activeTab];

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
                  Loading templates...
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full text-red-500 text-sm px-4 text-center">
                  {error}
                </div>
              ) : activeTemplate ? (
                <div className="h-full overflow-auto">
                  <SDUIPreview json={activeTemplate.screen_json} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm px-4 text-center">
                  No template available for {TABS.find(t => t.id === activeTab)?.label}
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="bg-white rounded-b-3xl border border-t-0 border-gray-300 px-2 py-2">
              <div className="flex items-center justify-around">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const hasTemplate = !!templates[tab.id];

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      disabled={!hasTemplate && !loading}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'text-blue-600'
                          : hasTemplate
                          ? 'text-gray-600 hover:text-gray-900'
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs">{tab.label}</span>
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
