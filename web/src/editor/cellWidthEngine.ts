/**
 * Percentage-based cell width calculation engine.
 *
 * Replaces the old flex-number width model with a clean percentage-based system.
 * Cells are either 'auto' (remaining space distributed equally) or a fixed
 * percentage string like '25%'.
 *
 * Rules (from Phase 2 plan):
 * 1. Fixed total = sum of percentage widths of manually-sized cells
 * 2. Remaining = 100 - fixedTotal
 * 3. Auto cell width = remaining / numberOfAutoCells
 * 4. When ALL cells are fixed-width and total < 100%, center cells (side padding)
 * 5. When at least one cell is auto, distribute remaining width to auto cells
 * 6. No cell may be smaller than MIN_CELL_WIDTH_PERCENT
 */

export const MIN_CELL_WIDTH_PERCENT = 5; // Minimum 5% width per cell
export const MIN_CELL_WIDTH_PX = 60; // Minimum 60px per cell
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
  let fixedNumericTotal = 0;
  let hasNumericWidth = false;
  for (const c of fixedCells) {
    if (typeof c.width === 'number') {
      fixedNumericTotal += c.width;
      hasNumericWidth = true;
    }
  }

  // Resolve fixed widths to percentages
  const resolvedPercentages = fixedCells.map(c => ({
    id: c.id,
    percent: resolveWidthToPercent(c.width, hasNumericWidth ? fixedNumericTotal : 100),
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
      fixedTotal += (c.width / cells.reduce((s, cc) => s + (typeof cc.width === 'number' ? cc.width : 0), 0)) * 100;
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
