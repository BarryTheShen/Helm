import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useEditorStore } from '../editor/useEditorStore';
import { StructureTree } from '../editor/StructureTree';
import { EditorCanvas } from '../editor/EditorCanvas';
import { PropertyInspector } from '../editor/PropertyInspector';
import { AppPreview } from '../components/AppPreview';
import { DEVICE_PRESETS, getEditorPersistenceValidationError } from '../editor/types';
import type { DevicePreset, EditorComponent, EditorScreen } from '../editor/types';
import {
  cloneTemplateScreen,
  LOCAL_ROW_TEMPLATES,
  LOCAL_SCREEN_TEMPLATES,
} from '../editor/templateLibrary';
import type { LocalTemplateDefinition } from '../editor/templateLibrary';
import {
  Save, Rocket, Undo2, Redo2, CheckCircle, XCircle, FileText,
  RefreshCw, Monitor, RotateCw, ChevronDown, Code, Trash2, Smartphone
} from 'lucide-react';

interface ModuleInfo {
  module_id: string;
  name: string;
  icon: string;
  has_screen: boolean;
  is_custom?: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_public: boolean;
}

interface TemplateDetail extends Template {
  screen_json: any;
}

interface DraftInfo {
  has_draft: boolean;
  version?: number;
  screen?: any;
}

function getNaturalPresetDimensions(preset: DevicePreset): { width: number; height: number } {
  if (preset.category === 'desktop') {
    return {
      width: Math.max(preset.width, preset.height),
      height: Math.min(preset.width, preset.height),
    };
  }

  return {
    width: Math.min(preset.width, preset.height),
    height: Math.max(preset.width, preset.height),
  };
}

function getModuleDisplayName(module: ModuleInfo | null | undefined, fallback: string): string {
  const name = module?.name?.trim();
  return name && name.length > 0 ? name : fallback;
}

function createLegacySectionTitleRow(title: string, index: number): EditorScreen['rows'][number] {
  const titleComponent: EditorComponent = {
    id: `legacy-section-title-component-${index}`,
    type: 'Text',
    props: {
      content: title,
      variant: 'heading',
      fontSize: 20,
      fontWeight: '600',
    },
  };

  return {
    id: `legacy-section-title-row-${index}`,
    height: 'auto',
    cells: [
      {
        id: `legacy-section-title-cell-${index}`,
        width: 1,
        content: titleComponent,
      },
    ],
  };
}

function createLegacySectionComponentRow(
  component: EditorComponent,
  sectionIndex: number,
  componentIndex: number,
): EditorScreen['rows'][number] {
  return {
    id: `legacy-section-row-${sectionIndex}-${componentIndex}`,
    height: 'auto',
    cells: [
      {
        id: `legacy-section-cell-${sectionIndex}-${componentIndex}`,
        width: 1,
        content: component,
      },
    ],
  };
}

// Normalize legacy screen formats to current Helm format
function normalizeScreenData(screen: any): EditorScreen | null {
  if (!screen) return null;

  if (Array.isArray(screen)) {
    return normalizeScreenData({ rows: screen });
  }

  if (typeof screen !== 'object') {
    return null;
  }

  const record = screen as Record<string, any>;

  // Current format: { rows: [...] }
  if (Array.isArray(record.rows)) {
    return {
      ...record,
      rows: record.rows.map((row: any) => ({
        ...row,
        cells: (row.cells || []).map((cell: any) => {
          const component = cell.content ?? cell.component ?? null;
          return {
            ...cell,
            content: component,
          };
        }),
      })),
    };
  }

  // V1 format: { sections: [{ components: [...] }] }
  if (Array.isArray(record.sections)) {
    const { sections: _sections, ...screenMeta } = record;
    const rows = record.sections.flatMap((section: any, i: number) => {
      const comps = Array.isArray(section.components)
        ? section.components
        : section.component
          ? [section.component]
          : [];
      const sectionTitle = typeof section.title === 'string' ? section.title.trim() : '';
      const nextRows: EditorScreen['rows'] = [];
      const componentRows = comps
        .filter((component: any) => component?.type)
        .map((component: EditorComponent, componentIndex: number) => (
          createLegacySectionComponentRow(component, i, componentIndex)
        ));

      if (!sectionTitle && componentRows.length === 0) {
        return nextRows;
      }

      if (sectionTitle) {
        nextRows.push(createLegacySectionTitleRow(sectionTitle, i));
      }

      nextRows.push(...componentRows);

      return nextRows;
    });
    return { ...screenMeta, rows };
  }

  return null;
}

function extractImportableScreen(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return { rows: payload };
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  if (record.screen_json) {
    return record.screen_json;
  }
  if (record.screen) {
    return record.screen;
  }
  return payload;
}

function detectCustomDeviceCategory(width: number): DevicePreset['category'] {
  if (width >= 1024) return 'desktop';
  if (width >= 744) return 'tablet';
  return 'phone';
}

function buildScreenSnapshot(screen: { rows: any[] }): string {
  return JSON.stringify(screen);
}

function formatLastSaved(date: Date | null): string {
  if (!date) return 'Not saved in this session';
  return new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function EditorPage() {
  // URL params for module selection
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedModule = searchParams.get('module_instance_id') || '';

  // Module state
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [modulesLoadError, setModulesLoadError] = useState<string | null>(null);
  const [screenLoadError, setScreenLoadError] = useState<string | null>(null);
  const [hasPersistedScreen, setHasPersistedScreen] = useState(false);

  // Create module state - removed (now handled by ModulesTree)

  // Draft state
  const [draftInfo, setDraftInfo] = useState<DraftInfo>({ has_draft: false });
  const [approvingDraft, setApprovingDraft] = useState(false);

  // Device preview
  const [selectedPreset, setSelectedPreset] = useState<DevicePreset>(DEVICE_PRESETS[1]); // iPhone 15
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [showJsonView, setShowJsonView] = useState(false);
  const [customDeviceWidth, setCustomDeviceWidth] = useState(String(DEVICE_PRESETS[1].width));
  const [customDeviceHeight, setCustomDeviceHeight] = useState(String(DEVICE_PRESETS[1].height));

  // Template modals
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [showAppPreview, setShowAppPreview] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('custom');
  const [showTemplatePanel, setShowTemplatePanel] = useState(true);
  const [showImportJson, setShowImportJson] = useState(false);
  const [importJsonValue, setImportJsonValue] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(buildScreenSnapshot({ rows: [] }));
  const moduleLoadRequestIdRef = useRef(0);
  const selectedModuleRef = useRef(selectedModule);

  // API connection status
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);

  // Editor store
  const loadScreen = useEditorStore(s => s.loadScreen);
  const applyScreen = useEditorStore(s => s.applyScreen);
  const getScreen = useEditorStore(s => s.getScreen);
  const undo = useEditorStore(s => s.undo);
  const redo = useEditorStore(s => s.redo);
  const historyIndex = useEditorStore(s => s.historyIndex);
  const history = useEditorStore(s => s.history);
  const setDevice = useEditorStore(s => s.setDevice);
  const toggleLandscape = useEditorStore(s => s.toggleLandscape);
  const deviceWidth = useEditorStore(s => s.deviceWidth);
  const deviceHeight = useEditorStore(s => s.deviceHeight);
  const rows = useEditorStore(s => s.rows);

  const screenSnapshot = useMemo(() => buildScreenSnapshot(getScreen()), [getScreen, rows]);
  const hasUnsavedChanges = screenSnapshot !== lastSavedSnapshot;
  const lastSavedLabel = useMemo(() => formatLastSaved(lastSavedAt), [lastSavedAt]);
  const visibleServerTemplates = useMemo(() => templates.slice(0, 6), [templates]);
  const selectedModuleInfo = useMemo(
    () => modules.find((module) => module.module_id === selectedModule) ?? null,
    [modules, selectedModule],
  );
  const selectedModuleLabel = useMemo(
    () => getModuleDisplayName(selectedModuleInfo, selectedModule || 'Current Screen'),
    [selectedModuleInfo, selectedModule],
  );
  const selectedModuleStatusLabel = useMemo(
    () => getModuleDisplayName(selectedModuleInfo, selectedModule || 'No module selected'),
    [selectedModuleInfo, selectedModule],
  );
  const templateLibraryStatus = useMemo(() => {
    if (loadingTemplates) {
      return 'Loading';
    }

    if (templates.length > 0) {
      return `${templates.length} saved + ${LOCAL_SCREEN_TEMPLATES.length} starter`;
    }

    return `${LOCAL_SCREEN_TEMPLATES.length} starter + rows`;
  }, [loadingTemplates, templates.length]);
  const canModifySelectedModule = Boolean(selectedModule) && !loading && !screenLoadError;
  const canDeleteSelectedScreen = canModifySelectedModule && (hasPersistedScreen || draftInfo.has_draft);

  const confirmDestructiveEditorAction = useCallback((actionDescription: string) => {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(`You have unsaved changes. ${actionDescription} Continue without saving?`);
  }, [hasUnsavedChanges]);

  const getPersistableScreen = useCallback((): EditorScreen => {
    const validationError = getEditorPersistenceValidationError(rows);
    if (validationError) {
      throw new Error(validationError);
    }

    const screen = getScreen();
    const filteredRows = screen.rows
      .map(row => ({
        ...row,
        cells: row.cells.filter(cell => cell.content !== null),
      }))
      .filter(row => row.cells.length > 0);

    return { ...screen, rows: filteredRows };
  }, [getScreen, rows]);

  const isEffectivelyEmptyScreen = useCallback((screen: EditorScreen): boolean => {
    return screen.rows.length === 0;
  }, []);

  const showMsg = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const beginModuleTransition = useCallback((nextModule: string) => {
    selectedModuleRef.current = nextModule;
    setLoading(true);
    setScreenLoadError(null);
    setDraftInfo({ has_draft: false });
    setHasPersistedScreen(false);
    setSearchParams(nextModule ? { module_instance_id: nextModule } : {});
  }, [setSearchParams]);

  useEffect(() => {
    selectedModuleRef.current = selectedModule;
  }, [selectedModule]);

  const updateModuleHasScreen = useCallback((moduleId: string, hasScreen: boolean) => {
    setModules(prev => prev.map(module => (
      module.module_id === moduleId
        ? { ...module, has_screen: hasScreen }
        : module
    )));
  }, []);

  // Removed handleCreateModule and handleDeleteModule - now handled by ModulesTree

  const handleDeleteScreen = useCallback(async () => {
    const currentModule = selectedModule;
    const mod = modules.find(m => m.module_id === currentModule);
    if (!mod) return;
    if (!hasPersistedScreen && !draftInfo.has_draft) return;
    if (!confirmDestructiveEditorAction('Deleting the saved screen will clear the current canvas.')) return;
    if (!window.confirm(`Delete the saved screen for "${mod.name}"?`)) return;

    try {
      await api.del(`/api/sdui/${currentModule}`);

      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      loadScreen(null);
      setDraftInfo({ has_draft: false });
      setHasPersistedScreen(false);
      updateModuleHasScreen(currentModule, false);
      setScreenLoadError(null);

      const clearedScreen = useEditorStore.getState().getScreen();
      setLastSavedSnapshot(buildScreenSnapshot(clearedScreen));
      setLastSavedAt(new Date());

      showMsg('success', `Deleted screen content for ${mod.name}`);
    } catch (err) {
      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('error', err instanceof Error ? err.message : 'Failed to delete screen');
    }
  }, [confirmDestructiveEditorAction, draftInfo.has_draft, hasPersistedScreen, loadScreen, modules, selectedModule, showMsg, updateModuleHasScreen]);

  const checkAiConnection = useCallback(() => {
    api.get<{ status: string }>('/health')
      .then(() => setAiConnected(true))
      .catch(() => setAiConnected(false));
  }, []);

  const markScreenSaved = useCallback((screen: { rows: any[] }) => {
    setLastSavedSnapshot(buildScreenSnapshot(screen));
    setLastSavedAt(new Date());
  }, []);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setModulesLoadError(null);
    let startedModuleTransition = false;

    try {
      const data = await api.get<{ items: ModuleInfo[] }>('/api/sdui/modules');
      const mods = data.items || [];
      const currentSelected = selectedModuleRef.current;
      const nextSelectedModule = mods.some(mod => mod.module_id === currentSelected)
        ? currentSelected
        : (mods[0]?.module_id || '');

      setModules(mods);
      if (nextSelectedModule && nextSelectedModule !== currentSelected) {
        startedModuleTransition = true;
        beginModuleTransition(nextSelectedModule);
      } else if (!nextSelectedModule) {
        selectedModuleRef.current = '';
        setSelectedModule('');
        setDraftInfo({ has_draft: false });
        setScreenLoadError(null);
      }
    } catch (err) {
      setModules([]);
      selectedModuleRef.current = '';
      setSelectedModule('');
      setHasPersistedScreen(false);
      setModulesLoadError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      if (!startedModuleTransition) {
        setLoading(false);
      }
    }
  }, [beginModuleTransition]);

  const loadSelectedModule = useCallback(async () => {
    if (!selectedModule) {
      loadScreen(null);
      setDraftInfo({ has_draft: false });
      setHasPersistedScreen(false);
      setScreenLoadError(null);
      setLastSavedSnapshot(buildScreenSnapshot(useEditorStore.getState().getScreen()));
      setLastSavedAt(null);
      return;
    }

    const requestId = moduleLoadRequestIdRef.current + 1;
    moduleLoadRequestIdRef.current = requestId;

    setLoading(true);
    setScreenLoadError(null);
    setDraftInfo({ has_draft: false });

    try {
      const [screenData, draft] = await Promise.all([
        api.get<any>(`/api/sdui/${selectedModule}`),
        api.get<DraftInfo>(`/api/sdui/${selectedModule}/draft`).catch(() => ({ has_draft: false })),
      ]);

      if (moduleLoadRequestIdRef.current !== requestId) {
        return;
      }

      const liveScreen = normalizeScreenData(screenData?.screen ?? screenData?.state_json ?? null);
      const hasLiveScreen = liveScreen !== null;
      const loadedDraftInfo = draft as DraftInfo;
      const draftScreen = loadedDraftInfo.has_draft
        ? normalizeScreenData(loadedDraftInfo.screen ?? null)
        : null;
        const nextScreen = draftScreen ?? liveScreen ?? { rows: [] };
      loadScreen(nextScreen);
      setHasPersistedScreen(hasLiveScreen);
      updateModuleHasScreen(selectedModule, hasLiveScreen);
      setLastSavedSnapshot(buildScreenSnapshot(useEditorStore.getState().getScreen()));
      setLastSavedAt(null);
      setDraftInfo(loadedDraftInfo);
    } catch (err) {
      if (moduleLoadRequestIdRef.current !== requestId) {
        return;
      }

      loadScreen(null);
    setHasPersistedScreen(false);
      setLastSavedSnapshot(buildScreenSnapshot(useEditorStore.getState().getScreen()));
      setLastSavedAt(null);
      setDraftInfo({ has_draft: false });
      setScreenLoadError(err instanceof Error ? err.message : 'Failed to load module screen');
    } finally {
      if (moduleLoadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [loadScreen, selectedModule, updateModuleHasScreen]);

  // Load modules
  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  // Load screen when module changes
  useEffect(() => {
    void loadSelectedModule();
  }, [loadSelectedModule]);

  // AI connection status ping
  useEffect(() => {
    checkAiConnection();
    const interval = setInterval(() => {
      checkAiConnection();
    }, 10000);
    return () => clearInterval(interval);
  }, [checkAiConnection]);

  useEffect(() => {
    if (!showDevicePicker) return;
    const displayedWidth = deviceWidth;
    const displayedHeight = deviceHeight;
    setCustomDeviceWidth(String(displayedWidth));
    setCustomDeviceHeight(String(displayedHeight));
  }, [showDevicePicker, deviceWidth, deviceHeight]);

  const handleDeviceChange = useCallback((preset: DevicePreset) => {
    const naturalDimensions = getNaturalPresetDimensions(preset);

    setSelectedPreset({
      ...preset,
      width: naturalDimensions.width,
      height: naturalDimensions.height,
    });
    setCustomDeviceWidth(String(naturalDimensions.width));
    setCustomDeviceHeight(String(naturalDimensions.height));
    setDevice(naturalDimensions.width, naturalDimensions.height);
    setShowDevicePicker(false);
  }, [setDevice]);

  const handleApplyCustomDevice = useCallback(() => {
    const width = Number.parseInt(customDeviceWidth, 10);
    const height = Number.parseInt(customDeviceHeight, 10);

    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      showMsg('error', 'Enter valid custom width and height.');
      return;
    }

    setSelectedPreset({
      name: `Custom ${width}x${height}`,
      width,
      height,
      icon: '📐',
      category: detectCustomDeviceCategory(width),
    });
    setCustomDeviceWidth(String(width));
    setCustomDeviceHeight(String(height));
    setDevice(width, height);
    setShowDevicePicker(false);
  }, [customDeviceHeight, customDeviceWidth, setDevice, showMsg]);

  // Save draft
  const handleSaveDraft = useCallback(async () => {
    if (!canModifySelectedModule) {
      showMsg('error', screenLoadError || 'Wait for the screen to finish loading.');
      return;
    }

    const currentModule = selectedModule;
    setSaving(true);
    setMessage(null);
    try {
      const screen = getPersistableScreen();
      const empty = isEffectivelyEmptyScreen(screen);
      if (empty && !window.confirm('This will save an empty screen with no content. Continue?')) {
        setSaving(false);
        return;
      }
      const result = await api.post<any>(`/api/sdui/${currentModule}`, { screen });

      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      if (result.draft) {
        const suffix = empty ? ' (empty screen)' : '';
        showMsg('info', `Draft saved (v${result.version}). Approve to push live.${suffix}`);
        setDraftInfo({ has_draft: true, version: result.version });
      } else {
        setHasPersistedScreen(true);
        updateModuleHasScreen(currentModule, true);
        setDraftInfo({ has_draft: false });
        const suffix = empty ? ' (empty screen)' : '';
        showMsg('success', `Screen saved and pushed live!${suffix}`);
      }
      markScreenSaved(screen);
    } catch (err) {
      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [canModifySelectedModule, selectedModule, getPersistableScreen, isEffectivelyEmptyScreen, showMsg, markScreenSaved, screenLoadError, updateModuleHasScreen]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveDraft();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, handleSaveDraft]);

  // Push live
  const handlePushLive = useCallback(async () => {
    if (!canModifySelectedModule) {
      showMsg('error', screenLoadError || 'Wait for the screen to finish loading.');
      return;
    }

    const currentModule = selectedModule;
    setPushing(true);
    setMessage(null);
    try {
      const screen = getPersistableScreen();
      const empty = isEffectivelyEmptyScreen(screen);
      if (empty && !window.confirm('This will push an empty screen live with no content. Continue?')) {
        setPushing(false);
        return;
      }
      const saveResult = await api.post<any>(`/api/sdui/${currentModule}`, { screen });
      if (saveResult.draft) {
        const approveResult = await api.post<any>(`/api/sdui/${currentModule}/draft/approve`);

        if (selectedModuleRef.current !== currentModule) {
          return;
        }

        const suffix = empty ? ' (empty screen)' : '';
        showMsg('success', `Pushed live! (v${approveResult.version})${suffix}`);
        setDraftInfo({ has_draft: false });
      } else {
        if (selectedModuleRef.current !== currentModule) {
          return;
        }

        const suffix = empty ? ' (empty screen)' : '';
        showMsg('success', `Pushed live!${suffix}`);
        setDraftInfo({ has_draft: false });
      }

      setHasPersistedScreen(true);
      updateModuleHasScreen(currentModule, true);
      markScreenSaved(screen);
    } catch (err) {
      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('error', `Push failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPushing(false);
    }
  }, [canModifySelectedModule, selectedModule, getPersistableScreen, isEffectivelyEmptyScreen, showMsg, markScreenSaved, screenLoadError, updateModuleHasScreen]);

  // Approve/Reject draft
  const handleApproveDraft = useCallback(async () => {
    const currentModule = selectedModule;
    setApprovingDraft(true);
    try {
      const result = await api.post<any>(`/api/sdui/${currentModule}/draft/approve`);
      const screenData = await api.get<any>(`/api/sdui/${currentModule}`);

      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('success', `Draft approved! (v${result.version})`);
      setDraftInfo({ has_draft: false });
      const normalized = normalizeScreenData(screenData?.screen ?? screenData?.state_json ?? null);
      const hasLiveScreen = normalized !== null;
      loadScreen(normalized ?? { rows: [] });
      setHasPersistedScreen(hasLiveScreen);
      updateModuleHasScreen(currentModule, hasLiveScreen);
      markScreenSaved(useEditorStore.getState().getScreen());
    } catch (err) {
      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('error', err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setApprovingDraft(false);
    }
  }, [selectedModule, showMsg, loadScreen, markScreenSaved, updateModuleHasScreen]);

  const handleRejectDraft = useCallback(async () => {
    const currentModule = selectedModule;
    try {
      await api.post(`/api/sdui/${currentModule}/draft/reject`);
      const screenData = await api.get<any>(`/api/sdui/${currentModule}`);

      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('info', 'Draft rejected.');
      setDraftInfo({ has_draft: false });
      const normalized = normalizeScreenData(screenData?.screen ?? screenData?.state_json ?? null);
      const hasLiveScreen = normalized !== null;
      loadScreen(normalized ?? { rows: [] });
      setHasPersistedScreen(hasLiveScreen);
      updateModuleHasScreen(currentModule, hasLiveScreen);
      markScreenSaved(useEditorStore.getState().getScreen());
    } catch (err) {
      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('error', err instanceof Error ? err.message : 'Reject failed');
    }
  }, [selectedModule, showMsg, loadScreen, markScreenSaved, updateModuleHasScreen]);

  // Templates
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await api.get<{ items: Template[] }>('/api/templates');
      setTemplates(data.items || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (showTemplatePanel) {
      void loadTemplates();
    }
  }, [showTemplatePanel, loadTemplates]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) return;
    try {
      const screen = getPersistableScreen();
      await api.post('/api/templates', {
        name: templateName,
        category: templateCategory,
        screen_json: screen,
        is_public: true,
      });
      showMsg('success', 'Template saved!');
      await loadTemplates();
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Save failed');
    }
  }, [templateName, templateCategory, getPersistableScreen, showMsg, loadTemplates]);

  const handleApplyTemplate = useCallback(async (templateId: string) => {
    if (!confirmDestructiveEditorAction('Applying a template will replace the current canvas.')) {
      return;
    }

    try {
      const detail = await api.get<TemplateDetail>(`/api/templates/${templateId}`);
      const normalized = normalizeScreenData(detail.screen_json);
      if (!normalized) {
        showMsg('error', 'Template data is invalid.');
        return;
      }
      applyScreen(normalized);
      showMsg('success', `Template loaded: ${detail.name}`);
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Failed to load template');
    }
    setShowLoadTemplate(false);
  }, [applyScreen, confirmDestructiveEditorAction, showMsg]);

  const closeImportJsonModal = useCallback(() => {
    setShowImportJson(false);
    setImportJsonValue('');
  }, []);

  const handleImportJson = useCallback(() => {
    try {
      const parsed = JSON.parse(importJsonValue);
      const importableScreen = extractImportableScreen(parsed);
      const normalized = normalizeScreenData(importableScreen);

      if (!normalized) {
        throw new Error('JSON must contain rows or sections.');
      }

      if (!confirmDestructiveEditorAction('Importing JSON will replace the current canvas.')) {
        return;
      }

      applyScreen(normalized);
      showMsg('success', 'JSON imported into the editor.');
      closeImportJsonModal();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Import failed');
    }
  }, [applyScreen, closeImportJsonModal, confirmDestructiveEditorAction, importJsonValue, showMsg]);

  const handleApplyLocalScreenTemplate = useCallback((template: LocalTemplateDefinition) => {
    if (!confirmDestructiveEditorAction('Applying a local screen template will replace the current canvas.')) {
      return false;
    }

    const clonedScreen = cloneTemplateScreen(template.screen);
    applyScreen(clonedScreen);
    showMsg('success', `Template loaded: ${template.name}`);
    return true;
  }, [applyScreen, confirmDestructiveEditorAction, showMsg]);

  const handleAppendLocalRowTemplate = useCallback((template: LocalTemplateDefinition) => {
    if (!confirmDestructiveEditorAction('Appending a row template will modify the current canvas.')) {
      return;
    }

    const clonedScreen = cloneTemplateScreen(template.screen);
    const currentScreen = getScreen();
    applyScreen({ ...currentScreen, rows: [...currentScreen.rows, ...clonedScreen.rows] });
    showMsg('success', `Row template added: ${template.name}`);
  }, [applyScreen, confirmDestructiveEditorAction, getScreen, showMsg]);

  if (loading && modules.length === 0 && !modulesLoadError) {
    return <div className="flex items-center justify-center h-full text-gray-500">Loading editor...</div>;
  }

  if (modulesLoadError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-100 bg-white px-6 py-5 text-center shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Failed to load editor modules</div>
          <div className="mt-2 max-w-sm text-sm text-gray-500">{modulesLoadError}</div>
          <button
            onClick={() => { void loadModules(); }}
            className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Top Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-200 shrink-0">
        {/* Left: Module info + Draft */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 text-sm font-medium text-gray-700">
            {selectedModuleInfo ? (
              <>
                {selectedModuleInfo.name}
                {selectedModuleInfo.has_screen && <span className="ml-1 text-gray-400">●</span>}
                {selectedModuleInfo.is_custom && <span className="ml-1 text-gray-400">✦</span>}
              </>
            ) : (
              <span className="text-gray-400">No module selected</span>
            )}
          </div>

          {draftInfo.has_draft && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                Draft v{draftInfo.version}
              </span>
              <button onClick={handleApproveDraft} disabled={approvingDraft}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors">
                <CheckCircle size={10} /> Approve
              </button>
              <button onClick={handleRejectDraft}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors">
                <XCircle size={10} /> Reject
              </button>
            </div>
          )}
        </div>

        {/* Center: Undo/Redo + Device picker */}
        <div className="flex items-center gap-1.5">
          <button onClick={undo} disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
            <Undo2 size={14} />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors" title="Redo (Ctrl+Y)">
            <Redo2 size={14} />
          </button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Device picker */}
          <div className="relative">
            <button
              onClick={() => setShowDevicePicker(!showDevicePicker)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-100 transition-colors"
            >
              <Monitor size={12} />
              <span>{selectedPreset.name}</span>
              <span className="text-gray-400">
                {deviceWidth}x{deviceHeight}
              </span>
              <ChevronDown size={10} />
            </button>

            {showDevicePicker && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-64 py-1 max-h-80 overflow-y-auto">
                {(['phone', 'tablet', 'desktop'] as const).map(cat => (
                  <div key={cat}>
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-1">
                      {cat === 'phone' ? 'Phones' : cat === 'tablet' ? 'Tablets' : 'Desktop'}
                    </div>
                    {DEVICE_PRESETS.filter(p => p.category === cat).map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => handleDeviceChange(preset)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${
                          selectedPreset.name === preset.name ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                      >
                        <span>{preset.icon} {preset.name}</span>
                        <span className="text-gray-400">{preset.width}x{preset.height}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <div className="px-3 py-2">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Custom Option</div>
                  <div className="text-[11px] text-gray-500 mb-2">Custom preview dimensions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-[10px] text-gray-400 mb-1">Width</span>
                      <input
                        type="number"
                        value={customDeviceWidth}
                        onChange={(e) => setCustomDeviceWidth(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleApplyCustomDevice();
                          }
                        }}
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[10px] text-gray-400 mb-1">Height</span>
                      <input
                        type="number"
                        value={customDeviceHeight}
                        onChange={(e) => setCustomDeviceHeight(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleApplyCustomDevice();
                          }
                        }}
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none"
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gray-400">Use Apply to confirm the custom preview size.</span>
                    <button
                      onClick={handleApplyCustomDevice}
                      className="px-2 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleLandscape}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Rotate">
            <RotateCw size={12} />
          </button>

          <button onClick={() => setShowJsonView(!showJsonView)}
            className={`p-1.5 rounded transition-colors ${showJsonView ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`} title="JSON View">
            <Code size={12} />
          </button>
        </div>

        {/* Right: Save actions + Templates */}
        <div className="flex items-center gap-1.5">
          {message && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              message.type === 'success' ? 'bg-green-50 text-green-700'
              : message.type === 'info' ? 'bg-blue-50 text-blue-700'
              : 'bg-red-50 text-red-700'
            }`}>{message.text}</span>
          )}

          <button onClick={() => { setShowLoadTemplate(true); void loadTemplates(); }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
            <RefreshCw size={11} /> Templates
          </button>
          <button onClick={() => setShowSaveTemplate(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
            <FileText size={11} /> Save as Template
          </button>
          <button onClick={() => setShowAppPreview(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
            <Smartphone size={11} /> Preview App
          </button>

          <div className="w-px h-4 bg-gray-200 mx-0.5" />

          <button onClick={handleDeleteScreen} disabled={!canDeleteSelectedScreen}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors disabled:opacity-50 disabled:hover:bg-red-50">
            <Trash2 size={11} /> Delete Screen
          </button>
          <button onClick={handleSaveDraft} disabled={saving || !canModifySelectedModule}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50">
            <Save size={11} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handlePushLive} disabled={pushing || !canModifySelectedModule}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50">
            <Rocket size={11} /> {pushing ? 'Pushing...' : 'Push Live'}
          </button>
        </div>
      </div>

      {/* ── Main 3-Panel Layout ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Structure Tree */}
        <div className="w-[240px] bg-white border-r border-gray-200 shrink-0 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <StructureTree screenLabel={selectedModuleLabel} />
          </div>
          <div className="border-t border-gray-200 shrink-0 bg-gray-50/60">
            <button
              onClick={() => setShowTemplatePanel(!showTemplatePanel)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50"
            >
              <span>Template Library</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium normal-case tracking-normal text-gray-400">
                  {templateLibraryStatus}
                </span>
                <ChevronDown size={12} className={`transition-transform ${showTemplatePanel ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {showTemplatePanel && (
              <div className="max-h-[24rem] overflow-y-auto px-3 pb-3 pt-2 space-y-3">
                <div className="grid gap-1.5">
                  <button
                    onClick={() => { setShowLoadTemplate(true); void loadTemplates(); }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Browse Templates
                  </button>
                  <button
                    onClick={() => setShowSaveTemplate(true)}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-gray-600 hover:bg-white rounded transition-colors flex items-center gap-1"
                  >
                    <FileText size={10} /> Save as Template
                  </button>
                  <button
                    onClick={() => setShowImportJson(true)}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-gray-600 hover:bg-white rounded transition-colors flex items-center gap-1"
                  >
                    <Code size={10} /> Import JSON
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Saved Full Screens</div>
                    <span className="text-[10px] text-gray-400">{loadingTemplates ? '...' : templates.length}</span>
                  </div>
                  {loadingTemplates ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-white px-2.5 py-2 text-[11px] text-gray-400">
                      Loading templates...
                    </div>
                  ) : templates.length > 0 ? (
                    visibleServerTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => { void handleApplyTemplate(template.id); }}
                        className="w-full rounded-lg border border-gray-200 bg-white p-2 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-800 truncate">{template.name}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{template.description || 'No description'}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {template.category}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] font-medium text-blue-600">Apply screen</div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-white px-2.5 py-2 text-[11px] text-gray-400">
                      No saved templates yet. Starter screens stay available locally below.
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Starter Screens</div>
                    <span className="text-[10px] text-gray-400">{LOCAL_SCREEN_TEMPLATES.length}</span>
                  </div>
                  {LOCAL_SCREEN_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => { handleApplyLocalScreenTemplate(template); }}
                      className="w-full rounded-lg border border-gray-200 bg-white p-2 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{template.name}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{template.description}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          {template.category}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] font-medium text-blue-600">Apply screen</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Row Templates</div>
                  {LOCAL_ROW_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleAppendLocalRowTemplate(template)}
                      className="w-full rounded-lg border border-gray-200 bg-white p-2 text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{template.name}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{template.description}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          {template.category}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] font-medium text-blue-600">Add rows</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Canvas (or JSON view) */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading screen...</div>
          ) : screenLoadError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="text-sm font-semibold text-gray-900">Failed to load {selectedModuleInfo?.name || selectedModule || 'this module'}</div>
              <div className="max-w-md text-sm text-gray-500">{screenLoadError}</div>
              <button
                onClick={() => { void loadSelectedModule(); }}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : showJsonView ? (
            <div className="h-full p-4 overflow-auto bg-gray-900">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(getScreen(), null, 2)}
              </pre>
            </div>
          ) : (
            <EditorCanvas />
          )}
        </div>

        {/* Right Panel: Properties Inspector */}
        <div className="w-[300px] bg-white border-l border-gray-200 shrink-0 overflow-hidden">
          {loading || screenLoadError ? (
            <div className="p-3 text-xs text-gray-400">Properties are unavailable until the screen loads.</div>
          ) : (
            <PropertyInspector />
          )}
        </div>
      </div>

      {/* ── Status Bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1 bg-white border-t border-gray-200 text-[10px] text-gray-400 shrink-0">
        <div className="flex items-center gap-3">
          <span>Screen: {selectedModuleStatusLabel}</span>
          <span>Rows: {rows.length}</span>
          <span>Cells: {rows.reduce((sum, r) => sum + r.cells.length, 0)}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && <span className="text-amber-500">● Unsaved changes</span>}
          <span>Last saved: {lastSavedLabel}</span>
          <span>{selectedPreset.icon} {deviceWidth}x{deviceHeight}</span>
          <span className={`flex items-center gap-1 ${aiConnected === true ? 'text-green-500' : aiConnected === false ? 'text-red-400' : 'text-gray-300'}`}>
            ● AI {aiConnected === true ? 'Connected' : aiConnected === false ? 'Disconnected' : '...'}
          </span>
        </div>
      </div>

      {/* ── Save as Template Modal ────────────────────────────────────── */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-96">
            <h3 className="text-sm font-semibold mb-3">Save as Template</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="My Template" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={templateCategory} onChange={e => setTemplateCategory(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white">
                  <option value="dashboard">Dashboard</option>
                  <option value="planner">Planner</option>
                  <option value="tracker">Tracker</option>
                  <option value="form">Form</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveTemplate}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Load Template Modal ───────────────────────────────────────── */}
      {showLoadTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-[560px] max-h-[75vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Load Template</h3>
              <button onClick={() => setShowLoadTemplate(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Saved Templates</div>
                  <span className="text-[11px] text-gray-400">{loadingTemplates ? '...' : templates.length}</span>
                </div>
                {loadingTemplates ? (
                  <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
                ) : templates.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">
                    No saved templates yet. Starter screens stay available below.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => { void handleApplyTemplate(t.id); }}
                        className="text-left p-3 border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{t.description || 'No description'}</div>
                        <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">{t.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Starter Screens</div>
                  <span className="text-[11px] text-gray-400">{LOCAL_SCREEN_TEMPLATES.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {LOCAL_SCREEN_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        if (handleApplyLocalScreenTemplate(template)) {
                          setShowLoadTemplate(false);
                        }
                      }}
                      className="text-left p-3 border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{template.description}</div>
                      <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">{template.category}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import JSON Modal ─────────────────────────────────────────── */}
      {showImportJson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-[640px] max-h-[75vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Import JSON</h3>
              <button onClick={closeImportJsonModal} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Paste screen JSON or a template export containing <span className="font-mono">screen_json</span>. Importing replaces the current canvas.
              </p>
              <textarea
                value={importJsonValue}
                onChange={(e) => setImportJsonValue(e.target.value)}
                rows={14}
                placeholder='{"rows": [...]}'
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs font-mono text-gray-700 outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-gray-400">Supports raw screens, row arrays, and exported template payloads.</span>
                <div className="flex gap-2">
                  <button
                    onClick={closeImportJsonModal}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportJson}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* App Preview Modal */}
      {showAppPreview && (
        <AppPreview onClose={() => setShowAppPreview(false)} />
      )}
    </div>
  );
}