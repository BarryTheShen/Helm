import { useState, useEffect } from 'react';
import { Smartphone, Plus, Save, Trash2, ChevronDown, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { useAppEditorStore } from '../stores/useAppEditorStore';
import { usePreviewStore } from '../stores/usePreviewStore';
import { BottomBarConfig } from '../components/AppEditor/BottomBarConfig';
import { PreviewPicker } from '../components/PreviewPicker';
import { BrowserPreview } from '../components/BrowserPreview';
import type { App, ModuleInstance, BottomBarSlot } from '../stores/useAppEditorStore';

export function AppEditorPage() {
  const {
    currentAppId,
    apps,
    selectedModuleId,
    isDragging,
    setCurrentApp,
    setApps,
    setSelectedModule,
    setIsDragging,
    updateApp,
    addApp,
    removeApp,
  } = useAppEditorStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAppSwitcher, setShowAppSwitcher] = useState(false);
  const [availableModules, setAvailableModules] = useState<ModuleInstance[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [showBrowserPreview, setShowBrowserPreview] = useState(false);

  const { startPreview } = usePreviewStore();
  const currentApp = apps?.find(app => app.id === currentAppId);

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    console.log(`[AppEditor] message: ${type} — ${text}`);
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Load apps on mount
  useEffect(() => {
    console.log('[AppEditor] mount — loading apps');
    const loadApps = async () => {
      setLoading(true);
      try {
        const response = await api.getApps();
        console.log(`[AppEditor] loadApps() — loaded ${response.items.length} apps`);
        setApps(response.items);
        if (response.items.length > 0 && !currentAppId) {
          console.log(`[AppEditor] loadApps() — auto-selecting first app: ${response.items[0].id}`);
          setCurrentApp(response.items[0].id);
        }
      } catch (err) {
        console.error('[AppEditor] loadApps() — failed:', err instanceof Error ? err.message : err);
        showMsg('error', err instanceof Error ? err.message : 'Failed to load apps');
      } finally {
        setLoading(false);
      }
    };

    void loadApps();
  }, []);

  // Load available modules
  useEffect(() => {
    console.log('[AppEditor] mount — loading modules');
    const loadModules = async () => {
      try {
        const response = await api.getModuleInstances();
        const activeCount = response.items.filter(m => m.status === 'active').length;
        console.log(`[AppEditor] loadModules() — loaded ${response.items.length} modules, ${activeCount} active`);
        setAvailableModules(response.items.filter(m => m.status === 'active'));
      } catch (err) {
        console.error('[AppEditor] loadModules() — failed:', err instanceof Error ? err.message : err);
        showMsg('error', 'Failed to load modules');
      }
    };

    void loadModules();
  }, []);

  const handleUpdateBottomBar = (slots: BottomBarSlot[]) => {
    if (!currentAppId) return;
    updateApp(currentAppId, { bottom_bar_config: slots });
  };

  const handleRemoveSlot = (slotPosition: number) => {
    if (!currentApp) return;
    const updated = currentApp.bottom_bar_config.filter(s => s.slot_position !== slotPosition);
    // Reindex remaining slots
    const reindexed = updated.map((slot, index) => ({ ...slot, slot_position: index }));
    updateApp(currentApp.id, { bottom_bar_config: reindexed });
  };

  const handleAddToBottomBar = (module: ModuleInstance) => {
    if (!currentApp) return;
    if (currentApp.bottom_bar_config.length >= 5) {
      showMsg('error', 'Bottom bar is full (5 slots max)');
      return;
    }

    const alreadyInBar = currentApp.bottom_bar_config.some(
      s => s.module_instance_id === module.module_instance_id
    );
    if (alreadyInBar) {
      showMsg('info', 'Module already in bottom bar');
      return;
    }

    const newSlot: BottomBarSlot = {
      module_instance_id: module.module_instance_id,
      module_type: module.module_type,
      name: module.name,
      icon: module.icon,
      slot_position: currentApp.bottom_bar_config.length,
    };

    updateApp(currentApp.id, {
      bottom_bar_config: [...currentApp.bottom_bar_config, newSlot],
    });
    showMsg('success', `Added ${module.name} to bottom bar`);
  };

  const handleSave = async () => {
    if (!currentApp) return;
    console.log('[AppEditor] handleSave() — saving app:', currentApp.id);
    setSaving(true);
    try {
      await api.updateApp(currentApp.id, currentApp);
      console.log('[AppEditor] handleSave() — app saved successfully');
      showMsg('success', 'App saved successfully');
    } catch (err) {
      console.error('[AppEditor] handleSave() — failed:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Failed to save app');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewBrowser = () => {
    if (!currentApp) return;
    console.log('[AppEditor] handlePreviewBrowser() — opening browser preview for:', currentApp.name);
    setShowPreviewPicker(false);

    // Start preview with current app config
    startPreview(
      {
        id: currentApp.id,
        name: currentApp.name,
        icon: currentApp.icon,
        theme: currentApp.theme,
        design_tokens: currentApp.design_tokens,
        dark_mode: currentApp.dark_mode,
        bottom_bar_config: currentApp.bottom_bar_config,
        launchpad_config: currentApp.launchpad_config,
      },
      'browser'
    );

    setShowBrowserPreview(true);
  };

  const handlePreviewDevice = () => {
    if (!currentApp) return;
    setShowPreviewPicker(false);
    console.log('[AppEditor] handlePreviewDevice() — clicked (not yet implemented)');
    showMsg('info', 'Device preview coming soon');
    // TODO: Implement device preview
  };

  const handleCreateApp = async () => {
    console.log('[AppEditor] handleCreateApp() — creating new app');
    try {
      const newApp = await api.createApp({
        name: 'New App',
        icon: '📱',
        theme: 'light',
        design_tokens: {},
        dark_mode: false,
        default_launch_module_id: null,
        bottom_bar_config: [],
        launchpad_config: [],
      });
      console.log('[AppEditor] handleCreateApp() — created app:', newApp.id);
      setApps([...apps, newApp]);
      setCurrentApp(newApp.id);
      setShowAppSwitcher(false);
      showMsg('success', 'App created successfully');
    } catch (err) {
      console.error('[AppEditor] handleCreateApp() — failed:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Failed to create app');
    }
  };

  const launchpadModules = availableModules.filter(
    module => !currentApp?.bottom_bar_config.some(s => s.module_instance_id === module.module_instance_id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading app editor...</div>
      </div>
    );
  }

  if (!currentApp) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No apps found</p>
          <button onClick={handleCreateApp} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create New App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          {/* App Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowAppSwitcher(!showAppSwitcher)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <span className="text-lg">{currentApp.icon}</span>
              <span className="text-sm font-medium">{currentApp.name}</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {showAppSwitcher && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-64 py-1">
                {apps.map(app => (
                  <button
                    key={app.id}
                    onClick={() => {
                      setCurrentApp(app.id);
                      setShowAppSwitcher(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                      app.id === currentAppId ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <span className="text-lg">{app.icon}</span>
                    <span>{app.name}</span>
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={handleCreateApp} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                  <Plus size={14} />
                  <span>New App</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {message && (
            <span className={`text-xs px-3 py-1 rounded ${
              message.type === 'success' ? 'bg-green-50 text-green-700'
              : message.type === 'info' ? 'bg-blue-50 text-blue-700'
              : 'bg-red-50 text-red-700'
            }`}>{message.text}</span>
          )}

          <button
            onClick={() => setShowPreviewPicker(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Eye size={14} />
            Preview
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Bottom Bar Config */}
        <div className="w-80 bg-white border-r border-gray-200 shrink-0 overflow-y-auto p-4">
          <BottomBarConfig
            slots={currentApp.bottom_bar_config}
            availableModules={availableModules}
            onUpdateSlots={handleUpdateBottomBar}
            onRemoveSlot={handleRemoveSlot}
            isDragging={isDragging}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          />
        </div>

        {/* Center - iPhone Mockup */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-8 overflow-auto">
          <div className="relative">
            {/* iPhone Frame */}
            <div className="w-[375px] h-[812px] bg-white rounded-[3rem] shadow-2xl border-8 border-gray-900 overflow-hidden">
              {/* Status Bar */}
              <div className="h-11 bg-gray-50 border-b border-gray-200 flex items-center justify-center">
                <div className="text-xs text-gray-500">9:41</div>
              </div>

              {/* Content Area */}
              <div className="flex-1 h-[calc(812px-44px-88px)] bg-white flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Smartphone size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">App Preview</p>
                </div>
              </div>

              {/* Bottom Bar */}
              <div className="h-[88px] bg-white border-t border-gray-200 px-4 pb-6 pt-2">
                <div className="flex items-center justify-around h-full">
                  {currentApp.bottom_bar_config.length === 0 ? (
                    <div className="text-xs text-gray-400">No modules in bottom bar</div>
                  ) : (
                    currentApp.bottom_bar_config
                      .sort((a, b) => a.slot_position - b.slot_position)
                      .map((slot) => (
                        <button
                          key={slot.module_instance_id}
                          className="flex flex-col items-center gap-1 min-w-0"
                          onClick={() => setSelectedModule(slot.module_instance_id)}
                        >
                          <span className="text-2xl">{slot.icon}</span>
                          <span className="text-[10px] text-gray-600 truncate max-w-[60px]">
                            {slot.name}
                          </span>
                        </button>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Launchpad & Properties */}
        <div className="w-80 bg-white border-l border-gray-200 shrink-0 overflow-y-auto p-4">
          <div className="space-y-6">
            {/* Launchpad Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Launchpad</h3>
              <p className="text-xs text-gray-500 mb-3">
                Modules not in the bottom bar appear in the launchpad
              </p>
              <div className="space-y-2">
                {launchpadModules.map(module => (
                  <div
                    key={module.module_instance_id}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <span className="text-lg">{module.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{module.name}</div>
                      <div className="text-xs text-gray-500">{module.module_type}</div>
                    </div>
                    <button
                      onClick={() => handleAddToBottomBar(module)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Add to bottom bar"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
                {launchpadModules.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    All modules are in the bottom bar
                  </div>
                )}
              </div>
            </div>

            {/* App Properties Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">App Properties</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">App Name</label>
                  <input
                    type="text"
                    value={currentApp.name}
                    onChange={(e) => updateApp(currentApp.id, { name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
                  <input
                    type="text"
                    value={currentApp.icon}
                    onChange={(e) => updateApp(currentApp.id, { icon: e.target.value })}
                    className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-center"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={currentApp.dark_mode}
                      onChange={(e) => updateApp(currentApp.id, { dark_mode: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    Dark Mode
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Picker Modal */}
      {showPreviewPicker && currentApp && (
        <PreviewPicker
          appId={currentApp.id}
          onSelectBrowser={handlePreviewBrowser}
          onSelectDevice={handlePreviewDevice}
          onClose={() => setShowPreviewPicker(false)}
        />
      )}

      {/* Browser Preview Modal */}
      {showBrowserPreview && currentApp && (
        <BrowserPreview
          appId={currentApp.id}
          onClose={() => setShowBrowserPreview(false)}
        />
      )}
    </div>
  );
}
