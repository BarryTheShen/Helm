import { api } from './api';

export interface ModuleVersionPolicyRef {
  moduleId: string;
  policy: 'use_newest' | 'specific_version';
  selectedModuleVersionId?: string | null;
  resolvedModuleVersionId?: string | null;
}

type SduiScreen = Record<string, unknown>;

/**
 * Resolve module SDUI JSON for app preview (FF4-APP-014).
 * Uses newest checkpoint/version, then working draft, then legacy live screen.
 */
export async function resolveModuleScreen(
  moduleInstanceId: string,
  moduleType: string | undefined,
  policy: ModuleVersionPolicyRef | undefined,
): Promise<SduiScreen | null> {
  const pinnedId = policy?.policy === 'specific_version'
    ? (policy.selectedModuleVersionId || policy.resolvedModuleVersionId)
    : null;

  try {
    if (pinnedId) {
      const detail = await api.get<{ sdui_json?: SduiScreen }>(
        `/api/modules/${moduleInstanceId}/versions/${pinnedId}`,
      );
      if (detail.sdui_json) return detail.sdui_json;
    }

    const versions = await api.get<{ items: Array<{ id: string }> }>(
      `/api/modules/${moduleInstanceId}/versions?limit=1`,
    );
    const newestId = versions.items?.[0]?.id;
    if (newestId) {
      const detail = await api.get<{ sdui_json?: SduiScreen }>(
        `/api/modules/${moduleInstanceId}/versions/${newestId}`,
      );
      if (detail.sdui_json) return detail.sdui_json;
    }

    const draft = await api.get<{ sdui_json?: SduiScreen }>(
      `/api/modules/${moduleInstanceId}/draft`,
    );
    if (draft.sdui_json) return draft.sdui_json;
  } catch {
    // Fall through to legacy SDUI path
  }

  const legacyKey = moduleType || moduleInstanceId;
  try {
    const legacy = await api.get<{ screen?: SduiScreen; state_json?: SduiScreen }>(
      `/api/sdui/${legacyKey}`,
    );
    return legacy.screen || legacy.state_json || null;
  } catch {
    return null;
  }
}

export function collectModuleIdsFromAppConfig(config: {
  bottom_bar_config?: Array<{ module_instance_id?: string }>;
  launchpad_config?: Array<string | { module_instance_id?: string }>;
}): string[] {
  const ids = new Set<string>();

  for (const slot of config.bottom_bar_config ?? []) {
    if (slot?.module_instance_id) ids.add(slot.module_instance_id);
  }

  for (const item of config.launchpad_config ?? []) {
    if (typeof item === 'string') {
      ids.add(item);
    } else if (item?.module_instance_id) {
      ids.add(item.module_instance_id);
    }
  }

  return [...ids];
}

export interface PreviewBottomBarSlot {
  module_instance_id: string;
  module_type?: string;
  name: string;
  icon: string;
  slot_position?: number;
}

export interface PreviewLaunchpadModule {
  module_instance_id: string;
  module_type?: string;
  name: string;
  icon: string;
}

export interface PreviewAppConfigInput {
  bottom_bar_config?: PreviewBottomBarSlot[];
  launchpad_config?: Array<
    string | PreviewLaunchpadModule | { module_instance_id?: string; name?: string; icon?: string; module_type?: string }
  >;
  moduleReferences?: ModuleVersionPolicyRef[];
  dark_mode?: boolean;
  default_launch_module_instance_id?: string | null;
  default_launch_module_id?: string | null;
}

export interface AppPreviewBundle {
  appConfig: Record<string, unknown>;
  bottomBar: PreviewBottomBarSlot[];
  launchpadModules: PreviewLaunchpadModule[];
  resolvedScreens: Record<string, SduiScreen>;
  resolvedCount: number;
  defaultModuleId: string | null;
  darkMode: boolean;
}

function normalizeLaunchpadModule(
  item: string | PreviewLaunchpadModule | { module_instance_id?: string; name?: string; icon?: string; module_type?: string },
): PreviewLaunchpadModule | null {
  if (typeof item === 'string') {
    return { module_instance_id: item, name: item, icon: '📦' };
  }
  if (!item?.module_instance_id) return null;
  return {
    module_instance_id: item.module_instance_id,
    module_type: item.module_type,
    name: item.name || item.module_instance_id,
    icon: item.icon || '📦',
  };
}

function normalizeBottomBar(
  slots: PreviewBottomBarSlot[] | undefined,
): PreviewBottomBarSlot[] {
  return [...(slots ?? [])].sort(
    (a, b) => (a.slot_position ?? 0) - (b.slot_position ?? 0),
  );
}

function normalizeLaunchpadModules(
  items: PreviewAppConfigInput['launchpad_config'],
  bottomBar: PreviewBottomBarSlot[],
): PreviewLaunchpadModule[] {
  const bottomIds = new Set(bottomBar.map(slot => slot.module_instance_id));
  const modules: PreviewLaunchpadModule[] = [];

  for (const item of items ?? []) {
    const mod = normalizeLaunchpadModule(item);
    if (mod && !bottomIds.has(mod.module_instance_id)) {
      modules.push(mod);
    }
  }

  return modules;
}

/**
 * Resolve full app preview bundle: draft config + module SDUI screens (FF4-APP-014).
 */
export async function resolveAppPreviewBundle(
  appId: string,
  previewConfig?: PreviewAppConfigInput | null,
): Promise<AppPreviewBundle> {
  const draftResponse = await api.get<{ config_json: Record<string, unknown> }>(
    `/api/apps/${appId}/draft`,
  );
  const draftConfig = draftResponse.config_json ?? {};

  const bottomBar = normalizeBottomBar(
    (previewConfig?.bottom_bar_config
      ?? draftConfig.bottom_bar_config
      ?? []) as PreviewBottomBarSlot[],
  );
  const launchpadModules = normalizeLaunchpadModules(
    previewConfig?.launchpad_config ?? draftConfig.launchpad_config as PreviewAppConfigInput['launchpad_config'],
    bottomBar,
  );

  const appConfig: Record<string, unknown> = {
    ...draftConfig,
    bottom_bar_config: bottomBar,
    launchpad_config: launchpadModules,
    dark_mode: previewConfig?.dark_mode ?? draftConfig.dark_mode ?? false,
  };

  const policies = previewConfig?.moduleReferences ?? [];
  const policyByModule = new Map<string, ModuleVersionPolicyRef>();
  for (const ref of policies) {
    policyByModule.set(ref.moduleId, ref);
  }

  const moduleIds = collectModuleIdsFromAppConfig({
    bottom_bar_config: bottomBar,
    launchpad_config: launchpadModules,
  });

  const resolvedScreens: Record<string, SduiScreen> = {};
  let resolvedCount = 0;

  await Promise.all(
    moduleIds.map(async (moduleInstanceId) => {
      const slot = bottomBar.find(s => s.module_instance_id === moduleInstanceId)
        ?? launchpadModules.find(m => m.module_instance_id === moduleInstanceId);
      const screen = await resolveModuleScreen(
        moduleInstanceId,
        slot?.module_type,
        policyByModule.get(moduleInstanceId),
      );
      if (screen) {
        resolvedScreens[moduleInstanceId] = screen;
        resolvedCount += 1;
      }
    }),
  );

  const defaultModule =
    previewConfig?.default_launch_module_instance_id
    ?? (draftConfig.default_launch_module_instance_id as string | undefined)
    ?? previewConfig?.default_launch_module_id
    ?? (draftConfig.default_launch_module_id as string | undefined)
    ?? bottomBar[0]?.module_instance_id
    ?? moduleIds[0]
    ?? null;

  return {
    appConfig,
    bottomBar,
    launchpadModules,
    resolvedScreens,
    resolvedCount,
    defaultModuleId: defaultModule,
    darkMode: Boolean(appConfig.dark_mode),
  };
}

/** Resolve a single module screen using App Editor version policies. */
export async function resolveModuleScreenForApp(
  moduleInstanceId: string,
  moduleType: string | undefined,
  policies: ModuleVersionPolicyRef[] | undefined,
): Promise<SduiScreen | null> {
  const policy = policies?.find(ref => ref.moduleId === moduleInstanceId);
  return resolveModuleScreen(moduleInstanceId, moduleType, policy);
}
