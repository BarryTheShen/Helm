/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useEditorStore } from '../editor/useEditorStore';
import { StructureTree } from '../editor/StructureTree';
import { ComponentPalette } from '../editor/ComponentPalette';
import { EditorCanvas } from '../editor/EditorCanvas';
import { PropertyInspector } from '../editor/PropertyInspector';
import { AppPreview } from '../components/AppPreview';
import { SDUIPreview } from '../components/SDUIPreview';
import { DEVICE_PRESETS, getEditorPersistenceValidationError } from '../editor/types';
import type { DevicePreset, EditorComponent, EditorScreen } from '../editor/types';
import {
  cloneTemplateScreen,
  LOCAL_ROW_TEMPLATES,
  LOCAL_SCREEN_TEMPLATES,
} from '../editor/templateLibrary';
import type { LocalTemplateDefinition } from '../editor/templateLibrary';
import {
  Save, Undo2, Redo2, FileText,
  RefreshCw, Monitor, RotateCw, ChevronDown, ChevronRight, ChevronUp, Code, Trash2, Smartphone,
  Camera, History, Eye, Clock, Info, List, Archive, FileJson, ExternalLink, CornerDownRight
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
    const { ...screenMeta } = record;
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
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [modulesLoadError, setModulesLoadError] = useState<string | null>(null);
  const [screenLoadError, setScreenLoadError] = useState<string | null>(null);
  const [hasPersistedScreen, setHasPersistedScreen] = useState(false);

  // Create module state - removed (now handled by ModulesTree)

  // ── Versioning state (Phase 5) ────────────────────────────────────────────
  const [draftInfo, setDraftInfo] = useState<DraftInfo>({ has_draft: false });
  const [checkpointing, setCheckpointing] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [versions, setVersions] = useState<{
    id: string;
    version_number: number;
    display_name: string;
    created_at: string;
    change_summary: string | null;
    source: string;
    custom_name: string | null;
    default_timestamp_name: string;
    parent_version_id: string | null;
    status?: string;
  }[]>([]);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [versionDetails, setVersionDetails] = useState<Record<string, { rowCount: number; compCount: number; componentTypes: string[] }>>({});
  const [loadingVersionDetail, setLoadingVersionDetail] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [lastCheckpointId, setLastCheckpointId] = useState<string | null>(null);

  // ── View JSON state (VER-008) ──────────────────────────────────────
  const [versionJsonModal, setVersionJsonModal] = useState<{ json: any; versionLabel: string } | null>(null);

  // ── Used-by state (VER-008) ──────────────────────────────────────
  const [usedByApps, setUsedByApps] = useState<{ app_id: string; app_name: string }[]>([]);
  const [showUsedByPanel, setShowUsedByPanel] = useState(false);
  const [loadingUsedBy, setLoadingUsedBy] = useState(false);

  // ── Archive state (VER-008) ─────────────────────────────────────
  const [archivingVersionId, setArchivingVersionId] = useState<string | null>(null);

  // ── Version diff state (FF4-VERSIONING-UI) ────────────────────────────
  const [versionDiffMode, setVersionDiffMode] = useState(false);
  const [versionDiffA, setVersionDiffA] = useState<string | null>(null);
  const [versionDiffB, setVersionDiffB] = useState<string | null>(null);
  const [versionContentCache, setVersionContentCache] = useState<Record<string, any>>({});
  const [versionDiffResult, setVersionDiffResult] = useState<{
    versionA: string; versionB: string;
    rowsA: number; rowsB: number;
    compsA: number; compsB: number;
    typesA: string[]; typesB: string[];
    added: string[]; removed: string[];
    sameRows: number;
  } | null>(null);
  const [, setLoadingVersionContent] = useState(false);

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
  const [leftPanelTab, setLeftPanelTab] = useState<'structure' | 'components' | 'templates'>('structure');
  const [showImportJson, setShowImportJson] = useState(false);
  const [importJsonValue, setImportJsonValue] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(buildScreenSnapshot({ rows: [] }));
  const moduleLoadRequestIdRef = useRef(0);
  const selectedModuleRef = useRef(selectedModule);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveSuppressedRef = useRef(false);

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

  // NOTE: `getPersistableScreen` and `getScreen` are stable references and
  // read store state at call time, so they do NOT need to be in deps.
  const hasUnsavedChanges = useMemo(() => {
    // Use persistable screen (filters null cells, empty rows) to match what
    // actually gets saved.  Fall back to raw comparison if validation fails.
    let currentSnapshot: string;
    try {
      currentSnapshot = buildScreenSnapshot(getPersistableScreen());
    } catch {
      currentSnapshot = buildScreenSnapshot(getScreen());
    }
    return currentSnapshot !== lastSavedSnapshot;
  }, [rows, lastSavedSnapshot]);
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

  // The module is modifiable when a module is selected, loading is done,
  // and there's no fatal screen error. New modules (no persisted screen, no draft)
  // should still allow saving — the save handler creates the first draft.
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

  // Redirect to first module when URL is empty but modules exist.
  // Read searchParams directly inside the effect — React Router defers updating
  // the selectedModule variable, so reading it from the closure would be stale.
  // searchParams.get() always reads the current URL, avoiding the race.
  const [redirectedTo, setRedirectedTo] = useState<string | null>(null);

   
  useEffect(() => {
    // Read directly from URL — always fresh, never stale
    const currentUrlModule = searchParams.get('module_instance_id') || '';
    setRedirectedTo(currentUrlModule);

    if (!currentUrlModule && modules.length > 0) {
      const target = modules[0]?.module_id || '';
      if (!target) return;

      // Guard: only redirect if we haven't already redirected to this target.
      if (redirectedTo !== target) {
        console.log(`[Editor] redirect effect — redirecting to: ${target}`);
        setRedirectedTo(target);
        selectedModuleRef.current = target;
        setSearchParams({ module_instance_id: target });
      }
    }
  }, [searchParams, modules.length]);

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
    console.log(`[Editor] markScreenSaved() — rows: ${screen.rows.length}, cells: ${screen.rows.reduce((s, r) => s + r.cells.length, 0)}`);
    setLastSavedSnapshot(buildScreenSnapshot(screen));
    setLastSavedAt(new Date());
  }, []);

  const modulesLoadedRef = useRef(false);

  const loadModules = useCallback(async () => {
    // Only load once. Never recreate to avoid stale closure cascade.
    if (modulesLoadedRef.current) return;
    modulesLoadedRef.current = true;

    console.log(`[Editor] loadModules() — starting, url="${selectedModule}"`);
    setLoading(true);
    setModulesLoadError(null);

    try {
      const data = await api.get<{ items: ModuleInfo[] }>('/api/sdui/modules');
      const mods = data.items || [];
      console.log(`[Editor] loadModules() — success: ${mods.length} modules loaded`);

      setModules(mods);

      // Sync ref to URL param — read directly from searchParams (not the stale closure)
      const urlModule = searchParams.get('module_instance_id') || '';
      if (urlModule && mods.some(mod => mod.module_id === urlModule)) {
        selectedModuleRef.current = urlModule;
      } else {
        // Invalid/empty — mark for redirect (handled by redirect effect)
        const first = mods[0]?.module_id || '';
        if (first) {
          console.log(`[Editor] loadModules() — URL invalid, redirect pending to: ${first}`);
          selectedModuleRef.current = first;
        } else {
          selectedModuleRef.current = '';
        }
      }
      setScreenLoadError(null);
      setDraftInfo({ has_draft: false });
      setHasPersistedScreen(false);
    } catch (err) {
      console.error('[Editor] loadModules() — error:', err instanceof Error ? err.message : err);
      setModules([]);
      selectedModuleRef.current = '';
      setHasPersistedScreen(false);
      setModulesLoadError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelectedModule = useCallback(async () => {
    if (!selectedModule) {
      console.log('[Editor] loadSelectedModule() — no module selected, clearing screen');
      loadScreen(null);
      setDraftInfo({ has_draft: false });
      setHasPersistedScreen(false);
      setScreenLoadError(null);
      setLastSavedSnapshot(buildScreenSnapshot(useEditorStore.getState().getScreen()));
      setLastSavedAt(null);
      setLoading(false);
      return;
    }

    const requestId = moduleLoadRequestIdRef.current + 1;
    moduleLoadRequestIdRef.current = requestId;

    console.log(`[Editor] loadSelectedModule() — loading module: ${selectedModule}`);
    setLoading(true);
    setScreenLoadError(null);
    setDraftInfo({ has_draft: false });

    try {
      const [screenData, draft] = await Promise.all([
        api.get<any>(`/api/sdui/${selectedModule}`).catch(() => null),
        api.get<DraftInfo>(`/api/sdui/${selectedModule}/draft`).catch(() => ({ has_draft: false })),
      ]);
      // If both API calls failed, treat as empty module
      if (!screenData) {
        loadScreen(null);
        setDraftInfo({ has_draft: false });
        setHasPersistedScreen(false);
        setLastSavedSnapshot(buildScreenSnapshot(useEditorStore.getState().getScreen()));
        setLastSavedAt(null);
        return;
      }
      console.log(`[Editor] loadSelectedModule() — API success: screen=${!!screenData}, draft=${draft.has_draft}`, draft);

      if (moduleLoadRequestIdRef.current !== requestId) {
        console.log('[Editor] loadSelectedModule() — stale request, skipping');
        return;
      }

      const liveScreen = normalizeScreenData(screenData?.screen ?? screenData?.state_json ?? null);
      const hasLiveScreen = liveScreen !== null;
      const loadedDraftInfo = draft as DraftInfo;
      const draftScreen = loadedDraftInfo.has_draft
        ? normalizeScreenData(loadedDraftInfo.screen ?? null)
        : null;
        const nextScreen = draftScreen ?? liveScreen ?? { rows: [] };
      console.log(`[Editor] loadSelectedModule() — applying screen (rows=${nextScreen.rows.length}, hasDraft=${loadedDraftInfo.has_draft}, hasLive=${hasLiveScreen})`);
      loadScreen(nextScreen);
      setHasPersistedScreen(hasLiveScreen);
      updateModuleHasScreen(selectedModule, hasLiveScreen);
      setLastSavedSnapshot(buildScreenSnapshot(useEditorStore.getState().getScreen()));
      setLastSavedAt(null);
      setDraftInfo(loadedDraftInfo);
    } catch (err) {
      console.error(`[Editor] loadSelectedModule() — error for module ${selectedModule}:`, err instanceof Error ? err.message : err);
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

  // Load modules on mount and whenever the modules list changes.
  // Does NOT update the URL — uses the URL param as the single source of truth.
   
  useEffect(() => {
    void loadModules();
  }, []);

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
    console.log(`[Editor] handleDeviceChange() — selected preset: ${preset.name} (${naturalDimensions.width}x${naturalDimensions.height})`);
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
      console.log('[Editor] handleApplyCustomDevice() — invalid dimensions:', { width, height });
      showMsg('error', 'Enter valid custom width and height.');
      return;
    }

    console.log(`[Editor] handleApplyCustomDevice() — custom device: ${width}x${height}`);
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
    console.log('[Editor] handleSaveDraft() — button pressed');
    if (!canModifySelectedModule) {
      console.log('[Editor] handleSaveDraft() — blocked: cannot modify selected module');
      showMsg('error', screenLoadError || 'Wait for the screen to finish loading.');
      return;
    }

    // Suppress autosave during manual save to avoid race conditions
    autoSaveSuppressedRef.current = true;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const currentModule = selectedModule;
    setSaving(true);
    setMessage(null);
    try {
      const screen = getPersistableScreen();
      const empty = isEffectivelyEmptyScreen(screen);
      console.log(`[Editor] handleSaveDraft() — screen data collected: ${screen.rows.length} rows, empty=${empty}`);
      if (empty && !window.confirm('This will save an empty screen with no content. Continue?')) {
        console.log('[Editor] handleSaveDraft() — user cancelled empty screen save');
        setSaving(false);
        return;
      }
      const result = await api.post<any>(`/api/sdui/${currentModule}`, { screen });
      console.log(`[Editor] handleSaveDraft() — API response: draft=${result.draft}, version=${result.version}`);

      if (selectedModuleRef.current !== currentModule) {
        console.log('[Editor] handleSaveDraft() — module changed, ignoring stale response');
        return;
      }

      if (result.draft) {
        const suffix = empty ? ' (empty screen)' : '';
        showMsg('info', `Module draft saved.${suffix}`);
        setDraftInfo({ has_draft: true, version: result.version });
      } else {
        setHasPersistedScreen(true);
        updateModuleHasScreen(currentModule, true);
        setDraftInfo({ has_draft: false });
        const suffix = empty ? ' (empty screen)' : '';
        showMsg('success', `Module saved.${suffix}`);
      }
      markScreenSaved(screen);
    } catch (err) {
      console.error('[Editor] handleSaveDraft() — error:', err instanceof Error ? err.message : err);
      if (selectedModuleRef.current !== currentModule) {
        return;
      }

      showMsg('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      autoSaveSuppressedRef.current = false;
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

  // ── Debounced autosave (FF4-MOD-010, FF4-MOD-015) ──────────────────────────
  useEffect(() => {
    if (!canModifySelectedModule) return;
    if (!hasUnsavedChanges) return;

    // Clear any pending timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Don't set timer if manual save is in progress
    if (autoSaveSuppressedRef.current) return;

    // Debounce: wait 500ms after last edit
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDraft();
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [hasUnsavedChanges, canModifySelectedModule, handleSaveDraft, saving]);

  // ── Versioning handlers (Phase 5) ───────────────────────────────────────

  const handleCreateCheckpoint = useCallback(async () => {
    console.log('[Editor] handleCreateCheckpoint() — button pressed for module:', selectedModule);
    const currentModule = selectedModule;
    if (!currentModule) {
      showMsg('error', 'No module selected');
      return;
    }

    setCheckpointing(true);
    try {
      // Save draft first
      const screen = getPersistableScreen();
      const saveResult = await api.post<any>(`/api/sdui/${currentModule}`, { screen });

      // Create checkpoint
      const result = await api.post<any>(`/api/modules/${currentModule}/checkpoints`, {
        change_summary: `Checkpoint from editor`,
      });

      console.log(`[Editor] handleCreateCheckpoint() — checkpoint created: ${result.id} (v${result.version_number})`);

      if (selectedModuleRef.current !== currentModule) return;

      setLastCheckpointId(result.id);
      showMsg('success', `Checkpoint v${result.version_number} created — ${result.display_name}`);
      setDraftInfo({ has_draft: saveResult.draft ?? false });
    } catch (err) {
      console.error('[Editor] handleCreateCheckpoint() — error:', err instanceof Error ? err.message : err);
      if (selectedModuleRef.current !== currentModule) return;
      showMsg('error', err instanceof Error ? err.message : 'Checkpoint failed');
    } finally {
      setCheckpointing(false);
    }
  }, [selectedModule, getPersistableScreen, showMsg]);

  const handleOpenVersionHistory = useCallback(async () => {
    console.log('[Editor] handleOpenVersionHistory() — opening for module:', selectedModule);
    const currentModule = selectedModule;
    if (!currentModule) {
      showMsg('error', 'No module selected');
      return;
    }

    setShowVersionHistory(true);
    setLoadingVersions(true);
    setShowUsedByPanel(false);
    setVersionJsonModal(null);
    try {
      const data = await api.get<{ items: any[]; total: number }>(`/api/modules/${currentModule}/versions`);
      console.log(`[Editor] handleOpenVersionHistory() — loaded ${data.items.length} versions`);
      setVersions(data.items || []);
    } catch (err) {
      console.error('[Editor] handleOpenVersionHistory() — error:', err instanceof Error ? err.message : err);
      setVersions([]);
      showMsg('error', err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setLoadingVersions(false);
    }

    // Also fetch usage data
    setLoadingUsedBy(true);
    try {
      const usageData = await api.get<{ module_id: string; used_by_apps: { app_id: string; app_name: string }[] }>(`/api/modules/${currentModule}/usage`);
      setUsedByApps(usageData.used_by_apps || []);
      console.log(`[Editor] handleOpenVersionHistory() — loaded ${usageData.used_by_apps?.length || 0} used-by apps`);
    } catch (err) {
      console.warn('[Editor] handleOpenVersionHistory() — failed to load usage:', err);
      setUsedByApps([]);
    } finally {
      setLoadingUsedBy(false);
    }
  }, [selectedModule, showMsg]);

  const handlePreviewInWeb = useCallback(() => {
    console.log('[Editor] handlePreviewInWeb() — opening preview for module:', selectedModule);
    setShowPreviewModal(true);
  }, [selectedModule, showMsg]);

  const handleRestoreVersion = useCallback(async (versionId: string, versionNumber: number) => {
    console.log('[Editor] handleRestoreVersion() — restoring version:', versionId);
    const currentModule = selectedModule;
    if (!currentModule) return;

    if (!window.confirm(
      `This will overwrite your current working draft with version ${versionNumber}. Unsaved changes will be lost.\n\nContinue?`
    )) {
      console.log('[Editor] handleRestoreVersion() — user cancelled');
      return;
    }

    try {
      // FF4-MOD-011: Auto-create checkpoint before restore
      try {
        const screen = getPersistableScreen();
        await api.post<any>(`/api/sdui/${currentModule}`, { screen });
        await api.post<any>(`/api/modules/${currentModule}/checkpoints`, {
          change_summary: `Auto-checkpoint before restoring v${versionNumber}`,
        });
        console.log('[Editor] handleRestoreVersion() — auto-checkpoint created before restore');
      } catch (checkpointErr) {
        // Non-blocking: if checkpoint creation fails, continue with restore
        console.warn('[Editor] handleRestoreVersion() — checkpoint creation failed, continuing:', checkpointErr);
      }

      await api.post<any>(`/api/modules/${currentModule}/versions/${versionId}/restore-to-draft`);
      console.log('[Editor] handleRestoreVersion() — restored to draft');

      // Reload the screen
      const screenData = await api.get<any>(`/api/sdui/${currentModule}`);
      const normalized = normalizeScreenData(screenData?.screen ?? null);
      loadScreen(normalized ?? { rows: [] });
      setDraftInfo({ has_draft: true, version: 1 });

      // FF4-MOD-014: Update saved snapshot so the UI doesn't show "Unsaved changes"
      if (normalized) {
        markScreenSaved(normalized);
      }

      showMsg('success', `Version v${versionNumber} restored to working draft`);
    } catch (err) {
      console.error('[Editor] handleRestoreVersion() — error:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Restore failed');
    }
  }, [getPersistableScreen, loadScreen, markScreenSaved, selectedModule, showMsg]);

  const handlePublishVersion = useCallback(async (versionId: string, versionNumber: number) => {
    console.log('[Editor] handlePublishVersion() — publishing version:', versionId);
    const currentModule = selectedModule;
    if (!currentModule) return;

    if (!window.confirm(
      `This will publish version ${versionNumber} as the live screen. All mobile users will see this version immediately.\n\nContinue?`
    )) {
      console.log('[Editor] handlePublishVersion() — user cancelled');
      return;
    }

    try {
      const result = await api.post<any>(`/api/modules/${currentModule}/versions/${versionId}/publish`);
      console.log('[Editor] handlePublishVersion() — published:', result);

      setDraftInfo({ has_draft: false });
      showMsg('success', `Version v${versionNumber} published to live!`);
    } catch (err) {
      console.error('[Editor] handlePublishVersion() — error:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Publish failed');
    }
  }, [selectedModule, showMsg]);

  const handleArchiveVersion = useCallback(async (versionId: string, versionNumber: number) => {
    console.log('[Editor] handleArchiveVersion() — archiving version:', versionId);
    const currentModule = selectedModule;
    if (!currentModule) return;

    if (!window.confirm(
      `Archive version v${versionNumber}? It will be hidden from the default version list but can still be accessed directly.`
    )) {
      console.log('[Editor] handleArchiveVersion() — user cancelled');
      return;
    }

    setArchivingVersionId(versionId);
    try {
      await api.post<any>(`/api/modules/${currentModule}/versions/${versionId}/archive`);
      console.log('[Editor] handleArchiveVersion() — archived:', versionId);

      // Update local state to reflect archived status
      setVersions(prev => prev.map(v =>
        v.id === versionId ? { ...v, status: 'archived' } : v
      ));

      showMsg('success', `Version v${versionNumber} archived`);
    } catch (err) {
      console.error('[Editor] handleArchiveVersion() — error:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Archive failed');
    } finally {
      setArchivingVersionId(null);
    }
  }, [selectedModule, showMsg]);

  const handleToggleVersionDetail = useCallback(async (versionId: string) => {
    if (expandedVersionId === versionId) {
      setExpandedVersionId(null);
      return;
    }

    setExpandedVersionId(versionId);

    // Fetch detail if not already loaded
    if (!versionDetails[versionId]) {
      setLoadingVersionDetail(true);
      const currentModule = selectedModule;
      if (!currentModule) {
        setLoadingVersionDetail(false);
        return;
      }

      try {
        const detail = await api.get<any>(`/api/modules/${currentModule}/versions/${versionId}`);
        console.log(`[Editor] handleToggleVersionDetail() — loaded detail for version ${versionId}`);

        // Cache full content for version diff (FF4-VERSIONING-UI)
        setVersionContentCache(prev => ({ ...prev, [versionId]: detail.sdui_json || {} }));

        // Compute summary from sdui_json
        const sdui = detail.sdui_json || {};
        const rows = Array.isArray(sdui.rows) ? sdui.rows : [];
        let compCount = 0;
        const componentTypes = new Set<string>();
        for (const row of rows) {
          if (Array.isArray(row.cells)) {
            for (const cell of row.cells) {
              if (cell?.content?.type) {
                compCount++;
                componentTypes.add(cell.content.type);
              }
            }
          }
        }

        setVersionDetails(prev => ({
          ...prev,
          [versionId]: {
            rowCount: rows.length,
            compCount,
            componentTypes: Array.from(componentTypes).slice(0, 5),
          },
        }));
      } catch (err) {
        console.error('[Editor] handleToggleVersionDetail() — error:', err instanceof Error ? err.message : err);
      } finally {
        setLoadingVersionDetail(false);
      }
    }
  }, [expandedVersionId, selectedModule, versionDetails]);

  // ── View Version JSON (VER-008) ──────────────────────────────────────
  const handleViewVersionJson = useCallback((versionId: string, versionLabel: string) => {
    const json = versionContentCache[versionId];
    if (json) {
      setVersionJsonModal({ json, versionLabel });
    } else {
      // Try to load it on demand
      const currentModule = selectedModule;
      if (!currentModule) return;
      api.get<any>(`/api/modules/${currentModule}/versions/${versionId}`).then(detail => {
        setVersionContentCache(prev => ({ ...prev, [versionId]: detail.sdui_json || {} }));
        setVersionJsonModal({ json: detail.sdui_json || {}, versionLabel });
      }).catch(err => {
        console.error('[Editor] handleViewVersionJson() — error:', err);
        showMsg('error', 'Failed to load version JSON');
      });
    }
  }, [versionContentCache, selectedModule, showMsg]);

  // ── Version Tree (VER-003) ───────────────────────────────────────────
  interface VersionNode {
    version: typeof versions[number];
    children: VersionNode[];
    depth: number;
  }

  const flatVersionTree = useMemo((): VersionNode[] => {
    if (versions.length === 0) return [];

    const nodeMap = new Map<string, VersionNode>();
    for (const v of versions) {
      nodeMap.set(v.id, { version: v, children: [], depth: 0 });
    }

    const roots: VersionNode[] = [];
    for (const v of versions) {
      const node = nodeMap.get(v.id)!;
      if (v.parent_version_id && nodeMap.has(v.parent_version_id)) {
        nodeMap.get(v.parent_version_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort children by created_at (oldest first)
    for (const node of nodeMap.values()) {
      node.children.sort((a, b) =>
        new Date(a.version.created_at).getTime() - new Date(b.version.created_at).getTime()
      );
    }

    // Sort roots by created_at (oldest first for tree view)
    roots.sort((a, b) =>
      new Date(a.version.created_at).getTime() - new Date(b.version.created_at).getTime()
    );

    // Compute depths
    function setDepth(nodes: VersionNode[], depth: number) {
      for (const node of nodes) {
        node.depth = depth;
        setDepth(node.children, depth + 1);
      }
    }
    setDepth(roots, 0);

    // Flatten depth-first
    const result: VersionNode[] = [];
    function walk(nodes: VersionNode[]) {
      for (const node of nodes) {
        result.push(node);
        walk(node.children);
      }
    }
    walk(roots);

    return result;
  }, [versions]);

  // ── Version Diff (FF4-VERSIONING-UI) ──────────────────────────────────

  const handleVersionDiff = useCallback(async (versionIdA: string, versionIdB: string) => {
    console.log('[Editor] handleVersionDiff() — comparing:', versionIdA, 'vs', versionIdB);

    // Ensure both version contents are cached
    const currentModule = selectedModule;
    if (!currentModule) return;

    setLoadingVersionContent(true);
    try {
      const idsToFetch = [versionIdA, versionIdB].filter(id => !versionContentCache[id]);
      for (const id of idsToFetch) {
        const detail = await api.get<any>(`/api/modules/${currentModule}/versions/${id}`);
        setVersionContentCache(prev => ({ ...prev, [id]: detail.sdui_json || {} }));
      }

      const contentA = versionContentCache[versionIdA] ?? { rows: [] };
      const contentB = versionContentCache[versionIdB] ?? { rows: [] };
      const rowsA = Array.isArray(contentA.rows) ? contentA.rows : [];
      const rowsB = Array.isArray(contentB.rows) ? contentB.rows : [];

      const typesA = new Set<string>();
      const typesB = new Set<string>();
      let compsA = 0;
      let compsB = 0;

      for (const row of rowsA) {
        if (Array.isArray(row.cells)) {
          for (const cell of row.cells) {
            if (cell?.content?.type) {
              compsA++;
              typesA.add(cell.content.type);
            }
          }
        }
      }
      for (const row of rowsB) {
        if (Array.isArray(row.cells)) {
          for (const cell of row.cells) {
            if (cell?.content?.type) {
              compsB++;
              typesB.add(cell.content.type);
            }
          }
        }
      }

      const added = Array.from(typesB).filter(t => !typesA.has(t));
      const removed = Array.from(typesA).filter(t => !typesB.has(t));
      const sameRows = Math.min(rowsA.length, rowsB.length);

      setVersionDiffResult({
        versionA: versionIdA, versionB: versionIdB,
        rowsA: rowsA.length, rowsB: rowsB.length,
        compsA, compsB,
        typesA: Array.from(typesA), typesB: Array.from(typesB),
        added, removed,
        sameRows,
      });
    } catch (err) {
      console.error('[Editor] handleVersionDiff() — error:', err instanceof Error ? err.message : err);
    } finally {
      setLoadingVersionContent(false);
    }
  }, [selectedModule, versionContentCache]);

  const handleEnterDiffMode = useCallback((versionId: string) => {
    setVersionDiffMode(true);
    setVersionDiffA(versionId);
    setVersionDiffB(null);
    setVersionDiffResult(null);
  }, []);

  const handleSelectDiffTarget = useCallback((versionId: string) => {
    setVersionDiffB(versionId);
    if (versionDiffA && versionId) {
      void handleVersionDiff(versionDiffA, versionId);
    }
  }, [versionDiffA, handleVersionDiff]);

  const handleExitDiffMode = useCallback(() => {
    setVersionDiffMode(false);
    setVersionDiffA(null);
    setVersionDiffB(null);
    setVersionDiffResult(null);
  }, []);

  // FF4-VERSIONING-UI-002: Close version history modal on Escape key
  useEffect(() => {
    if (!showVersionHistory) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowVersionHistory(false);
        setExpandedVersionId(null);
        if (versionDiffMode) {
          handleExitDiffMode();
        }
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showVersionHistory, versionDiffMode, handleExitDiffMode]);

  // Templates
  const loadTemplates = useCallback(async () => {
    console.log('[Editor] loadTemplates() — starting');
    setLoadingTemplates(true);
    try {
      const data = await api.get<{ items: Template[] }>('/api/templates');
      const count = data.items?.length || 0;
      console.log(`[Editor] loadTemplates() — success: ${count} templates loaded`);
      setTemplates(data.items || []);
    } catch (err) {
      console.error('[Editor] loadTemplates() — error:', err instanceof Error ? err.message : err);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSaveTemplate = useCallback(async () => {
    console.log(`[Editor] handleSaveTemplate() — saving template: ${templateName} (category: ${templateCategory})`);
    if (!templateName.trim()) {
      console.log('[Editor] handleSaveTemplate() — no name, aborting');
      return;
    }
    try {
      const screen = getPersistableScreen();
      await api.post('/api/templates', {
        name: templateName,
        category: templateCategory,
        screen_json: screen,
        is_public: true,
      });
      console.log(`[Editor] handleSaveTemplate() — API success for: ${templateName}`);
      showMsg('success', 'Template saved!');
      await loadTemplates();
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch (err) {
      console.error('[Editor] handleSaveTemplate() — error:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Save failed');
    }
  }, [templateName, templateCategory, getPersistableScreen, showMsg, loadTemplates]);

  const handleApplyTemplate = useCallback(async (templateId: string) => {
    console.log(`[Editor] handleApplyTemplate() — loading template ID: ${templateId}`);
    if (!confirmDestructiveEditorAction('Applying a template will replace the current canvas.')) {
      console.log('[Editor] handleApplyTemplate() — user cancelled');
      return;
    }

    const currentModule = selectedModule;
    if (!currentModule) {
      showMsg('error', 'No module selected to apply template to.');
      return;
    }

    try {
      // FF4-MOD-011: Auto-create checkpoint before template apply
      try {
        const screen = getPersistableScreen();
        await api.post<any>(`/api/sdui/${currentModule}`, { screen });
        await api.post<any>(`/api/modules/${currentModule}/checkpoints`, {
          change_summary: 'Auto-checkpoint before template apply',
        });
        console.log('[Editor] handleApplyTemplate() — auto-checkpoint created before template apply');
      } catch (checkpointErr) {
        // Non-blocking: if checkpoint creation fails, continue with template apply
        console.warn('[Editor] handleApplyTemplate() — checkpoint creation failed, continuing:', checkpointErr);
      }

      const detail = await api.get<TemplateDetail>(`/api/templates/${templateId}`);
      console.log(`[Editor] handleApplyTemplate() — fetched template: ${detail.name}`);
      const normalized = normalizeScreenData(detail.screen_json);
      if (!normalized) {
        console.error('[Editor] handleApplyTemplate() — normalized screen data is null');
        showMsg('error', 'Template data is invalid.');
        return;
      }
      console.log(`[Editor] handleApplyTemplate() — applying: ${normalized.rows.length} rows`);
      applyScreen(normalized);
      showMsg('success', `Template loaded: ${detail.name}`);
    } catch (err) {
      console.error('[Editor] handleApplyTemplate() — error:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Failed to load template');
    }
    setShowLoadTemplate(false);
  }, [applyScreen, confirmDestructiveEditorAction, getPersistableScreen, selectedModule, showMsg]);

  const closeImportJsonModal = useCallback(() => {
    setShowImportJson(false);
    setImportJsonValue('');
  }, []);

  const handleImportJson = useCallback(() => {
    console.log('[Editor] handleImportJson() — importing JSON');
    try {
      const parsed = JSON.parse(importJsonValue);
      const importableScreen = extractImportableScreen(parsed);
      const normalized = normalizeScreenData(importableScreen);

      if (!normalized) {
        console.error('[Editor] handleImportJson() — normalized screen is null');
        throw new Error('JSON must contain rows or sections.');
      }

      if (!confirmDestructiveEditorAction('Importing JSON will replace the current canvas.')) {
        console.log('[Editor] handleImportJson() — user cancelled');
        return;
      }

      console.log(`[Editor] handleImportJson() — parsed: ${normalized.rows.length} rows, applying`);
      applyScreen(normalized);
      showMsg('success', 'JSON imported into the editor.');
      closeImportJsonModal();
    } catch (err) {
      console.error('[Editor] handleImportJson() — error:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Import failed');
    }
  }, [applyScreen, closeImportJsonModal, confirmDestructiveEditorAction, importJsonValue, showMsg]);

  const handleApplyLocalScreenTemplate = useCallback((template: LocalTemplateDefinition) => {
    console.log(`[Editor] handleApplyLocalScreenTemplate() — applying: ${template.name}`);
    if (!confirmDestructiveEditorAction('Applying a local screen template will replace the current canvas.')) {
      console.log('[Editor] handleApplyLocalScreenTemplate() — user cancelled');
      return false;
    }

    const clonedScreen = cloneTemplateScreen(template.screen);
    console.log(`[Editor] handleApplyLocalScreenTemplate() — applying ${clonedScreen.rows.length} rows`);
    applyScreen(clonedScreen);
    showMsg('success', `Template loaded: ${template.name}`);
    return true;
  }, [applyScreen, confirmDestructiveEditorAction, showMsg]);

  const handleAppendLocalRowTemplate = useCallback((template: LocalTemplateDefinition) => {
    console.log(`[Editor] handleAppendLocalRowTemplate() — appending: ${template.name}`);
    if (!confirmDestructiveEditorAction('Appending a row template will modify the current canvas.')) {
      console.log('[Editor] handleAppendLocalRowTemplate() — user cancelled');
      return;
    }

    const clonedScreen = cloneTemplateScreen(template.screen);
    const currentScreen = getScreen();
    console.log(`[Editor] handleAppendLocalRowTemplate() — current: ${currentScreen.rows.length} rows, adding: ${clonedScreen.rows.length} rows`);
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
      <div data-testid="toolbar" className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-200 shrink-0">
        {/* Left: Module info + Versioning controls */}
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

          {/* Saved status indicator */}
          <span className="text-[10px] px-2 py-0.5 text-gray-400">
            <Clock size={10} className="inline mr-0.5" />
            {lastSavedLabel}
          </span>

          {hasUnsavedChanges && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              Unsaved
            </span>
          )}

          {/* Last checkpoint indicator */}
          {lastCheckpointId && (
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
              Checkpoint saved
            </span>
          )}

          {/* Versioning action buttons */}
          <button onClick={handleCreateCheckpoint} disabled={checkpointing || !canModifySelectedModule}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors disabled:opacity-50">
            <Camera size={10} /> {checkpointing ? '...' : 'Checkpoint'}
          </button>

          <button onClick={handleOpenVersionHistory}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              showVersionHistory
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}>
            <History size={10} /> History
          </button>

          <button onClick={handlePreviewInWeb}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors">
            <Eye size={10} /> Preview
          </button>
        </div>

        {/* Center: Undo/Redo + Device picker */}
        <div className="flex items-center gap-1.5">
          <button data-testid="btn-undo" onClick={undo} disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
            <Undo2 size={14} />
          </button>
          <button data-testid="btn-redo" onClick={redo} disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors" title="Redo (Ctrl+Y)">
            <Redo2 size={14} />
          </button>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Device picker */}
          <div className="relative">
            <button
              data-testid="btn-device-picker"
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
            <Eye size={11} /> Preview in Web Admin
          </button>

          <div className="w-px h-4 bg-gray-200 mx-0.5" />

          <button data-testid="btn-delete-module" onClick={handleDeleteScreen} disabled={!canDeleteSelectedScreen}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors disabled:opacity-50 disabled:hover:bg-red-50">
            <Trash2 size={11} /> Delete Module
          </button>
          <button data-testid="btn-save" onClick={handleSaveDraft} disabled={saving || !canModifySelectedModule}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50">
            <Save size={11} /> {saving ? 'Saving...' : 'Save'}
          </button>

        </div>
      </div>

      {/* ── Main 3-Panel Layout ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Tabbed — Structure | Components | Template Library */}
        <div className="w-[240px] bg-white border-r border-gray-200 shrink-0 overflow-hidden flex flex-col min-h-0">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 shrink-0">
            <button
              onClick={() => setLeftPanelTab('structure')}
              className={`flex-1 text-[10px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                leftPanelTab === 'structure'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Structure
            </button>
            <button
              onClick={() => setLeftPanelTab('components')}
              className={`flex-1 text-[10px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                leftPanelTab === 'components'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Components
            </button>
            <button
              onClick={() => setLeftPanelTab('templates')}
              className={`flex-1 text-[10px] font-semibold uppercase tracking-wider py-2 transition-colors ${
                leftPanelTab === 'templates'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Templates
            </button>
          </div>

          {/* Tab content */}
          {leftPanelTab === 'structure' && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <StructureTree moduleLabel={selectedModuleLabel} />
            </div>
          )}

          {leftPanelTab === 'components' && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ComponentPalette />
            </div>
          )}

          {leftPanelTab === 'templates' && (
            <div className="flex-1 min-h-0 overflow-auto bg-gray-50/60">
              <div className="px-3 pb-3 pt-2 space-y-3">
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
                        <div className="mt-2 text-[11px] font-medium text-blue-600">Apply module</div>
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
                      <div className="mt-2 text-[11px] font-medium text-blue-600">Apply module</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Row Templates</div>
                  </div>
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
            </div>
          )}
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
          <span>Module: {selectedModuleStatusLabel}</span>
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

      {/* ── Version History Modal ────────────────────────────────────── */}
      {showVersionHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-[700px] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History size={14} />
                {versionDiffMode ? 'Compare Versions' : `Version History — ${selectedModuleInfo?.name || selectedModule}`}
              </h3>
              <div className="flex items-center gap-2">
                {versionDiffMode && (
                  <button
                    onClick={handleExitDiffMode}
                    className="text-[11px] px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Exit Compare
                  </button>
                )}
                {!versionDiffMode && versions.length >= 2 && (
                  <button
                    onClick={() => setVersionDiffMode(true)}
                    className="text-[11px] px-2 py-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    title="Compare two versions"
                  >
                    Compare
                  </button>
                )}
                <button onClick={() => { setShowVersionHistory(false); setExpandedVersionId(null); handleExitDiffMode(); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
            </div>

            {/* FF4-VERSIONING-UI: Version diff result */}
            {versionDiffResult && versionDiffMode && (
              <div className="mb-4 border border-purple-200 bg-purple-50 rounded-lg p-3 space-y-2">
                <div className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                  <Info size={12} />
                  Version Comparison
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white rounded p-2 border border-purple-100">
                    <div className="font-medium text-gray-700">Version A</div>
                    <div className="text-gray-500 mt-1">{versionDiffResult.rowsA} rows, {versionDiffResult.compsA} components</div>
                    {versionDiffResult.typesA.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {versionDiffResult.typesA.map(t => <span key={t} className="px-1 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded p-2 border border-purple-100">
                    <div className="font-medium text-gray-700">Version B</div>
                    <div className="text-gray-500 mt-1">{versionDiffResult.rowsB} rows, {versionDiffResult.compsB} components</div>
                    {versionDiffResult.typesB.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {versionDiffResult.typesB.map(t => <span key={t} className="px-1 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{t}</span>)}
                      </div>
                    )}
                  </div>
                </div>
                {(versionDiffResult.added.length > 0 || versionDiffResult.removed.length > 0) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {versionDiffResult.added.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                        + {t}
                      </span>
                    ))}
                    {versionDiffResult.removed.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                        - {t}
                      </span>
                    ))}
                    {versionDiffResult.rowsA === versionDiffResult.rowsB && versionDiffResult.compsA === versionDiffResult.compsB && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                        Same row/component count
                      </span>
                    )}
                  </div>
                )}
                {versionDiffResult.added.length === 0 && versionDiffResult.removed.length === 0 && (
                  <div className="text-[10px] text-gray-500">Same component types in both versions</div>
                )}
              </div>
            )}

            {/* Used-by panel (VER-008) */}
            {!versionDiffMode && (
              <div className="mb-3 border border-blue-200 bg-blue-50/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowUsedByPanel(!showUsedByPanel)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs text-blue-800 hover:bg-blue-100/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <ExternalLink size={11} />
                    Used by ({loadingUsedBy ? '...' : usedByApps.length} app{usedByApps.length !== 1 ? 's' : ''})
                  </span>
                  <span>{showUsedByPanel ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</span>
                </button>
                {showUsedByPanel && (
                  <div className="px-3 pb-2">
                    {loadingUsedBy ? (
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 py-1">
                        <Clock size={10} className="animate-spin" />
                        Loading...
                      </div>
                    ) : usedByApps.length === 0 ? (
                      <div className="text-xs text-gray-400 py-1">This module is not used by any app.</div>
                    ) : (
                      <div className="space-y-1">
                        {usedByApps.map(app => (
                          <div key={app.app_id} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            {app.app_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {loadingVersions ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading versions...</div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-sm mb-2">No versions yet</div>
                <div className="text-gray-400 text-xs">Create a checkpoint to save the current state as a version.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {versionDiffMode && !versionDiffResult && (
                  <div className="text-xs text-gray-500 mb-2 px-1">
                    {versionDiffA && !versionDiffB
                      ? 'Select another version to compare:'
                      : 'Click a version to select it as the first comparison:'}
                  </div>
                )}
                {flatVersionTree.map((node) => {
                  const v = node.version;
                  const isExpanded = expandedVersionId === v.id && !versionDiffMode;
                  const detail = versionDetails[v.id];
                  const isLoadingDetail = loadingVersionDetail && isExpanded && !detail;
                  const isDiffSelectedA = versionDiffA === v.id;
                  const isDiffSelectedB = versionDiffB === v.id;
                  const isArchived = v.status === 'archived';

                  return (
                    <div
                      key={v.id}
                      style={{ marginLeft: `${node.depth * 20}px` }}
                      className={`border rounded-lg overflow-hidden transition-colors ${
                        isDiffSelectedA ? 'border-purple-400 bg-purple-50/30'
                        : isDiffSelectedB ? 'border-purple-600 bg-purple-100/30'
                        : versionDiffMode ? 'border-gray-200 cursor-pointer hover:border-purple-300 hover:bg-gray-50'
                        : isArchived ? 'border-gray-100 bg-gray-50/50'
                        : 'border-gray-200'
                      } ${node.depth > 0 ? 'border-l-2 border-l-gray-300' : ''}`}
                    >
                      {/* Collapsed header */}
                      <div
                        className={`flex items-center justify-between p-3 transition-colors cursor-pointer ${
                          node.depth > 0 ? 'hover:bg-gray-50/80' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          if (versionDiffMode) {
                            if (!versionDiffA) {
                              handleEnterDiffMode(v.id);
                            } else if (!versionDiffB && versionDiffA !== v.id) {
                              handleSelectDiffTarget(v.id);
                            }
                          } else {
                            void handleToggleVersionDetail(v.id);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!versionDiffMode && (
                              <button className="text-gray-400 hover:text-gray-600 p-0.5">
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronRight size={12} />}
                              </button>
                            )}
                            {node.depth > 0 && !versionDiffMode && (
                              <CornerDownRight size={12} className="text-gray-300 shrink-0" />
                            )}
                            {versionDiffMode && (
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold ${
                                isDiffSelectedA ? 'border-purple-500 bg-purple-500 text-white'
                                : isDiffSelectedB ? 'border-purple-600 bg-purple-600 text-white'
                                : 'border-gray-300'
                              }`}>
                                {isDiffSelectedA ? 'A' : isDiffSelectedB ? 'B' : ''}
                              </span>
                            )}
                            <div className="text-sm font-medium text-gray-800">
                              {/* FF4-VERSIONING-UI-001: avoid "v11 — v11" duplicate when display_name matches version prefix */}
                              {v.display_name === `v${v.version_number}`
                                ? `v${v.version_number}`
                                : `v${v.version_number} — ${v.display_name}`}
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                              {v.source}
                            </span>
                            {isArchived && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                Archived
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 ml-5">
                            {new Date(v.created_at).toLocaleString()}
                            {v.change_summary && (
                              <span className="ml-2 text-gray-500">— {v.change_summary}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                          {!versionDiffMode && (
                            <>
                              <button
                                onClick={() => { handleViewVersionJson(v.id, `v${v.version_number}`); }}
                                className="px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="View JSON"
                              >
                                <FileJson size={11} className="inline mr-0.5" />
                                JSON
                              </button>
                              <button
                                data-testid={`btn-restore-v${v.version_number}`}
                                onClick={() => { void handleRestoreVersion(v.id, v.version_number); setShowVersionHistory(false); }}
                                className="px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Restore to draft"
                              >
                                Restore
                              </button>
                              <button
                                data-testid={`btn-publish-v${v.version_number}`}
                                onClick={() => { void handlePublishVersion(v.id, v.version_number); setShowVersionHistory(false); }}
                                className="px-2 py-1 text-[11px] text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Publish as live"
                              >
                                Publish
                              </button>
                              {!isArchived && (
                                <button
                                  onClick={() => { void handleArchiveVersion(v.id, v.version_number); }}
                                  disabled={archivingVersionId === v.id}
                                  className="px-2 py-1 text-[11px] text-orange-600 hover:bg-orange-50 rounded transition-colors disabled:opacity-50"
                                  title="Archive version"
                                >
                                  <Archive size={11} className="inline mr-0.5" />
                                  {archivingVersionId === v.id ? '...' : 'Archive'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded content preview (non-diff mode only) */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 ml-0">
                          {isLoadingDetail ? (
                            <div className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Clock size={10} className="animate-spin" />
                              Loading version content...
                            </div>
                          ) : detail ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-3 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <List size={11} />
                                  {detail.rowCount} row{detail.rowCount !== 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Info size={11} />
                                  {detail.compCount} component{detail.compCount !== 1 ? 's' : ''}
                                </span>
                                <button
                                  onClick={() => { handleViewVersionJson(v.id, `v${v.version_number}`); }}
                                  className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                                  title="View raw SDUI JSON"
                                >
                                  <FileJson size={10} />
                                  View JSON
                                </button>
                              </div>
                              {detail.componentTypes.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] text-gray-400">Components:</span>
                                  {detail.componentTypes.map(ct => (
                                    <span key={ct} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                      {ct}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">No content data available</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Version JSON View Modal (VER-008) ──────────────────────────── */}
      {versionJsonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setVersionJsonModal(null)}>
          <div className="bg-white rounded-lg p-4 w-[600px] max-h-[75vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FileJson size={14} />
                Version JSON — {versionJsonModal.versionLabel}
              </h3>
              <button onClick={() => setVersionJsonModal(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] font-mono text-gray-700 overflow-auto max-h-[60vh] leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(versionJsonModal.json, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* ── Preview Modal ────────────────────────────────────────────── */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-[560px] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Eye size={14} />
                Preview — {selectedModuleInfo?.name || selectedModule}
              </h3>
              <button onClick={() => { setShowPreviewModal(false); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              {/* Screen summary */}
              <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <span className="flex items-center gap-1">
                  <List size={11} />
                  {rows.length} row{rows.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Info size={11} />
                  {rows.reduce((sum, r) => sum + r.cells.filter(c => c.content !== null).length, 0)} component{rows.reduce((sum, r) => sum + r.cells.filter(c => c.content !== null).length, 0) !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {lastSavedLabel}
                </span>
                {hasUnsavedChanges && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium text-[10px]">
                    Unsaved
                  </span>
                )}
              </div>

              {/* Component type summary */}
              {(() => {
                const componentTypes = Array.from(new Set(
                  rows.flatMap(r => r.cells.map(c => c.content?.type).filter(Boolean))
                ));
                return componentTypes.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {componentTypes.slice(0, 8).map(type => (
                      <span key={type} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700">
                        {type}
                      </span>
                    ))}
                    {componentTypes.length > 8 && (
                      <span className="text-[10px] text-gray-400">
                        +{componentTypes.length - 8} more
                      </span>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Embedded preview of current screen */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 text-[10px] text-gray-500 font-medium border-b border-gray-200 flex items-center gap-1.5">
                  <Smartphone size={10} />
                  Screen Preview ({selectedPreset.name} {deviceWidth}x{deviceHeight})
                </div>
                {rows.length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm bg-white">No content to preview</div>
                ) : (
                  <div className="bg-white p-2">
                    <SDUIPreview json={getScreen()} maxWidth={Math.min(deviceWidth, 500)} maxHeight={400} />
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500">
                Preview shows how this module will appear on mobile. This is a snapshot of your
                current working draft — no changes are published.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    setShowAppPreview(true);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors text-center"
                >
                  Full App Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}