import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Plus, Save, ChevronDown, Eye, Rocket, History, Clock, CheckCircle, AlertTriangle, AlertOctagon, RotateCcw, CornerDownRight } from 'lucide-react';
import { api } from '../lib/api';
import { ensureDefaultHomeModuleInstance } from '../lib/ensureDefaultModuleInstance';
import { formatVersionOptionLabel, getVersionPrimaryLabel } from '../lib/utils';
import { useAppEditorStore } from '../stores/useAppEditorStore';
import { usePreviewStore } from '../stores/usePreviewStore';
import { BottomBarConfig } from '../components/AppEditor/BottomBarConfig';
import { PreviewPicker } from '../components/PreviewPicker';
import { BrowserPreview } from '../components/BrowserPreview';
import { AppPhoneShell } from '../components/AppPhoneShell';
import { SDUIPreview } from '../components/SDUIPreview';
import { resolveModuleScreenForApp } from '../lib/previewResolver';
import { IconPicker } from '../editor/IconPicker';
import { renderLucideIcon } from '../lib/lucideIcon';
import type { ModuleInstance, BottomBarSlot, App } from '../stores/useAppEditorStore';

interface AppVersion {
  id: string;
  version_number: number;
  display_name: string;
  default_timestamp_name: string;
  custom_name: string | null;
  source: string;
  change_summary: string | null;
  created_at: string;
  parent_version_id: string | null;
}

interface ModuleVersion {
  id: string;
  version_number: number;
  display_name: string;
  default_timestamp_name?: string;
  custom_name?: string | null;
  created_at: string;
  status: string;
}

interface ModuleVersionPolicy {
  moduleInstanceId: string;
  useNewest: boolean;       // true = "Use newest", false = "Use specific"
  pinnedVersionId: string | null;
}

// Default icons for module types when API doesn't provide them (FF4-APP-001,013)
const DEFAULT_MODULE_ICONS: Record<string, string> = {
  home: 'home',
  chat: 'message-circle',
  calendar: 'calendar',
  todo: 'check-square',
  notes: 'file-text',
  weather: 'cloud',
  settings: 'settings',
  dashboard: 'layout-dashboard',
  forms: 'file-input',
  modules: 'grid',
};

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
  } = useAppEditorStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAppSwitcher, setShowAppSwitcher] = useState(false);
  const [availableModules, setAvailableModules] = useState<ModuleInstance[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [showBrowserPreview, setShowBrowserPreview] = useState(false);
  const [modulePreviewScreen, setModulePreviewScreen] = useState<Record<string, unknown> | null>(null);
  const [modulePreviewLoading, setModulePreviewLoading] = useState(false);

  const { startPreview } = usePreviewStore();
  const currentApp = apps?.find(app => app.id === currentAppId);

  // ── Versioning state ──────────────────────────────────────────────────
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [appVersions, setAppVersions] = useState<AppVersion[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [liveVersionDisplay, setLiveVersionDisplay] = useState<string | null>(null);

  // ── Version diff state (FF4-VERSIONING-APP) ───────────────────────────
  const [versionDiffMode, setVersionDiffMode] = useState(false);
  const [versionDiffA, setVersionDiffA] = useState<string | null>(null);
  const [versionDiffB, setVersionDiffB] = useState<string | null>(null);

  // ── App Version Tree (VER-003) ────────────────────────────────────────
  interface AppVersionNode {
    version: AppVersion;
    children: AppVersionNode[];
    depth: number;
  }

  const appVersionTree = useMemo((): AppVersionNode[] => {
    if (appVersions.length === 0) return [];
    const nodeMap = new Map<string, AppVersionNode>();
    for (const v of appVersions) {
      nodeMap.set(v.id, { version: v, children: [], depth: 0 });
    }
    const roots: AppVersionNode[] = [];
    for (const v of appVersions) {
      const node = nodeMap.get(v.id)!;
      if (v.parent_version_id && nodeMap.has(v.parent_version_id)) {
        nodeMap.get(v.parent_version_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    for (const node of nodeMap.values()) {
      node.children.sort((a, b) =>
        new Date(a.version.created_at).getTime() - new Date(b.version.created_at).getTime()
      );
    }
    roots.sort((a, b) =>
      new Date(a.version.created_at).getTime() - new Date(b.version.created_at).getTime()
    );
    function setDepth(nodes: AppVersionNode[], depth: number) {
      for (const node of nodes) {
        node.depth = depth;
        setDepth(node.children, depth + 1);
      }
    }
    setDepth(roots, 0);
    return roots;
  }, [appVersions]);

  const flatAppVersionTree = useMemo((): AppVersionNode[] => {
    const result: AppVersionNode[] = [];
    function walk(nodes: AppVersionNode[]) {
      for (const node of nodes) {
        result.push(node);
        walk(node.children);
      }
    }
    walk(appVersionTree);
    return result;
  }, [appVersionTree]);

  // ── Autosave state (FF4-APP-006) ───────────────────────────────────
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveSuppressedRef = useRef(false);

  // ── Module version resolution state (FF4-APP-007,008,009) ──────────
  const [moduleVersions, setModuleVersions] = useState<Record<string, ModuleVersion[]>>({});
  const [versionPolicies, setVersionPolicies] = useState<Record<string, ModuleVersionPolicy>>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_loadingModuleVersions, setLoadingModuleVersions] = useState(false);

  // ── Per-module icon editing state (FF4-APP-001,013) ───────────────
  const [editingModuleIcon, setEditingModuleIcon] = useState<string | null>(null);

  // ── Per-module icon overrides (FF4-APP-001,013) ────────────────────
  const [moduleIconOverrides, setModuleIconOverrides] = useState<Record<string, string>>({});

  // ── Archived version warnings (FF4-APP-022) ─────────────────────────
  const [archivedModuleWarnings, setArchivedModuleWarnings] = useState<Record<string, string>>({});

  // ── Expanded publish modal state (FF4-APP-011,017, VER-006,007) ────
  const [publishValidationResults, setPublishValidationResults] = useState<Array<{
    moduleName: string;
    status: 'pass' | 'warn' | 'error';
    message: string;
  }> | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<{
    total: number;
    updated: number;
    pending: number;
  } | null>(null);

  // ── Assigned devices + error panel (FF4-APP-011,024) ───────────────
  interface AssignedDeviceInfo {
    id: string;
    device_name: string;
    last_seen: string | null;
    update_status?: string;
  }
  interface DeviceErrorInfo {
    id: string;
    device_name: string | null;
    error_message: string;
    error_type: string;
    error_details: Record<string, unknown> | null;
    created_at: string;
  }
  const [assignedDevices, setAssignedDevices] = useState<AssignedDeviceInfo[]>([]);
  const [deviceErrors, setDeviceErrors] = useState<DeviceErrorInfo[]>([]);
  const [loadingDevicePanel, setLoadingDevicePanel] = useState(false);

  const showMsg = (type: 'success' | 'error' | 'info', text: string) => {
    console.log(`[AppEditor] message: ${type} — ${text}`);
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Load assigned devices + recent errors for this app (FF4-APP-011,024)
  useEffect(() => {
    if (!currentAppId) {
      setAssignedDevices([]);
      setDeviceErrors([]);
      return;
    }

    const loadDevicePanel = async () => {
      setLoadingDevicePanel(true);
      try {
        const [devices, errors] = await Promise.all([
          api.get<Array<AssignedDeviceInfo & { assigned_app_id?: string | null }>>('/api/devices'),
          api.get<{ items: DeviceErrorInfo[] }>(`/api/devices/errors?app_id=${currentAppId}&limit=10`),
        ]);
        const assigned = (Array.isArray(devices) ? devices : []).filter(
          (d) => d.assigned_app_id === currentAppId,
        );
        setAssignedDevices(assigned);
        setDeviceErrors(errors.items ?? []);
      } catch {
        setAssignedDevices([]);
        setDeviceErrors([]);
      } finally {
        setLoadingDevicePanel(false);
      }
    };

    void loadDevicePanel();
  }, [currentAppId, deviceStatus]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect, intentionally empty deps
  }, []);

  // ── Autosave effect (FF4-APP-006) ──────────────────────────────────
  // Debounced autosave: saves 500ms after last change to the app state
  useEffect(() => {
    if (!currentApp || !currentAppId) return;

    // Skip autosave if a manual save is in progress
    if (autoSaveSuppressedRef.current) return;

    // Clear any pending autosave
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Don't auto-save if nothing meaningful has changed (tolerate initial render)
    if (!currentApp.name && !currentApp.bottom_bar_config.length) return;

    setAutosaveStatus('saving');

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await api.updateAppDraft(currentAppId, { config_json: currentApp, dirty: true });
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSavedTime(timeStr);
        setAutosaveStatus('saved');
      } catch {
        setAutosaveStatus('failed');
      }
    }, 500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [currentApp, currentAppId]);

  // Load available modules (installed instances — not Module Editor tab list)
  useEffect(() => {
    console.log('[AppEditor] mount — loading modules');
    const loadModules = async () => {
      try {
        await ensureDefaultHomeModuleInstance();
        const response = await api.getModuleInstances();
        const activeCount = response.items.filter(m => m.status === 'active').length;
        console.log(`[AppEditor] loadModules() — loaded ${response.items.length} modules, ${activeCount} active`);
        const apiModules = response.items.filter(m => m.status === 'active');
        const transformedModules: ModuleInstance[] = apiModules.map(m => {
          const icon = DEFAULT_MODULE_ICONS[m.module_type] || 'package';
          return {
            module_instance_id: m.module_instance_id,
            module_type: m.module_type,
            name: m.name,
            icon,
            status: m.status as 'active' | 'disabled',
            template_id: m.template_id ?? null,
          };
        });
        setAvailableModules(transformedModules);
      } catch (err) {
        console.error('[AppEditor] loadModules() — failed:', err instanceof Error ? err.message : err);
        showMsg('error', 'Failed to load modules');
      }
    };

    void loadModules();
  }, []);

  // Load module versions for version resolution (FF4-APP-007,008,009)
  useEffect(() => {
    if (availableModules.length === 0) return;

    const loadModuleVersions = async () => {
      setLoadingModuleVersions(true);
      const versionMap: Record<string, ModuleVersion[]> = {};
      const policyMap: Record<string, ModuleVersionPolicy> = {};

      for (const mod of availableModules) {
        try {
          const response = await api.get<{ items: ModuleVersion[] }>(
            `/api/modules/${mod.module_instance_id}/versions`
          );
          const versions = response.items || [];
          versionMap[mod.module_instance_id] = versions;
          // Default: use newest
          policyMap[mod.module_instance_id] = {
            moduleInstanceId: mod.module_instance_id,
            useNewest: true,
            pinnedVersionId: null,
          };
        } catch {
          versionMap[mod.module_instance_id] = [];
          policyMap[mod.module_instance_id] = {
            moduleInstanceId: mod.module_instance_id,
            useNewest: true,
            pinnedVersionId: null,
          };
        }
      }
      setModuleVersions(versionMap);
      setVersionPolicies(policyMap);
      setLoadingModuleVersions(false);
    };

    void loadModuleVersions();
  }, [availableModules]);

  // Fetch version info when app changes
  useEffect(() => {
    if (!currentAppId) {
      setLiveVersionDisplay(null);
      return;
    }

    const fetchAppVersions = async () => {
      try {
        const response = await api.get<{ items: AppVersion[] }>(`/api/apps/${currentAppId}/versions`);
        const versions = response.items || [];
        setAppVersions(versions);

        // Find latest published version for the live indicator
        const published = versions.find(v => v.source === 'publish');
        if (published) {
          setLiveVersionDisplay(getVersionPrimaryLabel(published));
        } else {
          setLiveVersionDisplay(null);
        }
      } catch {
        setLiveVersionDisplay(null);
      }
    };

    void fetchAppVersions();
  }, [currentAppId]);

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
    // Suppress autosave during manual save (race condition prevention)
    autoSaveSuppressedRef.current = true;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setAutosaveStatus('saving');
    try {
      // REQ: FF4-PUBLISH-001 — wrap app config in config_json per AppWorkingDraftUpdate schema
      await api.updateAppDraft(currentApp.id, { config_json: currentApp, dirty: true });
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(timeStr);
      setAutosaveStatus('saved');
      console.log('[AppEditor] handleSave() — app saved to draft successfully');
      showMsg('success', 'App saved successfully');
    } catch (err) {
      setAutosaveStatus('failed');
      console.error('[AppEditor] handleSave() — failed:', err instanceof Error ? err.message : err);
      showMsg('error', err instanceof Error ? err.message : 'Failed to save app');
    } finally {
      setSaving(false);
      // Re-enable autosave after a short delay
      setTimeout(() => { autoSaveSuppressedRef.current = false; }, 100);
    }
  };

  // ── Module version policy handlers (FF4-APP-007,008,009) ───────────
  const handleVersionPolicyChange = (moduleInstanceId: string, useNewest: boolean) => {
    setVersionPolicies(prev => ({
      ...prev,
      [moduleInstanceId]: {
        ...prev[moduleInstanceId],
        useNewest,
        pinnedVersionId: useNewest ? null : prev[moduleInstanceId]?.pinnedVersionId ?? null,
      },
    }));
  };

  const handlePinnedVersionChange = (moduleInstanceId: string, versionId: string) => {
    setVersionPolicies(prev => ({
      ...prev,
      [moduleInstanceId]: {
        ...prev[moduleInstanceId],
        useNewest: false,
        pinnedVersionId: versionId,
      },
    }));
  };

  // ── Per-module icon helpers (FF4-APP-001,013) ─────────────────────
  const getModuleEffectiveIcon = (moduleInstanceId: string, moduleType: string, apiIcon?: string): string => {
    if (moduleIconOverrides[moduleInstanceId]) return moduleIconOverrides[moduleInstanceId];
    if (currentApp?.module_icons?.[moduleInstanceId]) return currentApp.module_icons[moduleInstanceId];
    if (apiIcon) return apiIcon;
    return DEFAULT_MODULE_ICONS[moduleType] || 'package';
  };

  const renderAppIcon = (iconName: string | undefined, size: number) =>
    renderLucideIcon(iconName, size, 'shrink-0', iconName || '⭐');

  const handleModuleIconChange = (moduleInstanceId: string, newIcon: string) => {
    setModuleIconOverrides(prev => ({ ...prev, [moduleInstanceId]: newIcon }));
    // Also persist to app config so it saves
    if (!currentApp) return;
    const icons = { ...(currentApp.module_icons || {}), [moduleInstanceId]: newIcon };
    updateApp(currentApp.id, { module_icons: icons });

    // Also update bottom bar slot icon if this module is in the bottom bar
    if (currentApp) {
      const updatedBottomBar = currentApp.bottom_bar_config.map(slot =>
        slot.module_instance_id === moduleInstanceId
          ? { ...slot, icon: newIcon }
          : slot
      );
      updateApp(currentApp.id, { bottom_bar_config: updatedBottomBar });
    }
  };

  // ── Archived version detection (FF4-APP-022) ──────────────────────
  // Check module versions after they load, flag any archived ones
  useEffect(() => {
    const newWarnings: Record<string, string> = {};
    for (const [modId, versions] of Object.entries(moduleVersions)) {
      // If a pinned version is archived/deleted, show warning
      const policy = versionPolicies[modId];
      if (policy && !policy.useNewest && policy.pinnedVersionId) {
        const pinnedVersion = versions.find(v => v.id === policy.pinnedVersionId);
        if (pinnedVersion && pinnedVersion.status === 'archived') {
          newWarnings[modId] = `This app references an archived module version. Choose a different version or restore the archived version.`;
        }
      }
    }
    setArchivedModuleWarnings(newWarnings);
  }, [moduleVersions, versionPolicies]);

  const handlePreviewBrowser = () => {
    if (!currentApp) return;
    console.log('[AppEditor] handlePreviewBrowser() — opening browser preview for:', currentApp.name);
    setShowPreviewPicker(false);

    const moduleReferences = Object.entries(versionPolicies).map(([modId, policy]) => ({
      moduleId: modId,
      policy: policy.useNewest ? 'use_newest' as const : 'specific_version' as const,
      selectedModuleVersionId: policy.pinnedVersionId,
    }));

    startPreview(
      {
        id: currentApp.id,
        name: currentApp.name,
        icon: currentApp.icon,
        theme: currentApp.theme,
        design_tokens: currentApp.design_tokens,
        dark_mode: currentApp.dark_mode,
        bottom_bar_config: currentApp.bottom_bar_config,
        launchpad_config: launchpadModules,
        moduleReferences,
      },
      'browser'
    );

    setShowBrowserPreview(true);
  };

  const handlePublishApp = async () => {
    if (!currentApp) return;
    console.log('[AppEditor] handlePublishApp() — publishing app:', currentApp.id);
    setPublishing(true);
    setPublishResult(null);
    setPublishValidationResults(null);
    setDeviceStatus(null);

    try {
      // Step 1: Build module reference policies and include in publish payload (FF4-APP-010)
      const moduleReferences = Object.entries(versionPolicies).map(([modId, policy]) => {
        const versions = moduleVersions[modId] || [];
        const newestVersion = versions.length > 0 ? versions[0] : null;
        let resolvedModuleVersionId: string | null = null;

        if (policy.useNewest && newestVersion) {
          resolvedModuleVersionId = newestVersion.id;
        } else if (!policy.useNewest && policy.pinnedVersionId) {
          resolvedModuleVersionId = policy.pinnedVersionId;
        }

        return {
          moduleId: modId,
          policy: policy.useNewest ? 'use_newest' : 'specific_version',
          selectedModuleVersionId: policy.useNewest ? null : policy.pinnedVersionId,
          resolvedModuleVersionId,
        };
      });

      // Save the current app config to draft with module references (FF4-APP-010)
      const publishConfig = {
        ...currentApp,
        module_references: moduleReferences as Record<string, unknown>[],
      };
      await api.updateAppDraft(currentApp.id, { config_json: publishConfig, dirty: true });
      console.log('[AppEditor] handlePublishApp() — app saved to draft with module references');

      // Generate validation results per module (FF4-VER-006, FF4-VER-007)
      const validationResults: Array<{ moduleName: string; status: 'pass' | 'warn' | 'error'; message: string }> = [];
      const allModules = [
        ...currentApp.bottom_bar_config.map(s => ({
          id: s.module_instance_id, name: s.name, icon: s.icon,
        })),
        ...launchpadModules.map(m => ({
          id: m.module_instance_id, name: m.name, icon: m.icon,
        })),
      ];

      for (const mod of allModules) {
        const versions = moduleVersions[mod.id] || [];
        if (versions.length === 0) {
          validationResults.push({
            moduleName: mod.name,
            status: 'error',
            message: 'No versions available for this module',
          });
        } else {
          const policy = versionPolicies[mod.id];
          if (policy && !policy.useNewest && !policy.pinnedVersionId) {
            validationResults.push({
              moduleName: mod.name,
              status: 'warn',
              message: 'Version policy set to "Use specific" but no version selected. Will use newest.',
            });
          } else {
            validationResults.push({
              moduleName: mod.name,
              status: 'pass',
              message: policy?.useNewest
                ? `Will use newest version (${getVersionPrimaryLabel(versions[0])})`
                : (() => {
                    const pinned = versions.find(v => v.id === policy?.pinnedVersionId);
                    return pinned
                      ? `Pinned to ${getVersionPrimaryLabel(pinned)}`
                      : 'Pinned to unknown version';
                  })(),
            });
          }
        }
      }

      setPublishValidationResults(validationResults);

      // Step 2: Create a checkpoint
      const checkpointResult = await api.post<{ id: string; version_number: number; display_name: string }>(
        `/api/apps/${currentApp.id}/checkpoints`,
        {
          change_summary: `Published from editor`,
          // Include module references in checkpoint metadata (FF4-APP-010)
          module_references: moduleReferences as Record<string, unknown>[],
        }
      );
      console.log(`[AppEditor] handlePublishApp() — checkpoint: ${checkpointResult.id} (v${checkpointResult.version_number})`);

      // Step 3: Publish the checkpoint version
      const publishResult = await api.post<{ version_id: string; version_number: number; display_name: string; device_count: number }>(
        `/api/apps/${currentApp.id}/versions/${checkpointResult.id}/publish`,
        {
          // Send module reference policies so the published version stores both
          // policy and resolved version IDs (FF4-APP-010)
          module_references: moduleReferences as Record<string, unknown>[],
        }
      );
      console.log(`[AppEditor] handlePublishApp() — published v${publishResult.version_number} to ${publishResult.device_count} devices`);

      // Show device status (FF4-APP-017)
      setDeviceStatus({
        total: publishResult.device_count,
        updated: publishResult.device_count,
        pending: 0,
      });

      setPublishResult({
        type: 'success',
        text: `Published ${getVersionPrimaryLabel(publishResult)} (${publishResult.device_count} device${publishResult.device_count === 1 ? '' : 's'})`,
      });

      setLiveVersionDisplay(getVersionPrimaryLabel(publishResult));

      // Refresh versions list
      try {
        const versionsResponse = await api.get<{ items: AppVersion[] }>(`/api/apps/${currentApp.id}/versions`);
        setAppVersions(versionsResponse.items || []);
      } catch {
        // Non-critical
      }
    } catch (err) {
      console.error('[AppEditor] handlePublishApp() — error:', err);
      setPublishResult({
        type: 'error',
        text: err instanceof Error ? err.message : 'Publish failed',
      });
      // Show error validation
      setPublishValidationResults(prev => prev ? [
        ...prev,
        { moduleName: 'Publish', status: 'error', message: err instanceof Error ? err.message : 'Publish failed' },
      ] : []);
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenVersionHistory = async () => {
    if (!currentAppId) return;
    console.log('[AppEditor] handleOpenVersionHistory() — app:', currentAppId);
    setShowVersionHistory(true);
    setLoadingVersions(true);
    try {
      const response = await api.get<{ items: AppVersion[] }>(`/api/apps/${currentAppId}/versions`);
      setAppVersions(response.items || []);
    } catch {
      setAppVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  // ── Restore to draft (FF4-APP-026) ─────────────────────────────────
  const [restoring, setRestoring] = useState(false);
  const handleRestoreVersion = async (versionId: string) => {
    if (!currentAppId) return;
    setRestoring(true);
    try {
      const result = await api.post<{ success: boolean; message: string }>(
        `/api/apps/${currentAppId}/versions/${versionId}/restore-to-draft`,
        {}
      );
      showMsg('success', result.message || 'Version restored to draft. Review and publish again.');
      setShowVersionHistory(false);
      // Reload app draft
      const appResponse = await api.get<Record<string, unknown>>(`/api/apps/${currentAppId}`);
      if (appResponse) {
        const draftData = await api.get<Record<string, unknown>>(`/api/apps/${currentAppId}/draft`);
        if (draftData && draftData.config_json) {
          updateApp(currentAppId, draftData.config_json as Partial<App>);
        }
      }
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Failed to restore version');
    } finally {
      setRestoring(false);
    }
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

  const launchpadModules = useMemo(
    () => availableModules.filter(
      module => !currentApp?.bottom_bar_config.some(
        s => s.module_instance_id === module.module_instance_id,
      ),
    ),
    [availableModules, currentApp?.bottom_bar_config],
  );

  const previewModuleReferences = useMemo(
    () => Object.entries(versionPolicies).map(([modId, policy]) => ({
      moduleId: modId,
      policy: policy.useNewest ? 'use_newest' as const : 'specific_version' as const,
      selectedModuleVersionId: policy.pinnedVersionId,
    })),
    [versionPolicies],
  );

  useEffect(() => {
    if (!selectedModuleId || !currentApp) {
      setModulePreviewScreen(null);
      setModulePreviewLoading(false);
      return;
    }

    let cancelled = false;
    setModulePreviewLoading(true);

    const slot = currentApp.bottom_bar_config.find(s => s.module_instance_id === selectedModuleId);
    const launchpadMod = launchpadModules.find(m => m.module_instance_id === selectedModuleId);
    const moduleType = slot?.module_type ?? launchpadMod?.module_type;

    void resolveModuleScreenForApp(selectedModuleId, moduleType, previewModuleReferences)
      .then((screen) => {
        if (!cancelled) {
          setModulePreviewScreen(screen);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModulePreviewScreen(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setModulePreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModuleId, currentApp, launchpadModules, previewModuleReferences]);

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
              <span className="flex items-center">{renderAppIcon(currentApp.icon, 18)}</span>
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
                    <span className="flex items-center">{renderAppIcon(app.icon, 18)}</span>
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
          {/* Autosave status (FF4-APP-006) */}
          {autosaveStatus === 'saving' && (
            <span className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-50 text-blue-700 rounded font-medium">
              <Clock size={10} className="animate-pulse" />
              Saving...
            </span>
          )}
          {autosaveStatus === 'saved' && lastSavedTime && (
            <span
              data-testid="autosave-status"
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-green-50 text-green-700 rounded font-medium"
            >
              <CheckCircle size={10} />
              Saved {lastSavedTime}
            </span>
          )}
          {autosaveStatus === 'failed' && (
            <span className="flex items-center gap-1 px-2 py-1 text-[11px] bg-red-50 text-red-700 rounded font-medium">
              <AlertTriangle size={10} />
              Save failed
            </span>
          )}

          {message && (
            <span className={`text-xs px-3 py-1 rounded ${
              message.type === 'success' ? 'bg-green-50 text-green-700'
              : message.type === 'info' ? 'bg-blue-50 text-blue-700'
              : 'bg-red-50 text-red-700'
            }`}>{message.text}</span>
          )}

          {/* Live version indicator */}
          {liveVersionDisplay ? (
            <span className="flex items-center gap-1 px-2 py-1 text-[11px] bg-green-100 text-green-700 rounded-full font-medium">
              <Rocket size={10} />
              Live: {liveVersionDisplay}
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 text-gray-500 rounded-full font-medium">
              <Clock size={10} />
              No live version
            </span>
          )}

          <button
            onClick={() => setShowPreviewPicker(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Eye size={14} />
            Preview
          </button>

          <button
            onClick={() => setShowPublishModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Rocket size={14} />
            Publish to Mobile
          </button>

          <button
            onClick={handleOpenVersionHistory}
            data-testid="btn-version-history"
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Version History"
          >
            <History size={14} />
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
        {/* Left Sidebar - Bottom Bar Config + Version Resolution */}
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

          {/* Module version resolution for bottom bar modules (FF4-APP-007,008,009) */}
          {currentApp.bottom_bar_config.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Module Version Resolution</h4>
              <div className="space-y-3">
                {currentApp.bottom_bar_config
                  .sort((a, b) => a.slot_position - b.slot_position)
                  .map((slot) => {
                    const policy = versionPolicies[slot.module_instance_id];
                    const versions = moduleVersions[slot.module_instance_id] || [];
                    const pinnedVersion = policy?.pinnedVersionId
                      ? versions.find(v => v.id === policy.pinnedVersionId)
                      : null;
                    if (!policy) return null;
                    return (
                      <div key={slot.module_instance_id} className="text-[11px] bg-gray-50 rounded-lg p-2 space-y-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="flex items-center">{renderAppIcon(slot.icon, 16)}</span>
                          <span className="text-xs font-medium text-gray-800 truncate">{slot.name}</span>
                          <span className="text-[9px] text-gray-400 ml-auto">Slot {slot.slot_position + 1}</span>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`version-bb-${slot.module_instance_id}`}
                            checked={policy.useNewest}
                            onChange={() => handleVersionPolicyChange(slot.module_instance_id, true)}
                            className="w-3 h-3"
                          />
                          <span className="text-gray-600">Use newest</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`version-bb-${slot.module_instance_id}`}
                            checked={!policy.useNewest}
                            onChange={() => handleVersionPolicyChange(slot.module_instance_id, false)}
                            className="w-3 h-3"
                          />
                          <span className="text-gray-600">Use specific</span>
                        </label>
                        {!policy.useNewest && (
                          <div className="mt-1 ml-3">
                            <select
                              value={policy.pinnedVersionId || ''}
                              onChange={(e) => handlePinnedVersionChange(slot.module_instance_id, e.target.value)}
                              className="w-full text-[11px] px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                            >
                              <option value="">Select a version...</option>
                              {versions.map(v => (
                                <option key={v.id} value={v.id}>
                                  {formatVersionOptionLabel(v)}
                                </option>
                              ))}
                            </select>
                            {pinnedVersion && (
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Pinned: {getVersionPrimaryLabel(pinnedVersion)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Center - iPhone Mockup */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-8 overflow-auto">
          {currentApp.bottom_bar_config.length === 0 && launchpadModules.length === 0 ? (
            <div className="w-[375px] h-[812px] bg-white rounded-[3rem] shadow-2xl border-8 border-gray-900 overflow-hidden flex flex-col items-center justify-center text-center text-gray-400 px-6">
              <Smartphone size={36} className="mx-auto mb-2 opacity-50" />
              {availableModules.length === 0 ? (
                <>
                  <p className="text-xs">No module instances yet</p>
                  <p className="text-[10px] text-gray-300 mt-1">
                    Install a module from{' '}
                    <Link to="/templates" className="text-blue-500 hover:underline">
                      Templates
                    </Link>{' '}
                    to populate the launchpad
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs">No modules configured</p>
                  <p className="text-[10px] text-gray-300 mt-1">Add modules from the right sidebar</p>
                </>
              )}
            </div>
          ) : (
            <AppPhoneShell
              darkMode={currentApp.dark_mode}
              bottomBar={[...currentApp.bottom_bar_config]
                .sort((a, b) => a.slot_position - b.slot_position)
                .map(slot => ({
                  ...slot,
                  icon: moduleIconOverrides[slot.module_instance_id] || slot.icon,
                }))}
              launchpadModules={launchpadModules.map(mod => ({
                module_instance_id: mod.module_instance_id,
                module_type: mod.module_type,
                name: mod.name,
                icon: getModuleEffectiveIcon(mod.module_instance_id, mod.module_type, mod.icon),
              }))}
              activeModuleId={selectedModuleId}
              onSelectModule={setSelectedModule}
              resolveIcon={(moduleId, fallback) => {
                const slot = currentApp.bottom_bar_config.find(s => s.module_instance_id === moduleId);
                if (slot) {
                  return moduleIconOverrides[moduleId] || slot.icon;
                }
                const mod = launchpadModules.find(m => m.module_instance_id === moduleId);
                if (mod) {
                  return getModuleEffectiveIcon(mod.module_instance_id, mod.module_type, mod.icon);
                }
                return fallback;
              }}
            >
              {modulePreviewLoading ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Loading module preview...
                </div>
              ) : modulePreviewScreen ? (
                <SDUIPreview json={modulePreviewScreen as never} embedded className="h-full" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm px-6 text-center">
                  No SDUI content resolved for this module yet
                </div>
              )}
            </AppPhoneShell>
          )}
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
              <div className="space-y-3">
                {launchpadModules.map(module => {
                  const policy = versionPolicies[module.module_instance_id];
                  const versions = moduleVersions[module.module_instance_id] || [];
                  const pinnedVersion = policy?.pinnedVersionId
                    ? versions.find(v => v.id === policy.pinnedVersionId)
                    : null;
                  const moduleArchiveWarning = archivedModuleWarnings[module.module_instance_id];
                  return (
                    <div key={module.module_instance_id} className="space-y-1">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                        <div className="relative group shrink-0 flex items-center">
                          {editingModuleIcon === module.module_instance_id ? (
                            <div className="w-32" onClick={e => e.stopPropagation()}>
                              <IconPicker
                                value={getModuleEffectiveIcon(module.module_instance_id, module.module_type, module.icon)}
                                onChange={(newIcon) => {
                                  if (newIcon) {
                                    handleModuleIconChange(module.module_instance_id, newIcon);
                                  }
                                  setEditingModuleIcon(null);
                                }}
                              />
                            </div>
                          ) : (
                            <>
                              <span className="flex h-5 w-5 items-center justify-center">
                                {renderAppIcon(
                                  getModuleEffectiveIcon(module.module_instance_id, module.module_type, module.icon),
                                  16,
                                )}
                              </span>
                              <button
                                data-testid="module-icon-edit"
                                onClick={() => setEditingModuleIcon(module.module_instance_id)}
                                className="ml-0.5 p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Change module icon"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
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
                      {moduleArchiveWarning && (
                        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700 flex items-start gap-1">
                          <AlertOctagon size={10} className="mt-0.5 shrink-0" />
                          <span>{moduleArchiveWarning}</span>
                        </div>
                      )}
                      {/* Module version resolution (FF4-APP-007,008,009) */}
                      {policy && (
                        <div className="px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[11px]">
                          <label className="flex items-center gap-1.5 mb-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`version-${module.module_instance_id}`}
                              checked={policy.useNewest}
                              onChange={() => handleVersionPolicyChange(module.module_instance_id, true)}
                              className="w-3 h-3"
                            />
                            <span className="text-gray-600">Use newest version</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`version-${module.module_instance_id}`}
                              checked={!policy.useNewest}
                              onChange={() => handleVersionPolicyChange(module.module_instance_id, false)}
                              className="w-3 h-3"
                            />
                            <span className="text-gray-600">Use specific version</span>
                          </label>
                          {!policy.useNewest && (
                            <div className="mt-1.5 ml-4">
                              <select
                                value={policy.pinnedVersionId || ''}
                                onChange={(e) => handlePinnedVersionChange(module.module_instance_id, e.target.value)}
                                className="w-full text-[11px] px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                              >
                                <option value="">Select a version...</option>
                                {versions.map(v => (
                                  <option key={v.id} value={v.id}>
                                    {formatVersionOptionLabel(v)}
                                  </option>
                                ))}
                              </select>
                              {pinnedVersion && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  Pinned: {getVersionPrimaryLabel(pinnedVersion)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {launchpadModules.length === 0 && availableModules.length === 0 && (
                  <div
                    className="px-3 py-4 text-center text-xs text-gray-500 border-2 border-dashed border-gray-200 rounded-lg"
                    data-testid="launchpad-empty-no-instances"
                  >
                    <p>No module instances yet.</p>
                    <p className="mt-1">
                      Install a module from{' '}
                      <Link to="/templates" className="text-blue-600 hover:underline">
                        Templates
                      </Link>{' '}
                      to add it to the launchpad.
                    </p>
                  </div>
                )}
                {launchpadModules.length === 0 && availableModules.length > 0 && (
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
                  <IconPicker
                    value={currentApp.icon}
                    onChange={(value) => updateApp(currentApp.id, { icon: value })}
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

            {/* Device errors (FF4-APP-024) */}
            <div data-testid="device-errors-panel">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <AlertOctagon size={14} className="text-red-500" />
                Device Errors
              </h3>
              {loadingDevicePanel ? (
                <p className="text-xs text-gray-400">Loading device status...</p>
              ) : deviceErrors.length === 0 ? (
                <p className="text-xs text-gray-400">No device errors reported</p>
              ) : (
                <div className="space-y-2">
                  {deviceErrors.map((err) => (
                    <div
                      key={err.id}
                      className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-800"
                    >
                      <div className="font-medium">{err.device_name || 'Unknown device'}</div>
                      <div className="mt-0.5">{err.error_message}</div>
                      {err.error_details?.unsupported_type ? (
                        <div className="mt-1 text-red-600">
                          Unsupported: {String(err.error_details.unsupported_type)}
                          {err.error_details.installed_runtime ? (
                            <> · Installed runtime: {String(err.error_details.installed_runtime)}</>
                          ) : null}
                          {err.error_details.required_runtime ? (
                            <> · Required runtime: {String(err.error_details.required_runtime)}</>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Picker Modal */}
      {showPreviewPicker && currentApp && (
        <PreviewPicker
          appId={currentApp.id}
          onSelectBrowser={handlePreviewBrowser}
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

      {/* Publish Modal — Expanded (FF4-APP-011, FF4-APP-017, FF4-VER-006, FF4-VER-007) */}
      {showPublishModal && currentApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-[540px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Rocket size={14} />
                Publish App — {currentApp.name}
              </h3>
              <button onClick={() => { setShowPublishModal(false); setPublishResult(null); setPublishValidationResults(null); setDeviceStatus(null); }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-4">
              {/* App Info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">App</span>
                  <span className="font-medium text-gray-800">{currentApp.icon} {currentApp.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Version</span>
                  <span className="font-medium text-gray-800">
                    {new Date().toLocaleString('en-US', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Bottom bar modules</span>
                  <span className="font-medium text-gray-800">{currentApp.bottom_bar_config.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Launchpad modules</span>
                  <span className="font-medium text-gray-800">{launchpadModules.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Current live version</span>
                  <span className="font-medium text-gray-800">{liveVersionDisplay || 'None'}</span>
                </div>
              </div>

              {/* Assigned devices (FF4-APP-011) */}
              <div data-testid="publish-assigned-devices">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Assigned Devices</h4>
                {assignedDevices.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2 bg-gray-50 rounded-lg">
                    No devices assigned to this app
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {assignedDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between px-3 py-1.5 bg-white border border-gray-100 rounded text-xs"
                      >
                        <span className="text-gray-800 font-medium">{device.device_name}</span>
                        <span className="text-gray-400">
                          {device.update_status === 'error' ? 'Error' : 'Assigned'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Module Versions with validation (FF4-APP-011, FF4-VER-006) */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Module Versions</h4>
                <div className="space-y-1.5">
                  {(() => {
                    const allModules = [
                      ...currentApp.bottom_bar_config.map(s => ({
                        id: s.module_instance_id,
                        name: s.name,
                        icon: s.icon,
                        inBottomBar: true,
                      })),
                      ...launchpadModules.map(m => ({
                        id: m.module_instance_id,
                        name: m.name,
                        icon: m.icon,
                        inBottomBar: false,
                      })),
                    ];
                    return allModules.map(mod => {
                      const policy = versionPolicies[mod.id];
                      const versions = moduleVersions[mod.id] || [];
                      const pinnedVersion = policy?.pinnedVersionId
                        ? versions.find(v => v.id === policy.pinnedVersionId)
                        : null;
                      const versionLabel = policy?.useNewest
                        ? (versions.length > 0 ? `Newest (${getVersionPrimaryLabel(versions[0])})` : 'No versions')
                        : pinnedVersion
                          ? `Pinned (${getVersionPrimaryLabel(pinnedVersion)})`
                          : 'Not configured';
                      return (
                        <div key={mod.id} className="flex items-center justify-between px-3 py-1.5 bg-white border border-gray-100 rounded text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{mod.icon}</span>
                            <span className="text-gray-800 font-medium">{mod.name}</span>
                            {mod.inBottomBar && (
                              <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded">Bottom bar</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{versionLabel}</span>
                            {versions.length > 0 ? (
                              <CheckCircle size={12} className="text-green-500" />
                            ) : (
                              <AlertTriangle size={12} className="text-amber-500" />
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Validation results (FF4-VER-007) */}
              {publishValidationResults && publishValidationResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Validation Results</h4>
                  <div className="space-y-1">
                    {publishValidationResults.map((vr, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${
                        vr.status === 'pass' ? 'bg-green-50 text-green-700'
                        : vr.status === 'warn' ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                      }`}>
                        {vr.status === 'pass' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                        <span className="font-medium">{vr.moduleName}:</span>
                        <span>{vr.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Device status after publish */}
              {deviceStatus && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Device Update Status</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-gray-600">{deviceStatus.updated} updated</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-gray-600">{deviceStatus.pending} pending</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-400">/ {deviceStatus.total} total</span>
                    </div>
                  </div>
                </div>
              )}

              {publishResult && (
                <div className={`text-xs px-3 py-2 rounded ${
                  publishResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {publishResult.text}
                </div>
              )}

              <p className="text-xs text-gray-500">
                Publishing will save the current app configuration, create a version checkpoint, and push it live to all assigned mobile devices.
              </p>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => { setShowPublishModal(false); setPublishResult(null); setPublishValidationResults(null); setDeviceStatus(null); }}
                  disabled={publishing}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePublishApp}
                  disabled={publishing}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  <Rocket size={12} />
                  {publishing ? 'Publishing...' : 'Publish to Mobile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionHistory && currentApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-[620px] max-h-[75vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History size={14} />
                {versionDiffMode ? 'Compare Versions' : `Version History — ${currentApp.icon} ${currentApp.name}`}
              </h3>
              <div className="flex items-center gap-2">
                {versionDiffMode ? (
                  <button onClick={() => { setVersionDiffMode(false); setVersionDiffA(null); setVersionDiffB(null); }} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                    Exit Compare
                  </button>
                ) : appVersions.length >= 2 ? (
                  <button onClick={() => setVersionDiffMode(true)} className="text-xs text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition-colors">
                    Compare
                  </button>
                ) : null}
                <button onClick={() => setShowVersionHistory(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
            </div>

            {loadingVersions ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading versions...</div>
            ) : appVersions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-sm mb-2">No versions yet</div>
                <div className="text-gray-400 text-xs">Click Publish to create the first version.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {versionDiffMode && (
                  <div className="text-xs text-gray-500 mb-2">
                    {versionDiffA && !versionDiffB
                      ? 'Select another version to compare:'
                      : 'Click a version to select it as the first comparison:'}
                  </div>
                )}
                {flatAppVersionTree.map((node) => {
                  const v = node.version;
                  const isPublished = v.source === 'publish';
                  const isDiffSelectedA = versionDiffA === v.id;
                  const isDiffSelectedB = versionDiffB === v.id;
                  return (
                    <div
                      key={v.id}
                      style={{ marginLeft: `${node.depth * 20}px` }}
                      className={`border rounded-lg overflow-hidden transition-colors ${
                        isDiffSelectedA ? 'border-purple-400 bg-purple-50/30'
                        : isDiffSelectedB ? 'border-purple-600 bg-purple-100/30'
                        : versionDiffMode ? 'border-gray-200 cursor-pointer hover:border-purple-300'
                        : isPublished ? 'border-green-200' : 'border-gray-200'
                      } ${node.depth > 0 ? 'border-l-2 border-l-gray-300' : ''}`}
                      onClick={() => {
                        if (versionDiffMode) {
                          if (!versionDiffA) {
                            setVersionDiffA(v.id);
                          } else if (!versionDiffB && versionDiffA !== v.id) {
                            setVersionDiffB(v.id);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {versionDiffMode && (
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold ${
                                isDiffSelectedA ? 'border-purple-500 bg-purple-500 text-white'
                                : isDiffSelectedB ? 'border-purple-600 bg-purple-600 text-white'
                                : 'border-gray-300'
                              }`}>
                                {isDiffSelectedA ? 'A' : isDiffSelectedB ? 'B' : ''}
                              </span>
                            )}
                            {node.depth > 0 && !versionDiffMode && (
                              <CornerDownRight size={12} className="text-gray-300 shrink-0" />
                            )}
                            <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                              {getVersionPrimaryLabel(v)}
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-normal">
                                v{v.version_number}
                              </span>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                              isPublished
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {isPublished ? 'Live' : v.source}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {new Date(v.created_at).toLocaleString()}
                            {v.change_summary && (
                              <span className="ml-2 text-gray-500">— {v.change_summary}</span>
                            )}
                          </div>
                        </div>
                        {/* Restore to Draft button (FF4-APP-026) */}
                        {!versionDiffMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreVersion(v.id);
                            }}
                            disabled={restoring}
                            className="ml-2 shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors disabled:opacity-50"
                            title="Restore this version to working draft (does not auto-publish)"
                          >
                            <RotateCcw size={10} />
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Diff result summary */}
            {versionDiffA && versionDiffB && versionDiffMode && (
              <div className="mt-4 border border-purple-200 bg-purple-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-purple-800 mb-2">Selected Versions</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white rounded p-2 border border-purple-100">
                    <div className="font-medium text-gray-700">A: {appVersions.find(v => v.id === versionDiffA)?.display_name}</div>
                    <div className="text-gray-500 mt-1">{appVersions.find(v => v.id === versionDiffA)?.source}</div>
                  </div>
                  <div className="bg-white rounded p-2 border border-purple-100">
                    <div className="font-medium text-gray-700">B: {appVersions.find(v => v.id === versionDiffB)?.display_name}</div>
                    <div className="text-gray-500 mt-1">{appVersions.find(v => v.id === versionDiffB)?.source}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
