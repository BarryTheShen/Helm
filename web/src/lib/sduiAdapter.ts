// ── Internal Helm cell/row format (what backend stores and mobile renders) ──

interface HelmCell {
  id: string;
  content: {
    type: string;
    props: Record<string, unknown>;
  } | null;
}

interface HelmRow {
  id: string;
  height: string | number;
  cells: HelmCell[];
}

interface HelmScreen {
  rows: HelmRow[];
}

// ── Puck internal format (what the editor uses) ──────────────────────────────

interface PuckContent {
  type: string;
  props: Record<string, unknown> & { id: string };
}

interface PuckData {
  content: PuckContent[];
  root: { props: Record<string, unknown> };
  zones?: Record<string, PuckContent[]>;
}

// ── Type name mappings ───────────────────────────────────────────────────────

// Puck component type → mobile SDUI type.
// Most are the same PascalCase. Only hardcoded composites differ:
// Puck uses short names; mobile registry uses *Module suffix.
const PUCK_TO_MOBILE: Record<string, string> = {
  Calendar: 'CalendarModule',
  Chat: 'ChatModule',
  Notes: 'NotesModule',
  // Text, Button, Image, TextInput, Icon, Divider, Markdown, InputBar → same in both
};

// Mobile SDUI type → Puck component type
const MOBILE_TO_PUCK: Record<string, string> = {
  CalendarModule: 'Calendar',
  ChatModule: 'Chat',
  NotesModule: 'Notes',
};

// Legacy lowercase type → Puck PascalCase (for loading old AI-generated screens)
const LEGACY_TO_PUCK: Record<string, string> = {
  text: 'Text',
  markdown: 'Markdown',
  button: 'Button',
  image: 'Image',
  textinput: 'TextInput',
  icon: 'Icon',
  divider: 'Divider',
  calendar: 'Calendar',
  chat: 'Chat',
  notes: 'Notes',
  inputbar: 'InputBar',
};

function puckTypeToMobile(type: string): string {
  return PUCK_TO_MOBILE[type] ?? type;
}

function anyTypeToPuck(type: string): string {
  // Handles: mobile module names (CalendarModule→Calendar),
  // legacy lowercase (text→Text), or already-correct PascalCase (Text→Text)
  return MOBILE_TO_PUCK[type] ?? LEGACY_TO_PUCK[type] ?? type;
}

// ── Action prop converters ───────────────────────────────────────────────────

function buildActionProp(props: Record<string, unknown>): Record<string, unknown> {
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

function extractActionFields(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...props };
  const action = props.action as Record<string, unknown> | null | undefined;
  if (action && typeof action === 'object') {
    result.actionType = action.type || 'none';
    if (action.type === 'navigate') {
      result.actionTarget = action.target || '';
    } else if (action.type === 'server_action') {
      result.actionTarget = action.function || '';
      if (action.params) result.actionParams = JSON.stringify(action.params);
    } else if (action.type === 'open_url') {
      result.actionTarget = action.url || '';
    } else if (action.type === 'send_to_agent') {
      const p = action.params as Record<string, unknown> | undefined;
      result.actionTarget = p?.message || '';
    }
    delete result.action;
  } else {
    result.actionType = 'none';
    result.actionTarget = '';
    result.actionParams = '';
  }
  return result;
}

// ── ID generator ─────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(): string {
  return `helm-${++_idCounter}`;
}

// ── puckToHelm ───────────────────────────────────────────────────────────────
/**
 * Convert Puck editor output → Helm SDUI format (stored in backend, rendered by mobile).
 *
 * Output format matches mobile's SDUIRow/SDUICell interfaces:
 *   rows[].cells[].content.type  → PascalCase, mobile registry keys
 *   rows[].cells[].content.props → component props
 */
export function puckToHelm(puckData: PuckData): HelmScreen {
  const items = puckData.content || [];
  const zones = puckData.zones || {};
  const rows: HelmRow[] = [];
  let rowIdx = 0;

  for (const item of items) {
    if (item.type === 'Row') {
      const rowId = item.props.id as string;
      const height = (item.props.height as string) || 'auto';

      // Slot format: cells inline in props (Puck v0.21+ with slot fields)
      const slotCells = Array.isArray(item.props.cells)
        ? (item.props.cells as PuckContent[])
        : [];
      // Zone format fallback (legacy Puck DropZone format)
      const zoneKey = `${rowId}:cells`;
      const zoneCells = (zones[zoneKey] || []) as PuckContent[];
      const rowCells = slotCells.length > 0 ? slotCells : zoneCells;

      let cellIdx = 0;
      const cells: HelmCell[] = rowCells.map((zoneItem) => {
        const { id: _id, ...rawProps } = zoneItem.props;
        const mobileType = puckTypeToMobile(zoneItem.type);
        const props = (zoneItem.type === 'Button') ? buildActionProp(rawProps) : rawProps;
        cellIdx++;
        return {
          id: `${rowId}-cell-${cellIdx}`,
          content: { type: mobileType, props },
        };
      });

      rows.push({ id: `row-${rowIdx++}`, height, cells });
    } else {
      // Non-Row top-level component → wrap in single-cell row
      const { id: _id, ...rawProps } = item.props;
      const mobileType = puckTypeToMobile(item.type);
      const props = (item.type === 'Button') ? buildActionProp(rawProps) : rawProps;
      const rowId = `row-${rowIdx++}`;
      rows.push({
        id: rowId,
        height: 'auto',
        cells: [{
          id: `${rowId}-cell-1`,
          content: { type: mobileType, props },
        }],
      });
    }
  }

  return { rows };
}

// ── helmToPuck ───────────────────────────────────────────────────────────────
/**
 * Convert Helm SDUI (from backend) → Puck editor format for loading into editor.
 *
 * Handles three input formats:
 *   1. New format: rows[].cells[].content (PascalCase types including CalendarModule)
 *   2. Old format: rows[].cells[].component (lowercase types, saved by old editor)
 *   3. V1 format: sections[].components[] (AI-generated legacy screens)
 */
export function helmToPuck(helmScreen: any): PuckData {
  _idCounter = 0;
  const content: PuckContent[] = [];

  // V2: rows format
  if (helmScreen?.rows && Array.isArray(helmScreen.rows)) {
    for (const row of helmScreen.rows) {
      const rowId = nextId();
      const rowHeight = row.height ?? 'auto';
      const zoneChildren: PuckContent[] = [];

      for (const cell of row.cells || []) {
        // Support new `content` key and old `component` key
        const cellComp = cell.content ?? cell.component;
        if (!cellComp?.type) continue;

        const puckType = anyTypeToPuck(cellComp.type);
        const rawProps = cellComp.props || {};
        const props = (puckType === 'Button') ? extractActionFields(rawProps) : rawProps;
        zoneChildren.push({
          type: puckType,
          props: { id: nextId(), ...props },
        });
      }

      content.push({
        type: 'Row',
        props: { id: rowId, height: String(rowHeight), cells: zoneChildren },
      });
    }
    return { content, root: { props: {} }, zones: {} };
  }

  // V1: sections format (old AI-generated screens with sections/components)
  if (helmScreen?.sections && Array.isArray(helmScreen.sections)) {
    for (const section of helmScreen.sections) {
      const comps = section.components ?? (section.component ? [section.component] : []);
      if (!comps.length) continue;

      const sectionCells: PuckContent[] = [];
      for (const comp of comps) {
        if (!comp?.type) continue;
        const puckType = anyTypeToPuck(comp.type);
        const rawProps = comp.props || {};
        const props = (puckType === 'Button') ? extractActionFields(rawProps) : rawProps;
        sectionCells.push({
          type: puckType,
          props: { id: nextId(), ...props },
        });
      }

      const rowId = nextId();
      content.push({
        type: 'Row',
        props: { id: rowId, height: 'auto', cells: sectionCells },
      });
    }
    return { content, root: { props: {} }, zones: {} };
  }

  return { content: [], root: { props: {} }, zones: {} };
}