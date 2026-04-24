import { create } from 'zustand';

import { getDefaultProps } from './componentSchemas';
import {
  DEVICE_PRESETS,
  cloneEditorComponent,
  createEditorId,
  getActionPropName,
  normalizeComponentForEditor,
  serializeComponentForRuntime,
} from './types';
import type {
  ClipboardItem,
  EditorCell,
  EditorComponent,
  EditorRow,
  EditorRowHeight,
  EditorScreen,
  Selection as EditorSelection,
  ActionRule,
} from './types';

const HISTORY_LIMIT = 50;
const MIN_CELL_WIDTH_PERCENT = 5; // Minimum 5% width per cell
const DEFAULT_DEVICE = DEVICE_PRESETS[1] ?? {
  name: 'Default',
  width: 390,
  height: 844,
  icon: 'device',
  category: 'phone' as const,
};

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type EditorStoreState = {
  rows: EditorRow[];
  selection: EditorSelection | null;
  history: EditorScreen[];
  historyIndex: number;
  deviceWidth: number;
  deviceHeight: number;
  isLandscape: boolean;
  loadScreen: (screen: EditorScreen | null | undefined) => void;
  applyScreen: (screen: EditorScreen | null | undefined) => void;
  getScreen: () => EditorScreen;
  undo: () => void;
  redo: () => void;
  setDevice: (width: number, height: number) => void;
  toggleLandscape: () => void;
  setSelection: (selection: EditorSelection | null) => void;
  addRow: (cellCount?: number, index?: number, props?: Partial<EditorRow>) => void;
  deleteRow: (rowId: string) => void;
  duplicateRow: (rowId: string) => void;
  moveRow: (fromIndex: number, toIndex: number) => void;
  setComponent: (rowId: string, cellIndex: number, componentType: string) => void;
  removeComponent: (rowId: string, cellIndex: number) => void;
  copySelection: () => void;
  updateAdjacentCellWidths: (rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => void;
  updateRowHeight: (rowId: string, height: EditorRowHeight) => void;
  updateRowProps: (rowId: string, patch: Partial<EditorRow>) => void;
  setCellCount: (rowId: string, count: number) => void;
  moveCellInRow: (rowId: string, fromIndex: number, toIndex: number) => void;
  updateCellWidth: (rowId: string, cellIndex: number, width: EditorCell['width']) => void;
  updateComponentProps: (rowId: string, cellIndex: number, props: Record<string, unknown>) => void;
  updateCellRules: (rowId: string, cellIndex: number, rules: ActionRule[]) => void;
  screenSnapshot: EditorScreen;
  clipboard: ClipboardItem | null;
};

type CommitOptions = {
  selection?: EditorSelection | null;
  clipboard?: ClipboardItem | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createEmptyScreenSnapshot(): EditorScreen {
  return { rows: [] };
}

function cloneScreen(screen: EditorScreen): EditorScreen {
  return cloneValue(screen);
}

function normalizeRowHeight(value: unknown): EditorRowHeight {
  if (value === 'auto') {
    return 'auto';
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'auto') {
      return 'auto';
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 'auto';
}

function normalizeCellWidth(value: unknown): EditorCell['width'] {
  if (value === 'auto') {
    return 'auto';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'auto') {
      return 'auto';
    }

    // Handle percentage strings like "50%"
    if (trimmed.endsWith('%')) {
      const parsed = parseFloat(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) {
        return trimmed; // Return the percentage string as-is
      }
    }

    // Handle numeric strings
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  return 'auto'; // Default to 'auto' instead of 1
}

function createEmptyCell(): EditorCell {
  return {
    id: createEditorId('cell'),
    width: 'auto',
    content: null,
  };
}

function validateCellWidths(cells: EditorCell[]): boolean {
  let totalSetWidth = 0;
  let autoCount = 0;

  for (const cell of cells) {
    if (typeof cell.width === 'string' && cell.width.endsWith('%')) {
      const percent = parseFloat(cell.width);
      if (isNaN(percent) || percent < MIN_CELL_WIDTH_PERCENT) {
        return false;
      }
      totalSetWidth += percent;
    } else if (cell.width === 'auto') {
      autoCount++;
    }
  }

  // Rule 1: Total set widths must be < 100%
  if (totalSetWidth >= 100) {
    return false;
  }

  // Rule 2: Auto cells must have enough space (at least MIN_CELL_WIDTH_PERCENT each)
  if (autoCount > 0) {
    const availableWidth = 100 - totalSetWidth;
    const autoWidth = availableWidth / autoCount;
    if (autoWidth < MIN_CELL_WIDTH_PERCENT) {
      return false;
    }
  }

  return true;
}

function createEmptyRow(cellCount = 1): EditorRow {
  const normalizedCount = Math.max(1, Math.trunc(cellCount) || 1);

  return {
    id: createEditorId('row'),
    height: 'auto',
    cells: Array.from({ length: normalizedCount }, () => createEmptyCell()),
  };
}

function getCanonicalRowBackgroundColor(record: Record<string, unknown>): string | undefined {
  if (Object.prototype.hasOwnProperty.call(record, 'backgroundColor') && typeof record.backgroundColor === 'string') {
    return record.backgroundColor;
  }

  if (Object.prototype.hasOwnProperty.call(record, 'bgColor') && typeof record.bgColor === 'string') {
    return record.bgColor;
  }

  return undefined;
}

function normalizeCell(value: unknown): EditorCell {
  const record = isRecord(value) ? cloneValue(value as Record<string, unknown>) : {};
  const rawContent = record.content ?? record.component ?? null;
  const { component: _component, content: _content, id, width, ...rest } = record;

  return {
    ...rest,
    id: typeof id === 'string' && id.length > 0 ? id : createEditorId('cell'),
    width: normalizeCellWidth(width),
    content: normalizeComponentForEditor(rawContent),
  };
}

function normalizeRow(value: unknown): EditorRow {
  const record = isRecord(value) ? cloneValue(value as Record<string, unknown>) : {};
  const rawCells = Array.isArray(record.cells) ? record.cells : [];
  const normalizedCells = rawCells.map((cell) => normalizeCell(cell));
  const { bgColor: _bgColor, backgroundColor: _backgroundColor, cells: _cells, id, height, ...rest } = record;
  const backgroundColor = getCanonicalRowBackgroundColor(record);

  return {
    ...rest,
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    id: typeof id === 'string' && id.length > 0 ? id : createEditorId('row'),
    height: normalizeRowHeight(height),
    cells: normalizedCells.length > 0 ? normalizedCells : [createEmptyCell()],
  };
}

function serializeCellForRuntime(cell: EditorCell): EditorCell {
  const clonedCell = cloneValue(cell);
  const serializedContent = cell.content ? serializeComponentForRuntime(cell.content) : null;

  // Inject rules as the component's action prop for mobile runtime.
  // Rules in the editor's RuleBuilder are the visual representation of the
  // component's onPress/onSubmit action. Serialize them into the standard
  // action prop format so the mobile renderer can execute them.
  if (serializedContent && Array.isArray(clonedCell.rules) && clonedCell.rules.length > 0) {
    const rules = clonedCell.rules as ActionRule[];
    const actionPropName = getActionPropName(serializedContent.type);
    if (actionPropName) {
      // Use the last rule that has at least one action step
      const activeRule = [...rules].reverse().find(r => r.actions && r.actions.length > 0);
      if (activeRule) {
        const action: Record<string, unknown> = activeRule.actions.length === 1
          ? { type: activeRule.actions[0].type, ...activeRule.actions[0].params }
          : {
              type: 'chain',
              actions: activeRule.actions.map(step => ({ type: step.type, ...step.params })),
            };
        serializedContent.props = { ...serializedContent.props, [actionPropName]: action };
      }
    }
  }

  return {
    ...clonedCell,
    content: serializedContent,
  };
}

function serializeRowForRuntime(row: EditorRow): EditorRow {
  const clonedRow = cloneValue(row);
  const backgroundColor = getCanonicalRowBackgroundColor(clonedRow);
  const { bgColor: _bgColor, backgroundColor: _backgroundColor, cells: _cells, ...rest } = clonedRow;

  return {
    ...rest,
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    cells: row.cells.map((cell) => serializeCellForRuntime(cell)),
  };
}

function buildScreenSnapshot(baseScreen: unknown, rows: EditorRow[]): EditorScreen {
  const baseRecord = isRecord(baseScreen) ? cloneValue(baseScreen as Record<string, unknown>) : {};
  const { rows: _rows, ...screenMeta } = baseRecord;

  return {
    ...screenMeta,
    rows: rows.map((row) => serializeRowForRuntime(row)),
  };
}

function normalizeScreen(screen: EditorScreen | null | undefined): { rows: EditorRow[]; snapshot: EditorScreen } {
  const record = isRecord(screen) ? cloneValue(screen as Record<string, unknown>) : {};
  const rawRows = Array.isArray(record.rows) ? record.rows : [];
  const rows = rawRows.map((row) => normalizeRow(row));

  return {
    rows,
    snapshot: buildScreenSnapshot(record, rows),
  };
}

function cloneRow(row: EditorRow): EditorRow {
  const clonedRow = cloneValue(row);

  return {
    ...clonedRow,
    id: createEditorId('row'),
    cells: row.cells.map((cell) => {
      const clonedCell = cloneValue(cell);

      return {
        ...clonedCell,
        id: createEditorId('cell'),
        content: cell.content ? cloneEditorComponent(cell.content) : null,
      };
    }),
  };
}

function pushHistory(history: EditorScreen[], historyIndex: number, snapshot: EditorScreen): { history: EditorScreen[]; historyIndex: number } {
  const nextHistory = history.slice(0, historyIndex + 1).map((entry) => cloneScreen(entry));
  nextHistory.push(cloneScreen(snapshot));

  if (nextHistory.length > HISTORY_LIMIT) {
    nextHistory.splice(0, nextHistory.length - HISTORY_LIMIT);
  }

  return {
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
  };
}

function commitRows(state: EditorStoreState, rows: EditorRow[], options: CommitOptions = {}) {
  const screenSnapshot = buildScreenSnapshot(state.screenSnapshot, rows);
  const nextHistory = pushHistory(state.history, state.historyIndex, screenSnapshot);

  return {
    rows,
    screenSnapshot,
    history: nextHistory.history,
    historyIndex: nextHistory.historyIndex,
    selection: 'selection' in options ? options.selection ?? null : state.selection,
    clipboard: 'clipboard' in options ? options.clipboard ?? null : state.clipboard,
  };
}

function createComponent(componentType: string): EditorComponent {
  const rawComponent = {
    id: createEditorId(componentType.toLowerCase()),
    type: componentType,
    props: getDefaultProps(componentType),
  };

  return normalizeComponentForEditor(rawComponent) ?? {
    id: rawComponent.id,
    type: componentType,
    props: rawComponent.props,
  };
}

function findRowIndex(rows: EditorRow[], rowId: string): number {
  return rows.findIndex((row) => row.id === rowId);
}

function findCell(rows: EditorRow[], rowId: string, cellIndex: number): EditorCell | null {
  const row = rows.find((entry) => entry.id === rowId);
  if (!row) {
    return null;
  }

  return row.cells[cellIndex] ?? null;
}

const initialScreenSnapshot = createEmptyScreenSnapshot();

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  rows: [],
  selection: null,
  history: [cloneScreen(initialScreenSnapshot)],
  historyIndex: 0,
  deviceWidth: DEFAULT_DEVICE.width,
  deviceHeight: DEFAULT_DEVICE.height,
  isLandscape: false,
  screenSnapshot: cloneScreen(initialScreenSnapshot),
  clipboard: null,

  loadScreen: (screen) => {
    const normalized = normalizeScreen(screen);

    set((state) => ({
      rows: normalized.rows,
      screenSnapshot: normalized.snapshot,
      history: [cloneScreen(normalized.snapshot)],
      historyIndex: 0,
      selection: null,
      clipboard: null,
      deviceWidth: state.deviceWidth,
      deviceHeight: state.deviceHeight,
      isLandscape: state.isLandscape,
    }));
  },

  applyScreen: (screen) => {
    const normalized = normalizeScreen(screen);

    set((state) => {
      const nextHistory = pushHistory(state.history, state.historyIndex, normalized.snapshot);

      return {
        rows: normalized.rows,
        screenSnapshot: normalized.snapshot,
        history: nextHistory.history,
        historyIndex: nextHistory.historyIndex,
        selection: null,
      };
    });
  },

  getScreen: () => cloneScreen(get().screenSnapshot),

  undo: () => {
    set((state) => {
      if (state.historyIndex <= 0) {
        return state;
      }

      const nextHistoryIndex = state.historyIndex - 1;
      const screenSnapshot = cloneScreen(state.history[nextHistoryIndex]);

      return {
        rows: normalizeScreen(screenSnapshot).rows,
        screenSnapshot,
        historyIndex: nextHistoryIndex,
        selection: null,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) {
        return state;
      }

      const nextHistoryIndex = state.historyIndex + 1;
      const screenSnapshot = cloneScreen(state.history[nextHistoryIndex]);

      return {
        rows: normalizeScreen(screenSnapshot).rows,
        screenSnapshot,
        historyIndex: nextHistoryIndex,
        selection: null,
      };
    });
  },

  setDevice: (width, height) => {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      return;
    }

    set(() => ({
      deviceWidth: width,
      deviceHeight: height,
      isLandscape: width > height,
    }));
  },

  toggleLandscape: () => {
    set((state) => ({
      deviceWidth: state.deviceHeight,
      deviceHeight: state.deviceWidth,
      isLandscape: !state.isLandscape,
    }));
  },

  setSelection: (selection) => {
    set(() => ({ selection }));
  },

  addRow: (cellCount = 1, index, props) => {
    set((state) => {
      const nextRows = [...state.rows];
      const insertIndex = typeof index === 'number'
        ? Math.max(0, Math.min(index, nextRows.length))
        : nextRows.length;

      const newRow = createEmptyRow(cellCount);
      if (props) {
        Object.assign(newRow, props);
      }

      nextRows.splice(insertIndex, 0, newRow);

      return commitRows(state, nextRows);
    });
  },

  deleteRow: (rowId) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1) {
        return state;
      }

      const nextRows = state.rows.filter((row) => row.id !== rowId);
      const nextSelection = state.selection?.rowId === rowId ? null : state.selection;

      return commitRows(state, nextRows, { selection: nextSelection });
    });
  },

  duplicateRow: (rowId) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1) {
        return state;
      }

      const nextRows = [...state.rows];
      nextRows.splice(rowIndex + 1, 0, cloneRow(state.rows[rowIndex]));

      return commitRows(state, nextRows);
    });
  },

  moveRow: (fromIndex, toIndex) => {
    set((state) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.rows.length ||
        toIndex >= state.rows.length ||
        fromIndex === toIndex
      ) {
        return state;
      }

      const nextRows = [...state.rows];
      const [row] = nextRows.splice(fromIndex, 1);
      nextRows.splice(toIndex, 0, row);

      return commitRows(state, nextRows);
    });
  },

  setComponent: (rowId, cellIndex, componentType) => {
    set((state) => {
      const cell = findCell(state.rows, rowId, cellIndex);
      if (!cell) {
        return state;
      }

      const nextComponent = createComponent(componentType);
      const nextRows = state.rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          cells: row.cells.map((entry, index) => index === cellIndex ? { ...entry, content: nextComponent } : entry),
        };
      });

      return commitRows(state, nextRows, {
        selection: { type: 'component', rowId, cellIndex },
      });
    });
  },

  removeComponent: (rowId, cellIndex) => {
    set((state) => {
      const cell = findCell(state.rows, rowId, cellIndex);
      if (!cell?.content) {
        return state;
      }

      const nextRows = state.rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          cells: row.cells.map((entry, index) => index === cellIndex ? { ...entry, content: null } : entry),
        };
      });

      const nextSelection =
        state.selection?.type === 'component' &&
        state.selection.rowId === rowId &&
        state.selection.cellIndex === cellIndex
          ? { type: 'cell' as const, rowId, cellIndex }
          : state.selection;

      return commitRows(state, nextRows, { selection: nextSelection });
    });
  },

  copySelection: () => {
    const state = get();
    if (!state.selection) {
      return;
    }

    if (state.selection.type === 'row') {
      const rowIndex = findRowIndex(state.rows, state.selection.rowId);
      if (rowIndex === -1) {
        return;
      }

      set(() => ({
        clipboard: {
          type: 'row',
          data: cloneRow(state.rows[rowIndex]),
        },
      }));
      return;
    }

    if (typeof state.selection.cellIndex !== 'number') {
      return;
    }

    const cell = findCell(state.rows, state.selection.rowId, state.selection.cellIndex);
    if (!cell?.content) {
      return;
    }

    const content = cell.content;
    set(() => ({
      clipboard: {
        type: 'component',
        data: cloneEditorComponent(content),
      },
    }));
  },

  updateAdjacentCellWidths: (rowId, cellIndex, leftWidth, rightWidth) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1 || cellIndex < 0 || cellIndex >= state.rows[rowIndex].cells.length - 1) {
        return state;
      }

      const nextLeftWidth = Math.max(0.25, leftWidth);
      const nextRightWidth = Math.max(0.25, rightWidth);
      const row = state.rows[rowIndex];

      if (
        row.cells[cellIndex]?.width === nextLeftWidth &&
        row.cells[cellIndex + 1]?.width === nextRightWidth
      ) {
        return state;
      }

      // Create updated cells array for validation
      const updatedCells = row.cells.map((cell, currentCellIndex) => {
        if (currentCellIndex === cellIndex) {
          return { ...cell, width: nextLeftWidth };
        }
        if (currentCellIndex === cellIndex + 1) {
          return { ...cell, width: nextRightWidth };
        }
        return cell;
      });

      // Validate before applying
      if (!validateCellWidths(updatedCells)) {
        console.warn('Adjacent width update rejected: violates minimum width constraints');
        return state;
      }

      const nextRows = state.rows.map((entry, index) =>
        index === rowIndex ? { ...entry, cells: updatedCells } : entry
      );

      return commitRows(state, nextRows);
    });
  },

  updateRowHeight: (rowId, height) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1) {
        return state;
      }

      const nextHeight = normalizeRowHeight(height);
      if (state.rows[rowIndex].height === nextHeight) {
        return state;
      }

      const nextRows = state.rows.map((row, index) => index === rowIndex ? { ...row, height: nextHeight } : row);

      return commitRows(state, nextRows);
    });
  },

  updateRowProps: (rowId, patch) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1) {
        return state;
      }

      const nextRows = state.rows.map((row, index) => index === rowIndex ? { ...row, ...patch } : row);

      return commitRows(state, nextRows);
    });
  },

  setCellCount: (rowId, count) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1) {
        return state;
      }

      const nextCount = Math.max(1, Math.trunc(count) || 1);
      const row = state.rows[rowIndex];
      if (row.cells.length === nextCount) {
        return state;
      }

      const nextCells = row.cells.length > nextCount
        ? row.cells.slice(0, nextCount)
        : [
            ...row.cells,
            ...Array.from({ length: nextCount - row.cells.length }, () => createEmptyCell()),
          ];

      // Validate before applying
      if (!validateCellWidths(nextCells)) {
        console.warn('Cell count update rejected: would violate minimum width constraints');
        return state;
      }

      const nextRows = state.rows.map((entry, index) => index === rowIndex ? { ...entry, cells: nextCells } : entry);

      const nextSelection =
        state.selection?.rowId === rowId &&
        typeof state.selection.cellIndex === 'number' &&
        state.selection.cellIndex >= nextCount
          ? { type: 'row' as const, rowId }
          : state.selection;

      return commitRows(state, nextRows, { selection: nextSelection });
    });
  },

  moveCellInRow: (rowId, fromIndex, toIndex) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1) {
        return state;
      }

      const row = state.rows[rowIndex];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= row.cells.length ||
        toIndex >= row.cells.length ||
        fromIndex === toIndex
      ) {
        return state;
      }

      const nextCells = [...row.cells];
      const [movedCell] = nextCells.splice(fromIndex, 1);
      nextCells.splice(toIndex, 0, movedCell);

      const nextRows = state.rows.map((entry, index) =>
        index === rowIndex ? { ...entry, cells: nextCells } : entry
      );

      return commitRows(state, nextRows);
    });
  },

  updateCellWidth: (rowId, cellIndex, width) => {
    set((state) => {
      const rowIndex = findRowIndex(state.rows, rowId);
      if (rowIndex === -1 || cellIndex < 0 || cellIndex >= state.rows[rowIndex].cells.length) {
        return state;
      }

      const nextWidth = normalizeCellWidth(width);
      if (state.rows[rowIndex].cells[cellIndex].width === nextWidth) {
        return state;
      }

      // Create updated cells array for validation
      const row = state.rows[rowIndex];
      const updatedCells = row.cells.map((cell, currentCellIndex) =>
        currentCellIndex === cellIndex ? { ...cell, width: nextWidth } : cell
      );

      // Validate before applying
      if (!validateCellWidths(updatedCells)) {
        console.warn('Width update rejected: violates minimum width constraints');
        return state;
      }

      const nextRows = state.rows.map((entry, index) =>
        index === rowIndex ? { ...entry, cells: updatedCells } : entry
      );

      return commitRows(state, nextRows);
    });
  },

  updateComponentProps: (rowId, cellIndex, props) => {
    set((state) => {
      const cell = findCell(state.rows, rowId, cellIndex);
      if (!cell?.content) {
        return state;
      }

      const nextComponent = normalizeComponentForEditor({
        id: cell.content.id,
        type: cell.content.type,
        props: {
          ...cell.content.props,
          ...props,
        },
        children: cell.content.children,
      });

      if (!nextComponent) {
        return state;
      }

      const nextRows = state.rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          cells: row.cells.map((entry, index) => index === cellIndex ? { ...entry, content: nextComponent } : entry),
        };
      });

      return commitRows(state, nextRows);
    });
  },

  updateCellRules: (rowId, cellIndex, rules) => {
    set((state) => {
      const cell = findCell(state.rows, rowId, cellIndex);
      if (!cell) {
        return state;
      }

      const nextRows = state.rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          cells: row.cells.map((entry, index) => index === cellIndex ? { ...entry, rules } : entry),
        };
      });

      return commitRows(state, nextRows);
    });
  },
}));