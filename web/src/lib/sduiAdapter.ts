// SDUI Adapter — Simplified post-Puck removal
// The editor now works directly with Helm SDUI format.
// This file provides helpers for action prop conversion and legacy format support.

// ── Type name normalization ──────────────────────────────────────────────────

// Short names (used by some old Puck-era data) → mobile registry names
const LEGACY_TYPE_MAP: Record<string, string> = {
  Calendar: 'CalendarModule',
  Chat: 'ChatModule',
  Notes: 'NotesModule',
  calendar: 'CalendarModule',
  chat: 'ChatModule',
  notes: 'NotesModule',
  text: 'Text',
  markdown: 'Markdown',
  button: 'Button',
  image: 'Image',
  textinput: 'TextInput',
  icon: 'Icon',
  divider: 'Divider',
  inputbar: 'InputBar',
};

export function normalizeTypeName(type: string): string {
  return LEGACY_TYPE_MAP[type] ?? type;
}

// ── Action prop helpers ──────────────────────────────────────────────────────

/**
 * Build nested action prop from flat fields (legacy Puck format → Helm format).
 * Used when loading screens that were saved with the old Puck editor.
 */
export function buildActionProp(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(props)) {
    if (key === 'actionType' || key === 'actionTarget' || key === 'actionParams') continue;
    result[key] = val;
  }
  const actionType = props.actionType as string;
  if (actionType && actionType !== 'none') {
    const action: Record<string, unknown> = { type: actionType };
    const target = props.actionTarget as string;
    const paramsStr = props.actionParams as string;
    if (actionType === 'navigate' && target) {
      action.target = target;
      action.transition = 'push';
    } else if (actionType === 'server_action' && target) {
      action.function = target;
      if (paramsStr) {
        try { action.params = JSON.parse(paramsStr); } catch { /* ignore */ }
      }
    } else if (actionType === 'open_url' && target) {
      action.url = target;
    } else if (actionType === 'send_to_agent' && target) {
      action.function = 'send_to_agent';
      action.params = { message: target };
    }
    result.action = action;
  }
  return result;
}

/**
 * Normalize a screen loaded from the backend.
 * Handles legacy formats (flat action fields, old type names, v1 sections format).
 */
export function normalizeScreen(screen: any): { rows: any[] } | null {
  if (!screen) return null;

  // Current format: { rows: [...] }
  if (screen.rows && Array.isArray(screen.rows)) {
    return {
      rows: screen.rows.map((row: any) => ({
        ...row,
        cells: (row.cells || []).map((cell: any) => {
          const comp = cell.content ?? cell.component;
          if (!comp?.type) return { ...cell, content: null };
          const type = normalizeTypeName(comp.type);
          let props = comp.props || {};
          // Convert flat action fields to nested if present (legacy Puck format)
          if (props.actionType && props.actionType !== 'none') {
            props = buildActionProp(props);
          }
          return { ...cell, content: { type, props } };
        }),
      })),
    };
  }

  // V1 format: { sections: [{ components: [...] }] }
  if (screen.sections && Array.isArray(screen.sections)) {
    const rows = screen.sections.map((section: any, i: number) => {
      const comps = section.components ?? (section.component ? [section.component] : []);
      return {
        id: `row-${i}`,
        height: 'auto',
        cells: comps.filter((c: any) => c?.type).map((comp: any, j: number) => {
          const type = normalizeTypeName(comp.type);
          let props = comp.props || {};
          if (props.actionType && props.actionType !== 'none') {
            props = buildActionProp(props);
          }
          return {
            id: `cell-${i}-${j}`,
            width: 1,
            content: { type, props },
          };
        }),
      };
    });
    return { rows };
  }

  return null;
}