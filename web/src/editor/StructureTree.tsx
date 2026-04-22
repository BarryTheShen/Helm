import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from './useEditorStore';
import { COMPONENT_REGISTRY, ROW_PRESETS } from './types';
import type { RowPreset } from './types';
import {
  ChevronDown, ChevronRight, Plus, Trash2, Copy, ArrowUp, ArrowDown,
  Rows3, Box
} from 'lucide-react';

async function copyJsonToClipboard(value: unknown): Promise<void> {
  const text = JSON.stringify(value, null, 2);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function getComponentIcon(type: string): string {
  return COMPONENT_REGISTRY.find(c => c.type === type)?.icon || '📦';
}

function getComponentName(type: string): string {
  return COMPONENT_REGISTRY.find(c => c.type === type)?.displayName || type;
}

interface AddRowPopoverProps {
  onAdd: (cellCount: number, preset?: RowPreset) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number; bottom: number };
}

interface StructureTreeProps {
  screenLabel?: string;
}

function AddRowPopover({ onAdd, onClose, anchorRect }: AddRowPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showPresets, setShowPresets] = useState(true);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="fixed bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-[9999] w-56"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}>
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 mb-1">
        <span className="text-xs font-medium text-gray-500">Add Row</span>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
        >
          {showPresets ? 'Hide Presets' : 'Show Presets'}
        </button>
      </div>

      {showPresets && (
        <>
          <div className="px-2 py-1">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Presets</div>
            <div className="grid grid-cols-2 gap-1">
              {ROW_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => { onAdd(preset.cellCount, preset); onClose(); }}
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-center"
                >
                  <span className="text-base">{preset.icon || '▭'}</span>
                  <span className="text-[10px] font-medium leading-tight">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-gray-100" />
        </>
      )}

      <div className="px-2 py-1">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Custom</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => { onAdd(n); onClose(); }}
              className="flex-1 py-2 text-sm font-medium bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded border border-gray-200 hover:border-blue-300 transition-colors"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function StructureTree({ screenLabel = 'Current Screen' }: StructureTreeProps) {
  const rows = useEditorStore(s => s.rows);
  const selection = useEditorStore(s => s.selection);
  const setSelection = useEditorStore(s => s.setSelection);
  const addRow = useEditorStore(s => s.addRow);
  const deleteRow = useEditorStore(s => s.deleteRow);
  const duplicateRow = useEditorStore(s => s.duplicateRow);
  const moveRow = useEditorStore(s => s.moveRow);
  const getScreen = useEditorStore(s => s.getScreen);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAddRow, setShowAddRow] = useState(false);
  const addRowBtnRef = useRef<HTMLButtonElement>(null);
  const [addRowRect, setAddRowRect] = useState({ top: 0, left: 0, bottom: 0 });

  // Auto-expand all rows on initial load
  useEffect(() => {
    setExpandedRows(new Set(rows.map(r => r.id)));
  }, [rows.map(r => r.id).join('|')]);

  const toggleExpand = (rowId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const isRowSelected = (rowId: string) => selection?.rowId === rowId && selection?.type === 'row';
  const isCellSelected = (rowId: string, cellIdx: number) =>
    selection?.rowId === rowId && selection?.cellIndex === cellIdx && (selection?.type === 'cell' || selection?.type === 'component');
  const isScreenSelected = selection === null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Structure</span>
        <div className="relative">
          <button
            ref={addRowBtnRef}
            onClick={() => {
              if (!showAddRow && addRowBtnRef.current) {
                const rect = addRowBtnRef.current.getBoundingClientRect();
                setAddRowRect({ top: rect.top, left: rect.left, bottom: rect.bottom });
              }
              setShowAddRow(!showAddRow);
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Add Row"
          >
            <Plus size={14} className="text-gray-600" />
          </button>
          {showAddRow && (
            <AddRowPopover
              onAdd={(n, preset) => {
                if (preset) {
                  const { cellCount, height, props, ...rest } = preset;
                  addRow(cellCount, undefined, { height: height || 'auto', ...props });
                } else {
                  addRow(n);
                }
              }}
              onClose={() => setShowAddRow(false)}
              anchorRect={addRowRect}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <div
          className={`mx-1 mb-1 flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group transition-colors ${
            isScreenSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
          }`}
          onClick={() => setSelection(null)}
        >
          <Rows3 size={12} className="text-gray-400 shrink-0" />
          <span className="text-xs font-medium flex-1 truncate" title={screenLabel}>
            Screen: {screenLabel}
            <span className="text-gray-400 font-normal"> ({rows.length} row{rows.length !== 1 ? 's' : ''})</span>
          </span>
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void copyJsonToClipboard(getScreen());
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
              title="Copy Screen JSON"
            >
              <Copy size={10} />
            </button>
          </div>
        </div>

        {rows.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-gray-400">
            No rows yet. Click + to add a row.
          </div>
        )}

        {rows.map((row, rowIdx) => (
          <div key={row.id}>
            {/* Row item */}
            <div
              className={`flex items-center gap-1 px-2 py-1.5 mx-1 rounded cursor-pointer group transition-colors ${
                isRowSelected(row.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelection({ type: 'row', rowId: row.id })}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(row.id); }}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                {expandedRows.has(row.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              <Rows3 size={12} className="text-gray-400 shrink-0" />
              <span className="text-xs font-medium flex-1 truncate">
                Row {rowIdx + 1}
                <span className="text-gray-400 font-normal"> ({row.cells.length} cell{row.cells.length !== 1 ? 's' : ''})</span>
              </span>

              {/* Row actions - visible on hover */}
              <div className="hidden group-hover:flex items-center gap-0.5">
                {rowIdx > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); moveRow(rowIdx, rowIdx - 1); }}
                    className="p-0.5 hover:bg-gray-200 rounded" title="Move Up">
                    <ArrowUp size={10} />
                  </button>
                )}
                {rowIdx < rows.length - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); moveRow(rowIdx, rowIdx + 1); }}
                    className="p-0.5 hover:bg-gray-200 rounded" title="Move Down">
                    <ArrowDown size={10} />
                  </button>
                )}
                <button onClick={(e) => {
                  e.stopPropagation();
                  void copyJsonToClipboard(row);
                }}
                  className="p-0.5 hover:bg-gray-200 rounded" title="Copy JSON">
                  <Copy size={10} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); duplicateRow(row.id); }}
                  className="px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide hover:bg-gray-200 rounded" title="Duplicate">
                  Dup
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}
                  className="p-0.5 hover:bg-red-100 text-red-500 rounded" title="Delete">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>

            {/* Cells */}
            {expandedRows.has(row.id) && (
              <div className="ml-6">
                {row.cells.map((cell, cellIdx) => (
                  <div
                    key={cell.id}
                    className={`flex items-center gap-1.5 px-2 py-1 mx-1 rounded cursor-pointer transition-colors ${
                      isCellSelected(row.id, cellIdx) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelection({
                      type: cell.content ? 'component' : 'cell',
                      rowId: row.id,
                      cellIndex: cellIdx,
                    })}
                  >
                    {cell.content ? (
                      <>
                        <span className="text-xs">{getComponentIcon(cell.content.type)}</span>
                        <span className="text-xs truncate">Cell {cellIdx + 1}: {getComponentName(cell.content.type)}</span>
                      </>
                    ) : (
                      <>
                        <Box size={10} className="text-gray-300" />
                        <span className="text-xs text-gray-400 italic">Cell {cellIdx + 1}: Empty</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}