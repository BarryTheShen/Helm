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
