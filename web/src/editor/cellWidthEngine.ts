/**
 * Percentage-based cell width calculation engine.
 *
 * Replaces the old flex-number width model with a clean percentage-based system.
 * Cells are either 'auto' (remaining space distributed equally) or a fixed
 * percentage string like '25%'.
 *
 * Rules (from FF4 plan — SLICE-CELL-WIDTH):
 * 1. Fixed total = sum of percentage widths of manually-sized cells
 * 2. Remaining = 100 - fixedTotal
 * 3. Auto cell width = remaining / numberOfAutoCells
 * 4. When ALL cells are fixed-width and total < 100%, center cells (side padding)
 * 5. When at least one cell is auto, distribute remaining width to auto cells
 * 6. No cell may be smaller than MIN_CELL_WIDTH_PERCENT
 *
 * REQ-IDs: FF4-ROW-004..021, FF4-ROW-024, FF4-CELL-001, FF4-CELL-002
 */

export const MIN_CELL_WIDTH_PERCENT = 5; // Minimum 5% width per cell
export const MIN_CELL_WIDTH_PX = 80; // Minimum 80px per cell (FF4-ROW-004, requirement: min cell width 80px)
export const MIN_ROW_HEIGHT = 48; // Minimum row height

export interface CellWidthResult {
  cellId: string;
  widthPercent: number;
  isAuto: boolean;
}

export type CellWidthInput = { id: string; width: 'auto' | string | number };

/**
 * Resolve any width value to a percentage-ready numeric value.
 * Returns the percentage value of the cell, or NaN if auto.
 */
function resolveWidthToPercent(width: CellWidthInput['width'], totalPercent: number): number {
  if (width === 'auto') return NaN;
  if (typeof width === 'string' && width.endsWith('%')) {
    const parsed = parseFloat(width);
    return isNaN(parsed) ? NaN : parsed;
  }
  // Legacy numeric flex weights — convert to percentage of total
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    // Guard against division by zero when totalPercent is 0
    if (!totalPercent) return 0;
    return (width / totalPercent) * 100;
  }
  return NaN;
}

/**
 * Check if a width is 'auto' (not a fixed percentage).
 */
export function isAutoWidth(width: CellWidthInput['width']): boolean {
  if (width === 'auto') return true;
  if (typeof width === 'string' && width.endsWith('%')) return false;
  return false; // Treat numbers as fixed (they need to resolve to something)
}

/**
 * Sum numeric width values across cells. Shared helper used by both
 * calculateCellWidths and calculateSidePadding for consistent legacy width handling.
 * Returns the sum of numeric width values (ignores 'auto' and percentage strings).
 */
function sumNumericWidths(cells: CellWidthInput[]): number {
  return cells.reduce<number>((sum, c) => {
    if (typeof c.width === 'number' && Number.isFinite(c.width) && c.width > 0) {
      return sum + c.width;
    }
    return sum;
  }, 0);
}

/**
 * Calculate percentage widths for all cells in a row.
 *
 * @param cells - Array of cell width inputs (id + width)
 * @param rowWidthPx - The total row width in pixels
 * @returns Array of CellWidthResult with resolved percentage widths
 */
export function calculateCellWidths(
  cells: CellWidthInput[],
): CellWidthResult[] {
  if (cells.length === 0) return [];

  // Separate fixed and auto cells
  const fixedCells = cells.filter(c => !isAutoWidth(c.width));
  const autoCells = cells.filter(c => isAutoWidth(c.width));

  // If all cells are auto, distribute equally
  if (autoCells.length === cells.length) {
    const equalWidth = 100 / cells.length;
    return cells.map(c => ({
      cellId: c.id,
      widthPercent: equalWidth,
      isAuto: true,
    }));
  }

  // Calculate total fixed percentage
  // For legacy numeric widths, treat the total sum as the reference
  const fixedNumericTotal = sumNumericWidths(fixedCells);
  const hasNumericWidth = fixedNumericTotal > 0;

  // Resolve fixed widths to percentages
  // A2: Use 100 as fallback when fixedNumericTotal is 0 to avoid division by zero
  const safeTotal = fixedNumericTotal || 100;
  const resolvedPercentages = fixedCells.map(c => ({
    id: c.id,
    percent: resolveWidthToPercent(c.width, hasNumericWidth ? safeTotal : 100),
  }));

  const fixedTotal = resolvedPercentages.reduce((sum, r) => sum + r.percent, 0);
  const remaining = Math.max(0, 100 - fixedTotal);

  // Calculate auto cell width
  const autoCellPercent = autoCells.length > 0 ? remaining / autoCells.length : 0;

  // Build results
  const results: CellWidthResult[] = cells.map(c => {
    const fixed = resolvedPercentages.find(r => r.id === c.id);
    if (fixed) {
      return { cellId: c.id, widthPercent: fixed.percent, isAuto: false };
    }
    return { cellId: c.id, widthPercent: autoCellPercent, isAuto: true };
  });

  return results;
}

/**
 * Check if we can add a new cell to the row without violating minimum width.
 */
export function canAddCell(
  cells: CellWidthInput[],
): { allowed: boolean; reason?: string } {
  const minPercent = MIN_CELL_WIDTH_PERCENT;

  // Simplified: each auto cell would get at least minimum percentage
  if (100 / (cells.length + 1) < minPercent) {
    return {
      allowed: false,
      reason: `Adding a cell would make each cell too narrow (minimum ${minPercent}%)`,
    };
  }

  return { allowed: true };
}

/**
 * Check if changing a cell's width would violate constraints.
 */
export function canChangeCellWidth(
  cells: CellWidthInput[],
  cellId: string,
  newWidth: string,
): { allowed: boolean; reason?: string } {
  // Parse new width
  let newPercent: number;
  if (newWidth === 'auto') {
    // Switching to auto — always allowed (remaining space redistributes)
    return { allowed: true };
  }
  if (typeof newWidth === 'string' && newWidth.endsWith('%')) {
    newPercent = parseFloat(newWidth);
    if (isNaN(newPercent) || newPercent < MIN_CELL_WIDTH_PERCENT) {
      return { allowed: false, reason: `Minimum cell width is ${MIN_CELL_WIDTH_PERCENT}%` };
    }
  } else {
    return { allowed: false, reason: 'Only percentage widths are supported' };
  }

  // Check total doesn't exceed 100% combined with other fixed cells
  const fixedTotal = cells
    .filter(c => c.id !== cellId && !isAutoWidth(c.width))
    .reduce((sum, c) => {
      if (typeof c.width === 'string' && c.width.endsWith('%')) {
        return sum + parseFloat(c.width);
      }
      return sum;
    }, 0);

  if (fixedTotal + newPercent > 100) {
    return {
      allowed: false,
      reason: `Total fixed width would exceed 100% (${Math.round(fixedTotal + newPercent)}%)`,
    };
  }

  return { allowed: true };
}

/**
 * Calculate minimum row height based on cell content constraints.
 */
export function minimumRowHeight(): number {
  return MIN_ROW_HEIGHT;
}

/**
 * Determine if all cells are fixed-width (no auto cells).
 */
export function allCellsFixed(cells: CellWidthInput[]): boolean {
  return cells.length > 0 && cells.every(c => !isAutoWidth(c.width));
}

/**
 * Calculate side padding percentage when all cells are fixed and total < 100%.
 * Returns 0 if at least one cell is auto (remaining space is distributed).
 */
export function calculateSidePadding(cells: CellWidthInput[]): number {
  if (cells.length === 0) return 0;

  const autoCount = cells.filter(c => isAutoWidth(c.width)).length;
  if (autoCount > 0) return 0; // Auto cells absorb remaining space

  // All cells fixed — calculate remaining space
  let fixedTotal = 0;
  let fixedCount = 0;
  for (const c of cells) {
    if (typeof c.width === 'string' && c.width.endsWith('%')) {
      fixedTotal += parseFloat(c.width);
      fixedCount++;
    } else if (typeof c.width === 'number') {
      const numericSum = sumNumericWidths(cells);
      fixedTotal += numericSum > 0 ? (c.width / numericSum) * 100 : 0;
      fixedCount++;
    }
  }

  if (fixedCount === 0) return 0;
  // Return remaining percentage as fraction (0-1)
  return Math.max(0, 100 - fixedTotal) / 100;
}

/**
 * Convert a percentage to a CSS percentage string.
 */
export function percentToString(pct: number): string {
  return `${Math.round(pct * 100) / 100}%`;
}

/**
 * Get the cell's width as a percentage for CSS rendering.
 */
export function getCellWidthPercent(width: CellWidthInput['width']): number {
  if (width === 'auto') return 0; // Will be distributed
  if (typeof width === 'string' && width.endsWith('%')) {
    const parsed = parseFloat(width);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof width === 'number' && Number.isFinite(width)) {
    // For legacy numeric widths, we need context — return 0 and let caller handle
    return 0;
  }
  return 0;
}

/**
 * FF4-ROW-007: Calculate usable row width after subtracting horizontal padding and gaps.
 * usableRowWidth = rowWidth - horizontalPadding - gaps
 */
export function calculateUsableRowWidth(
  rowWidthPx: number,
  horizontalPaddingPx: number,
  gapPx: number,
): number {
  return Math.max(1, rowWidthPx - horizontalPaddingPx - gapPx);
}

/**
 * FF4-ROW-007: Calculate the minimum width percent for a cell based on usable row width.
 * minWidthPercent = minCellWidthPx / usableRowWidthPx * 100
 */
export function calculateMinWidthPercent(
  usableRowWidthPx: number,
  minCellWidthPx: number = MIN_CELL_WIDTH_PX,
): number {
  if (usableRowWidthPx <= 0) return MIN_CELL_WIDTH_PERCENT;
  return Math.max(MIN_CELL_WIDTH_PERCENT, (minCellWidthPx / usableRowWidthPx) * 100);
}

/**
 * FF4-ROW-008 / FF4-ROW-014: Check if increasing row padding would violate minimum cell widths.
 * Returns { allowed: true } if safe, or { allowed: false, reason } with explanation.
 */
export function canIncreasePadding(
  cells: CellWidthInput[],
  currentPaddingPx: number,
  newPaddingPx: number,
  rowWidthPx: number,
  gapPx: number = 0,
): { allowed: boolean; reason?: string } {
  if (newPaddingPx <= currentPaddingPx) {
    return { allowed: true }; // Decreasing padding is always safe
  }

  const usableRowWidth = calculateUsableRowWidth(rowWidthPx, newPaddingPx * 2, gapPx);
  const minWidthPercent = calculateMinWidthPercent(usableRowWidth);

  // Check every cell would still meet minimum
  const resolvedWidths = calculateCellWidths(cells);
  for (const cell of resolvedWidths) {
    if (cell.widthPercent < minWidthPercent) {
      return {
        allowed: false,
        reason: `Increasing padding would shrink usable width, making cells below minimum (${Math.round(minWidthPercent)}%)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * FF4-ROW-010: Pre-flight next-action check — returns which controls should be disabled
 * for a given row. The editor greys out disabled controls proactively.
 */
export interface DisabledActions {
  canAddCell: boolean;
  addCellReason?: string;
  canIncreasePadding: boolean;
  increasePaddingReason?: string;
  canDecreaseRowWidth: boolean;
  decreaseRowWidthReason?: string;
  canToggleHorizontalScroll: boolean;
  toggleScrollReason?: string;
  canChangeCellWidth: boolean;
  changeCellWidthReason?: string;
}

/**
 * FF4-ROW-010: Get disabled actions for a row — pre-flight check.
 * Continuously evaluates whether actions would violate rules if taken.
 */
export function getDisabledActions(
  cells: CellWidthInput[],
  rowWidthPx: number,
  paddingPx: number = 0,
  gapPx: number = 0,
  scrollable: boolean = false,
): DisabledActions {
  const usableRowWidth = calculateUsableRowWidth(rowWidthPx, paddingPx * 2, gapPx);
  const minWidthPercent = calculateMinWidthPercent(usableRowWidth);

  // Check add cell: would adding a cell put an auto cell below min?
  const addCellCheck = canAddCell(cells);
  const resolved = calculateCellWidths(cells);

  // Check padding increase: would more padding compress cells below min?
  const paddingCheck = canIncreasePadding(cells, paddingPx, paddingPx + 8, rowWidthPx, gapPx);

  // Check if any auto cell is at or near minimum width
  const autoCellsBelowMin = resolved.filter(c => c.isAuto && c.widthPercent <= minWidthPercent + 1);
  // If auto cells are already near minimum, increasing a fixed cell would break them
  const canChangeFixed = resolved.filter(c => !c.isAuto).length === 0 ||
    autoCellsBelowMin.length === 0;

  // Check horizontal scroll toggle
  const toggleScrollCheck = canToggleHorizontalScroll(cells, scrollable, minWidthPercent);

  return {
    canAddCell: addCellCheck.allowed,
    addCellReason: addCellCheck.reason,
    canIncreasePadding: paddingCheck.allowed,
    increasePaddingReason: paddingCheck.reason,
    canDecreaseRowWidth: autoCellsBelowMin.length === 0,
    decreaseRowWidthReason: autoCellsBelowMin.length > 0
      ? 'Auto cells are at minimum width — cannot shrink row further'
      : undefined,
    canToggleHorizontalScroll: toggleScrollCheck.allowed,
    toggleScrollReason: toggleScrollCheck.reason,
    canChangeCellWidth: canChangeFixed,
    changeCellWidthReason: !canChangeFixed
      ? 'Auto cells are at minimum width — cannot increase fixed cells'
      : undefined,
  };
}

/**
 * FF4-ROW-013: Enhanced canChangeCellWidth — also checks if increasing a fixed cell
 * would shrink auto cells below minimum width.
 */
export function canChangeCellWidthV2(
  cells: CellWidthInput[],
  cellId: string,
  newWidth: string,
  rowWidthPx: number,
  paddingPx: number = 0,
  gapPx: number = 0,
): { allowed: boolean; reason?: string } {
  // First run basic check from v1
  const basicCheck = canChangeCellWidth(cells, cellId, newWidth);
  if (!basicCheck.allowed) return basicCheck;

  // For auto → fixed or fixed → wider: check auto cell impact
  if (newWidth === 'auto') {
    return { allowed: true }; // Switching to auto is always safe
  }

  const newPercent = parseFloat(newWidth.replace('%', ''));
  const autoCells = cells.filter(c => isAutoWidth(c.width) || c.id === cellId);
  const otherFixedCells = cells.filter(c => !isAutoWidth(c.width) && c.id !== cellId);

  // Calculate what's left for auto cells
  const otherFixedTotal = otherFixedCells.reduce((sum, c) => {
    if (typeof c.width === 'string' && c.width.endsWith('%')) {
      return sum + parseFloat(c.width);
    }
    return sum;
  }, 0);

  const remainingForAuto = 100 - (otherFixedTotal + newPercent);
  const autoCellCount = autoCells.length;

  if (autoCellCount > 0 && remainingForAuto < 0) {
    return {
      allowed: false,
      reason: `Fixed cells would exceed 100% — no space left for auto cells`,
    };
  }

  // Check minimum width
  const usableRowWidth = calculateUsableRowWidth(rowWidthPx, paddingPx * 2, gapPx);
  const minWidthPercent = calculateMinWidthPercent(usableRowWidth);

  if (autoCellCount > 0) {
    const autoCellWidth = remainingForAuto / autoCellCount;
    if (autoCellWidth < minWidthPercent) {
      return {
        allowed: false,
        reason: `Auto cells would shrink below minimum width (${Math.round(autoCellWidth)}% < ${Math.round(minWidthPercent)}%)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * FF4-ROW-015: Check if a row can be resized to a given width without violating
 * minimum cell width constraints.
 */
export function canResizeRow(
  cells: CellWidthInput[],
  newRowWidthPx: number,
  paddingPx: number = 0,
  gapPx: number = 0,
): { allowed: boolean; reason?: string; minWidth: number } {
  const usableRowWidth = calculateUsableRowWidth(newRowWidthPx, paddingPx * 2, gapPx);
  const minWidthPercent = calculateMinWidthPercent(usableRowWidth);

  // All resolved cell widths must be >= min
  const resolved = calculateCellWidths(cells);
  for (const cell of resolved) {
    if (cell.widthPercent > 0 && cell.widthPercent < minWidthPercent) {
      return {
        allowed: false,
        reason: `Row width would make cells below minimum width (${Math.round(cell.widthPercent)}% < ${Math.round(minWidthPercent)}%)`,
        minWidth: newRowWidthPx,
      };
    }
  }

  // Calculate the minimum pixel width this row can handle
  // minPx = minCellPx * number_of_cells + padding + gaps
  const minWidth = (MIN_CELL_WIDTH_PX * cells.length) + (paddingPx * 2) + (gapPx * Math.max(0, cells.length - 1));

  return { allowed: true, minWidth };
}

/**
 * FF4-ROW-016/017: Check if horizontal scrolling can be toggled.
 * If turning scroll off would cause overflow/min-width violations, it should be blocked.
 */
export function canToggleHorizontalScroll(
  cells: CellWidthInput[],
  currentScrollable: boolean,
  minWidthPercent: number = MIN_CELL_WIDTH_PERCENT,
): { allowed: boolean; reason?: string } {
  // Turning scroll ON is always allowed
  if (!currentScrollable) {
    return { allowed: true };
  }

  // Turning scroll OFF: check if cells would fit without scrolling
  const resolved = calculateCellWidths(cells);

  // If any cell is wider than 100% (overflow even with scroll), warn
  const oversizeCells = resolved.filter(c => c.widthPercent > 100);
  if (oversizeCells.length > 0) {
    return {
      allowed: false,
      reason: `Disabling scroll would cause ${oversizeCells.length} cell(s) to overflow (total > 100%)`,
    };
  }

  // Check if any cell would be below minimum without scroll
  const autoCells = resolved.filter(c => c.isAuto);
  if (autoCells.length > 0 && autoCells.some(c => c.widthPercent < minWidthPercent)) {
    return {
      allowed: false,
      reason: 'Auto cells are below minimum width — horizontal scroll is needed to contain them',
    };
  }

  return { allowed: true };
}

/**
 * FF4-ROW-020: Validate all 12 operations against row constraints.
 * Returns a list of validation errors. Empty array = valid.
 */
export interface RowValidationError {
  type: 'cell_width' | 'min_width' | 'overflow' | 'exceeds_100' | 'binding_missing';
  path: string;
  message: string;
}

export function validateRow(
  cells: CellWidthInput[],
  rowWidthPx: number = 390,
  paddingPx: number = 0,
  gapPx: number = 0,
  scrollable: boolean = false,
): RowValidationError[] {
  const errors: RowValidationError[] = [];

  if (cells.length === 0) return errors;

  const usableRowWidth = calculateUsableRowWidth(rowWidthPx, paddingPx * 2, gapPx);
  const minWidthPercent = calculateMinWidthPercent(usableRowWidth);
  const resolved = calculateCellWidths(cells);

  // 1. Check minimum width per cell
  for (const cell of resolved) {
    if (cell.widthPercent > 0 && cell.widthPercent < minWidthPercent) {
      errors.push({
        type: 'min_width',
        path: `cell:${cell.cellId}`,
        message: `Cell width ${Math.round(cell.widthPercent)}% is below minimum ${Math.round(minWidthPercent)}%`,
      });
    }
  }

  // 2. Check fixed total doesn't exceed 100%
  const fixedCells = cells.filter(c => !isAutoWidth(c.width));
  let fixedTotal = 0;
  for (const c of fixedCells) {
    if (typeof c.width === 'string' && c.width.endsWith('%')) {
      fixedTotal += parseFloat(c.width);
    }
  }
  if (fixedTotal > 100) {
    errors.push({
      type: 'exceeds_100',
      path: 'row',
      message: `Fixed cell widths total ${Math.round(fixedTotal)}%, exceeding 100%`,
    });
  }

  // 3. Check total doesn't overflow (for non-scrollable rows)
  if (!scrollable && resolved.reduce((sum, c) => sum + c.widthPercent, 0) > 100) {
    errors.push({
      type: 'overflow',
      path: 'row',
      message: 'Total cell width exceeds 100% — row will overflow',
    });
  }

  return errors;
}

/**
 * FF4-ROW-021: Validate existing saved row. Shows errors on publish attempt
 * rather than silently normalizing.
 */
export function validateExistingRow(
  cells: CellWidthInput[],
): { valid: boolean; errors: RowValidationError[] } {
  const errors = validateRow(cells);
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * FF4-ROW-020 helper: Check if a specific operation would be valid on this row.
 */
export function isOperationValid(
  operation: 'addCell' | 'deleteCell' | 'changeWidth' | 'changePadding' | 'resizeRow' | 'toggleScroll' | 'loadScreen' | 'importTemplate',
  cells: CellWidthInput[],
  rowWidthPx: number = 390,
  paddingPx: number = 0,
  gapPx: number = 0,
  scrollable: boolean = false,
): boolean {
  switch (operation) {
    case 'addCell':
      return canAddCell(cells).allowed;
    case 'changePadding':
      // Simulate 1px increase
      return canIncreasePadding(cells, paddingPx, paddingPx + 1, rowWidthPx, gapPx).allowed;
    case 'resizeRow':
      return canResizeRow(cells, rowWidthPx - 10, paddingPx, gapPx).allowed;
    case 'toggleScroll':
      return canToggleHorizontalScroll(cells, scrollable).allowed;
    case 'loadScreen':
    case 'importTemplate':
    case 'deleteCell':
    case 'changeWidth':
      // Validate the resulting row
      return validateRow(cells, rowWidthPx, paddingPx, gapPx, scrollable).length === 0;
    default:
      return true;
  }
}

/**
 * FF4-CELL-001: Check if a cell can be split into two cells without violating
 * minimum width constraints.
 */
export function canSplitCell(
  cells: CellWidthInput[],
  cellIndex: number,
): { allowed: boolean; reason?: string } {
  if (cellIndex < 0 || cellIndex >= cells.length) {
    return { allowed: false, reason: 'Invalid cell index' };
  }

  const cell = cells[cellIndex];
  const cellWidth = getCellWidthPercent(cell.width);

  // If auto, splitting would make each half ~ half the auto width
  if (isAutoWidth(cell.width)) {
    const results = calculateCellWidths(cells);
    const resolvedWidth = results.find(r => r.cellId === cell.id)?.widthPercent ?? 0;
    const halfWidth = resolvedWidth / 2;

    if (halfWidth < MIN_CELL_WIDTH_PERCENT) {
      return {
        allowed: false,
        reason: `Splitting would make each half ${Math.round(halfWidth)}% — below minimum ${MIN_CELL_WIDTH_PERCENT}%`,
      };
    }
  } else {
    // Fixed width — each half gets half
    if (cellWidth < MIN_CELL_WIDTH_PERCENT * 2) {
      return {
        allowed: false,
        reason: `Cell width ${Math.round(cellWidth)}% is too small to split`,
      };
    }
  }

  return { allowed: true };
}

/**
 * FF4-CELL-002: Calculate the actual pixel width of a cell based on its percentage
 * and the row pixel width.
 */
export function calculateCellWidthPx(
  widthPercent: number,
  rowWidthPx: number,
  paddingPx: number = 0,
  gapPx: number = 0,
): number {
  const usableRowWidth = calculateUsableRowWidth(rowWidthPx, paddingPx * 2, gapPx);
  return (widthPercent / 100) * usableRowWidth;
}
