/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, JSX } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from './useEditorStore';
import { getComponentDefinition } from './types';
import type { EditorCell, EditorComponent, EditorRow, EditorRowHeight } from './types';
import { assertRegisteredComponentType } from './typeGuards';
import { MIN_CELL_WIDTH_PERCENT, MIN_CELL_WIDTH_PX, MIN_ROW_HEIGHT, calculateSidePadding, calculateCellWidths } from './cellWidthEngine';

import { ComponentPicker } from './ComponentPicker';
import { Plus, Grip, X, Edit2, Eye, Copy, Trash2, ArrowUp, ArrowDown, Clipboard } from 'lucide-react';
import { resolveVariables } from './variableResolver';
import { renderLucideIcon } from '../lib/lucideIcon';
import ReactMarkdown from 'react-markdown';

// cell width validation constants — SLICE-CELL-WIDTH (FF4-ROW-004..021, FF4-ROW-024)
// NOTE: MIN_CELL_WIDTH_PERCENT, MIN_CELL_WIDTH_PX, and MIN_ROW_HEIGHT imported from cellWidthEngine

// ── Context Menu ──────────────────────────────────────────────────────────

interface RowContextMenuProps {
  rowId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onDeleteRow: (rowId: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onAddRowAbove: (rowId: string) => void;
  onAddRowBelow: (rowId: string) => void;
}

function RowContextMenu({ rowId, position, onClose, onDeleteRow, onDuplicateRow, onAddRowAbove, onAddRowBelow }: RowContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] py-1 w-44"
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-label="Row context menu"
    >
      <button
        onClick={() => { onAddRowAbove(rowId); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
        role="menuitem"
      >
        <ArrowUp size={12} />
        Add Row Above
      </button>
      <button
        onClick={() => { onAddRowBelow(rowId); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
        role="menuitem"
      >
        <ArrowDown size={12} />
        Add Row Below
      </button>
      <button
        onClick={() => { onDuplicateRow(rowId); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-left"
        role="menuitem"
      >
        <Clipboard size={12} />
        Duplicate Row
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={() => { onDeleteRow(rowId); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 transition-colors text-left"
        role="menuitem"
      >
        <Trash2 size={12} />
        Delete Row
      </button>
    </div>
  );
}

const ROW_DRAG_HANDLE_WIDTH = 24;
/** FF4-ROW-001: Drag handle positioned to the left of the row, inside the editor canvas.
 *  Previously at -60px (off-screen). Now uses a negative left offset relative to the row
 *  container that places it just outside the row border but still within the canvas viewport. */
const ROW_DRAG_HANDLE_OFFSET = -28;
const SCROLLABLE_CELL_WIDTH = 160;
const SCROLLABLE_CELL_MIN_WIDTH = 120;
const MAX_PREVIEW_WIDTH = 960;
const MAX_PREVIEW_HEIGHT = 1200;
const MIN_CELL_PERCENT_FOR_DRAG = 5; // Minimum percentage for drag resize

/** FF4-ROW-012 / FF4-CELL-004: host wrapper so atomic previews fill the cell */
const FIT_CELL_CLASS = 'flex flex-1 flex-col min-h-0 w-full h-full';
const FIT_CELL_STYLE: CSSProperties = { width: '100%', height: '100%', flex: 1, minHeight: 0 };

function applyCellWidthStyles(element: HTMLElement, percent: number) {
  element.style.flex = `0 0 ${percent}%`;
  element.style.width = `${percent}%`;
}

function clearCellWidthStyles(element: HTMLElement) {
  element.style.flex = '';
  element.style.width = '';
}

// ── Component Preview Renderers ──────────────────────────────────────────────

function TextPreview({ content, variant, fontSize, fontWeight, color, align, bold, italic }: any) {
  const semanticStyle = variant === 'heading'
    ? { fontSize: 28, fontWeight: '700', lineHeight: 1.2 }
    : variant === 'caption'
      ? { fontSize: 12, fontWeight: '400', lineHeight: 1.4 }
      : { fontSize: 16, fontWeight: '400', lineHeight: 1.5 };

  const resolvedContent = resolveVariables(content || 'Text');
  const hasMarkdownSyntax = /[*#_`[\]!>-]/.test(resolvedContent);

  const resolvedFontSize = typeof fontSize === 'number' ? fontSize : semanticStyle.fontSize;
  const resolvedFontWeight = (typeof fontWeight === 'string' && fontWeight.length > 0) || typeof fontWeight === 'number'
    ? String(fontWeight)
    : bold
      ? '700'
      : semanticStyle.fontWeight;

  const baseStyle: React.CSSProperties = {
    fontSize: resolvedFontSize,
    fontWeight: resolvedFontWeight,
    fontStyle: italic ? 'italic' : 'normal',
    lineHeight: semanticStyle.lineHeight,
    color: color || '#000',
    textAlign: (align || 'left') as React.CSSProperties['textAlign'],
    padding: '4px 0',
  };

  // Plain text (FF4-TEXT-002: preserve single newlines from inspector Enter key)
  if (!hasMarkdownSyntax) {
    return (
      <div style={{ ...baseStyle, whiteSpace: 'pre-wrap' }}>
        {resolvedContent}
      </div>
    );
  }

  // Rich content — render through markdown
  const markdownStyle: React.CSSProperties = {
    ...semanticStyle,
    color: color || '#000',
    textAlign: align || 'left',
    padding: '4px 0',
  };

  return (
    <div style={markdownStyle}>
      <ReactMarkdown>{resolvedContent}</ReactMarkdown>
    </div>
  );
}

function ButtonPreview({ label, variant, size, icon, iconPosition = 'left' }: any) {
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white', secondary: 'bg-gray-200 text-gray-800',
    ghost: 'bg-transparent text-gray-600', destructive: 'bg-red-600 text-white', icon: 'bg-transparent text-blue-600',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg',
    small: 'px-3 py-1 text-sm', medium: 'px-4 py-2', large: 'px-6 py-3 text-lg',
  };
  const iconNode = renderLucideIcon(icon || 'star', 18, 'shrink-0');

  if (variant === 'icon') {
    return (
      <button
        data-testid="button-icon-preview"
        className="flex h-full w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600"
      >
        {renderLucideIcon(icon || 'star', 24, 'shrink-0')}
      </button>
    );
  }

  return (
    <button className={`flex h-full w-full items-center justify-center gap-1.5 rounded-md font-medium ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`}>
      {!!icon && iconPosition !== 'right' && iconNode}
      {label || 'Button'}
      {!!icon && iconPosition === 'right' && iconNode}
    </button>
  );
}

function ImagePreview({ src, fitMode }: any) {
  const objectFit = fitMode === 'fitHeight' ? 'contain' : 'cover';
  return (
    <img
      src={src || 'https://via.placeholder.com/300x200'}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit,
      }}
    />
  );
}

function DividerPreview({ color, thickness, margin }: any) {
  return <hr style={{ borderColor: color || '#E0E0E0', borderWidth: thickness ?? 1, margin: `${margin ?? 8}px 0` }} />;
}

function IconPreview({ name, size, color }: any) {
  return (
    <span
      className="flex h-full w-full items-center justify-center"
      style={{ color: color || '#000' }}
    >
      {renderLucideIcon(name || 'star', size || 24)}
    </span>
  );
}

function CalendarPreview() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white p-2">
      <div className="text-sm font-bold mb-2">📅 Calendar</div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-500">
        {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs mt-1">
        {Array.from({length: 28}, (_,i) => (
          <div key={i} className={`py-0.5 rounded ${i === 4 ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}>{i+1}</div>
        ))}
      </div>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-sm font-bold mb-2">💬 Chat</div>
      <div className="space-y-1.5 text-xs">
        <div className="flex"><span className="bg-gray-100 rounded-lg px-2 py-1">Hi! How can I help?</span></div>
        <div className="flex justify-end"><span className="bg-blue-600 text-white rounded-lg px-2 py-1">Show events</span></div>
      </div>
    </div>
  );
}

function NotesPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-sm font-bold mb-2">📓 Notes</div>
      <div className="text-xs text-gray-400 space-y-1">
        <p>Meeting notes from today...</p>
        <p className="text-gray-300">Start typing to edit...</p>
      </div>
    </div>
  );
}

function InputBarPreview({ placeholder }: any) {
  return (
    <div className="flex h-full w-full gap-1.5 rounded-lg border bg-white p-1">
      <input type="text" placeholder={placeholder || 'Type a message...'} className="min-w-0 flex-1 rounded border border-gray-200 px-2 text-xs" readOnly />
      <button className="rounded bg-blue-600 px-3 text-xs text-white">Send</button>
    </div>
  );
}

function isPreviewRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPreviewText(props: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return fallback;
}

function getPreviewNumber(props: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function getPreviewArray(props: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = props[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return undefined;
}

function getPreviewItemLabel(item: unknown): string {
  if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
    return String(item);
  }

  if (isPreviewRecord(item)) {
    return getPreviewText(item, ['label', 'title', 'text', 'name', 'value'], 'Item');
  }

  return 'Item';
}

function getPreviewCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getPreviewDirectionLabel(direction: string): { label: string; className: string } | null {
  const normalized = direction.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === 'up' || normalized === 'increase' || normalized === 'positive') {
    return { label: 'Up', className: 'text-emerald-600' };
  }

  if (normalized === 'down' || normalized === 'decrease' || normalized === 'negative') {
    return { label: 'Down', className: 'text-red-600' };
  }

  if (normalized === 'flat' || normalized === 'neutral' || normalized === 'steady') {
    return { label: 'Flat', className: 'text-gray-500' };
  }

  return { label: formatPreviewLabel(normalized), className: 'text-gray-500' };
}

function formatPreviewLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPreviewTrend(props: Record<string, unknown>): { text: string; className: string } | null {
  const change = getPreviewText(props, ['change'], '');
  const direction = getPreviewText(props, ['change_direction', 'changeDirection'], '');
  const directionInfo = direction ? getPreviewDirectionLabel(direction) : null;

  if (!change && !directionInfo) {
    return null;
  }

  if (change) {
    return {
      text: directionInfo ? `${directionInfo.label} ${change}` : change,
      className: directionInfo?.className ?? 'text-gray-500',
    };
  }

  return {
    text: directionInfo?.label ?? '',
    className: directionInfo?.className ?? 'text-gray-500',
  };
}

function getPreviewFieldLabel(field: unknown, index: number): string {
  if (!isPreviewRecord(field)) {
    return getPreviewItemLabel(field);
  }

  const label = getPreviewText(field, ['label', 'title', 'text', 'name', 'placeholder'], `Field ${index + 1}`);
  const fieldType = getPreviewText(field, ['type', 'kind', 'componentType', 'inputType'], '');

  if (!fieldType || fieldType.toLowerCase() === label.toLowerCase()) {
    return label;
  }

  return `${label} (${fieldType})`;
}

function summarizePreviewAction(action: unknown): string | null {
  if (!isPreviewRecord(action)) {
    return null;
  }

  const actionType = getPreviewText(action, ['type'], 'action');
  const details: string[] = [];

  const functionName = getPreviewText(action, ['function'], '');
  if (functionName) {
    details.push(`function ${functionName}`);
  }

  const screen = getPreviewText(action, ['screen'], '');
  if (screen) {
    details.push(`screen ${screen}`);
  }

  const target = getPreviewText(action, ['target', 'targetId'], '');
  if (target) {
    details.push(`target ${target}`);
  }

  const url = getPreviewText(action, ['url'], '');
  if (url) {
    details.push(url.length > 40 ? `${url.slice(0, 37)}...` : url);
  }

  const params = action.params;
  if (Array.isArray(params)) {
    details.push(getPreviewCountLabel(params.length, 'param'));
  } else if (isPreviewRecord(params)) {
    const paramKeys = Object.keys(params);
    if (paramKeys.length > 0) {
      details.push(`params: ${paramKeys.slice(0, 3).join(', ')}${paramKeys.length > 3 ? ', ...' : ''}`);
    }
  }

  const content = getPreviewText(action, ['message', 'content'], '');
  if (content) {
    details.push(content.length > 40 ? `${content.slice(0, 37)}...` : content);
  }

  return details.length > 0 ? `${actionType} • ${details.join(' • ')}` : actionType;
}

function clampProgress(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

function IconButtonPreview(props: Record<string, unknown>) {
  const label = getPreviewText(props, ['label', 'text', 'title'], 'Icon Button');
  const icon = getPreviewText(props, ['icon', 'name', 'symbol'], '⭐');

  return (
    <button className="flex h-full w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm">
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function SpacerPreview(props: Record<string, unknown>) {
  const height = Math.max(8, getPreviewNumber(props, ['height', 'size', 'spacing', 'space']) ?? 24);

  return (
    <div
      className="flex items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400"
      style={{ minHeight: height }}
    >
      Spacer {height}px
    </div>
  );
}

function CardPreview({ children, ...rawProps }: { children?: EditorComponent[] } & Record<string, unknown>) {
  const title = getPreviewText(rawProps, ['title', 'label', 'heading', 'header'], 'Card');
  const subtitle = getPreviewText(rawProps, ['subtitle']);
  const body = getPreviewText(rawProps, ['text', 'content', 'description', 'body']);
  const childSummary = children && children.length > 0 ? getPreviewCountLabel(children.length, 'child component') : '';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-sm font-semibold text-gray-800">{title}</div>
      {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
      <div className="mt-1 text-xs text-gray-500">
        {body || childSummary || 'Legacy card content'}
      </div>
    </div>
  );
}

function ListPreview({ children, ...rawProps }: { children?: EditorComponent[] } & Record<string, unknown>) {
  const items = getPreviewArray(rawProps, ['items', 'data']) ?? [];
  const previewItems = items.slice(0, 3).map((item, index) => ({
    id: `preview-list-item-${index}`,
    label: getPreviewItemLabel(item),
  }));
  const childCount = children?.length ?? 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-sm font-semibold text-gray-800">List</div>
      <div className="mt-2 space-y-2 text-xs text-gray-600">
        {previewItems.length > 0 && previewItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            <span>{item.label}</span>
          </div>
        ))}
        {previewItems.length === 0 && childCount > 0 && (
          <div>{getPreviewCountLabel(childCount, 'child component')}</div>
        )}
        {previewItems.length === 0 && childCount === 0 && (
          <div className="text-gray-400">No list items in payload</div>
        )}
      </div>
    </div>
  );
}

function FormPreview(props: Record<string, unknown>) {
  const title = getPreviewText(props, ['title', 'heading', 'label', 'name'], 'Legacy Form');
  const description = getPreviewText(props, ['description', 'text', 'content']);
  const fields = getPreviewArray(props, ['fields', 'components', 'items']) ?? [];
  const previewFields = fields.slice(0, 3).map((field, index) => ({
    id: `preview-form-field-${index}`,
    label: getPreviewFieldLabel(field, index),
  }));
  const remainingFieldCount = Math.max(fields.length - previewFields.length, 0);
  const submitLabel = getPreviewText(props, ['submitLabel', 'submit_label', 'buttonLabel', 'actionLabel'], '');
  const submitActionSummary = summarizePreviewAction(props.submit_action ?? props.action ?? props.onSubmit);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Read-only legacy form payload</div>
        </div>
        <div className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700">
          {fields.length > 0 ? getPreviewCountLabel(fields.length, 'field') : 'No fields'}
        </div>
      </div>

      {description && <div className="mt-2 text-xs text-gray-600">{description}</div>}

      <div className="mt-3 space-y-2">
        {previewFields.length > 0 ? previewFields.map((field) => (
          <div key={field.id} className="rounded-md border border-amber-100 bg-white/80 px-2.5 py-2 text-xs text-gray-700">
            {field.label}
          </div>
        )) : (
          <div className="rounded-md border border-dashed border-amber-200 bg-white/60 px-2.5 py-2 text-xs text-gray-500">
            No field definitions were found in this payload.
          </div>
        )}

        {remainingFieldCount > 0 && (
          <div className="text-[11px] text-gray-500">+{remainingFieldCount} more {remainingFieldCount === 1 ? 'field' : 'fields'}</div>
        )}
      </div>

      {(submitLabel || submitActionSummary) && (
        <div className="mt-3 rounded-md border border-amber-100 bg-white/80 px-2.5 py-2">
          {submitLabel && <div className="text-xs font-medium text-gray-700">{submitLabel}</div>}
          {submitActionSummary && (
            <div className={`text-[11px] text-gray-500${submitLabel ? ' mt-0.5' : ''}`}>{submitActionSummary}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ListItemPreview(props: Record<string, unknown>) {
  const title = getPreviewText(props, ['title', 'label', 'text', 'name'], 'List Item');
  const subtitle = getPreviewText(props, ['subtitle', 'description', 'detail']);
  const trailing = getPreviewText(props, ['right_text', 'rightText', 'value', 'badge', 'meta']);

  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div>
        <div className="text-sm font-medium text-gray-800">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
      </div>
      {trailing && <div className="ml-3 text-xs text-gray-400">{trailing}</div>}
    </div>
  );
}

function AlertPreview(props: Record<string, unknown>) {
  const tone = getPreviewText(props, ['variant', 'severity', 'type'], 'info').toLowerCase();
  const message = getPreviewText(props, ['message', 'text', 'content', 'title'], 'Alert');
  const toneClasses: Record<string, string> = {
    error: 'border-red-200 bg-red-50 text-red-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  };

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${toneClasses[tone] || toneClasses.info}`}>
      {message}
    </div>
  );
}

function BadgePreview(props: Record<string, unknown>) {
  const label = getPreviewText(props, ['label', 'text', 'title', 'value'], 'Badge');

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
      {label}
    </span>
  );
}

function StatPreview(props: Record<string, unknown>) {
  const label = getPreviewText(props, ['label', 'title', 'name'], 'Stat');
  const value = getPreviewText(props, ['value', 'stat', 'amount', 'number'], '--');
  const trend = getPreviewTrend(props);
  const detail = trend?.text ?? getPreviewText(props, ['detail', 'subtitle']);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-800">{value}</div>
      {detail && <div className={`mt-1 text-xs ${trend?.className ?? 'text-gray-500'}`}>{detail}</div>}
    </div>
  );
}

function StatsRowPreview({ children, ...rawProps }: { children?: EditorComponent[] } & Record<string, unknown>) {
  const stats = getPreviewArray(rawProps, ['stats', 'items']) ?? [];
  const previewStats = stats.slice(0, 3).map((stat, index) => {
    if (isPreviewRecord(stat)) {
      const trend = getPreviewTrend(stat);

      return {
        id: `preview-stat-${index}`,
        label: getPreviewText(stat, ['label', 'title', 'name'], 'Stat'),
        value: getPreviewText(stat, ['value', 'stat', 'amount', 'number'], '--'),
        trend,
      };
    }

    return {
      id: `preview-stat-${index}`,
      label: 'Stat',
      value: getPreviewItemLabel(stat),
      trend: null,
    };
  });
  const childCount = children?.length ?? 0;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-white p-3">
      {previewStats.length > 0 && previewStats.map((stat) => (
        <div key={stat.id} className="rounded-md bg-gray-50 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{stat.label}</div>
          <div className="mt-1 text-sm font-semibold text-gray-800">{stat.value}</div>
          {stat.trend && <div className={`mt-1 text-[11px] ${stat.trend.className}`}>{stat.trend.text}</div>}
        </div>
      ))}
      {previewStats.length === 0 && childCount > 0 && (
        <div className="col-span-3 text-xs text-gray-500">{getPreviewCountLabel(childCount, 'child component')}</div>
      )}
      {previewStats.length === 0 && childCount === 0 && (
        <div className="col-span-3 text-xs text-gray-400">No stats in payload</div>
      )}
    </div>
  );
}

function ProgressPreview(props: Record<string, unknown>) {
  const label = getPreviewText(props, ['label', 'title', 'text'], 'Progress');
  const current = getPreviewNumber(props, ['value', 'progress', 'current', 'percent']) ?? 0;
  const max = getPreviewNumber(props, ['max', 'total']) ?? (current > 1 ? 100 : 1);
  const percent = clampProgress(max > 1 ? (current / max) * 100 : current * 100);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between text-xs font-medium text-gray-600">
        <span>{label}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TodoPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-sm font-bold mb-2">✓ To-Do</div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <input type="checkbox" className="rounded" readOnly />
          <span>Complete project</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" defaultChecked className="rounded" readOnly />
          <span className="line-through text-gray-400">Review code</span>
        </div>
      </div>
    </div>
  );
}

function ArticleCardPreview({ title, description, imageUrl }: any) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {imageUrl && (
        <div className="h-32 bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
          📷 {imageUrl}
        </div>
      )}
      <div className="p-3">
        <div className="text-sm font-bold mb-1">{title || 'Article Title'}</div>
        <div className="text-xs text-gray-600">{description || 'Article summary...'}</div>
      </div>
    </div>
  );
}

function RichTextRendererPreview({ content }: any) {
  return (
    <div className="text-sm text-gray-700 leading-relaxed">
      {content || 'Rich text content...'}
    </div>
  );
}

function ContainerPreview({
  direction,
  gap,
  padding,
  backgroundColor,
  borderRadius,
  shadow,
  children,
}: {
  direction?: 'row' | 'column';
  gap?: number;
  padding?: number;
  backgroundColor?: string;
  borderRadius?: number;
  shadow?: 'sm' | 'md' | 'lg';
  children?: EditorComponent[];
}) {
  const shadowStyles: Record<string, string> = {
    sm: '0 1px 3px rgba(15, 23, 42, 0.12)',
    md: '0 8px 24px rgba(15, 23, 42, 0.14)',
    lg: '0 18px 40px rgba(15, 23, 42, 0.18)',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction || 'column',
        gap: gap ?? 0,
        padding: padding ?? 0,
        backgroundColor: backgroundColor || '#F8FAFC',
        borderRadius: borderRadius || 0,
        boxShadow: shadow ? shadowStyles[shadow] : undefined,
        minHeight: 48,
        width: '100%',
        height: '100%',
        flex: 1,
      }}
    >
      {children && children.length > 0 ? (
        children.map((child) => <ComponentPreview key={child.id} component={child} />)
      ) : (
        <div className="text-xs italic text-gray-400">Empty container</div>
      )}
    </div>
  );
}

// FF4-ROW-023: Simplified EmptyPreview — no gap/padding/background controls.
// FF4-EC-001: Vertical flex container with component fitting.
function EmptyPreview({ children }: { gap?: number; padding?: number; backgroundColor?: string; children?: EditorComponent[] }) {
  return (
    <div className="flex flex-col min-h-[48px] flex-1 w-full border border-dashed border-gray-200 rounded">
      {children && children.length > 0 ? (
        children.map((child) => (
          <div key={child.id} className="flex-1 w-full" style={{ minHeight: 0 }}>
            <ComponentPreview component={child} />
          </div>
        ))
      ) : (
        <div className="flex items-center justify-center flex-1 text-xs italic text-gray-400">Empty container</div>
      )}
    </div>
  );
}

const PREVIEW_RENDERERS: Record<string, (props: any) => JSX.Element> = {
  Text: TextPreview,
  Markdown: TextPreview, // Markdown merged into Text
  Button: ButtonPreview,
  Image: ImagePreview,
  Icon: IconPreview,
  Divider: DividerPreview,
  Container: ContainerPreview,
  CalendarModule: CalendarPreview,
  ChatModule: ChatPreview,
  NotesModule: NotesPreview,
  InputBar: InputBarPreview,
  Todo: TodoPreview,
  TodoModule: TodoPreview,
  todo: TodoPreview,
  ArticleCard: ArticleCardPreview,
  ArticleCardModule: ArticleCardPreview,
  article_card: ArticleCardPreview,
  RichTextRenderer: RichTextRendererPreview,
  rich_text_renderer: RichTextRendererPreview,
  RichText: RichTextRendererPreview,
  Empty: EmptyPreview,
  icon_button: IconButtonPreview,
  spacer: SpacerPreview,
  card: CardPreview,
  list: ListPreview,
  form: FormPreview,
  list_item: ListItemPreview,
  alert: AlertPreview,
  badge: BadgePreview,
  stat: StatPreview,
  stats_row: StatsRowPreview,
  progress: ProgressPreview,
};

function ComponentPreview({ component }: { component: EditorComponent }) {
  // Warn if the type is not in the registry (type guard — does not crash)
  assertRegisteredComponentType(component.type);

  const Renderer = PREVIEW_RENDERERS[component.type];
  if (Renderer) {
    return (
      <div className={FIT_CELL_CLASS} style={FIT_CELL_STYLE}>
        <Renderer {...component.props} children={component.children} />
      </div>
    );
  }
  return <div className="text-xs text-gray-400 italic p-2">Unknown: {component.type}</div>;
}

function resolveRowHeight(rowHeight: EditorRowHeight, previewHeight?: number): EditorRowHeight {
  if (typeof previewHeight === 'number') {
    return previewHeight;
  }
  return rowHeight;
}

function getRowContainerStyle(row: EditorRow, previewHeight?: number): CSSProperties {
  const resolvedHeight = resolveRowHeight(row.height, previewHeight);
  const rowMinHeight = getRowMinHeight(row);
  const style: CSSProperties = {
    minHeight: typeof resolvedHeight === 'number' ? Math.max(rowMinHeight, resolvedHeight) : rowMinHeight,
    display: 'flex',
    flexDirection: 'column',
  };

  if (typeof resolvedHeight === 'number') {
    style.height = Math.max(rowMinHeight, resolvedHeight);
  }

  return style;
}

function getRowContentStyle(row: EditorRow): CSSProperties {
  const rowType = row.type ?? 'content';

  // Divider and spacer rows don't use flex cell layout
  if (rowType === 'divider') {
    return {
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
    };
  }

  if (rowType === 'spacer') {
    return {
      display: 'flex',
      flex: '1 1 auto',
    };
  }

  const style: CSSProperties = {
    display: 'flex',
    flex: '1 1 auto',
    minHeight: 0,
    // Only enable scrolling if explicitly set to true
    overflowX: row.scrollable === true ? 'auto' : 'hidden',
    overflowY: 'hidden',
  };

  // Bottom divider as CSS border on the cells container
  if (row.showDivider) {
    const thickness = typeof row.dividerThickness === 'number' ? row.dividerThickness : 1;
    const color = row.dividerColor || '#E0E0E0';
    const margin = typeof row.dividerMargin === 'number' ? row.dividerMargin : 0;
    style.borderBottom = `${thickness}px solid ${color}`;
    if (margin > 0) {
      style.marginBottom = margin;
    }
  }

  return style;
}

function getRowMinHeight(row: EditorRow): number {
  const rowType = row.type ?? 'content';

  if (rowType === 'divider') {
    return 32; // Compact height for divider rows
  }

  if (rowType === 'spacer') {
    return Math.max(8, typeof row.spacerHeight === 'number' ? row.spacerHeight : 24);
  }

  return MIN_ROW_HEIGHT;
}

function getNumericCellWidth(width: EditorCell['width']): number {
  if (typeof width === 'string' && width.endsWith('%')) {
    const parsed = parseFloat(width);
    return isNaN(parsed) ? 1 : parsed;
  }
  return typeof width === 'number' ? width : 1;
}

function getCellStyle(row: EditorRow, cellWidth: EditorCell['width'], totalWidth: number): CSSProperties {
  const baseStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    alignSelf: 'stretch', // Ensure cell stretches to row height
  };

  if (row.scrollable === true) {
    return {
      ...baseStyle,
      flex: '0 0 auto',
      width: `${Math.max(getNumericCellWidth(cellWidth) * SCROLLABLE_CELL_WIDTH, SCROLLABLE_CELL_MIN_WIDTH)}px`,
      minWidth: SCROLLABLE_CELL_MIN_WIDTH,
    };
  }

  if (cellWidth === 'auto') {
    return {
      ...baseStyle,
      flex: '1 1 0%',
      minWidth: MIN_CELL_WIDTH_PX,
    };
  }

  // Handle percentage widths (preferred in Phase 2)
  if (typeof cellWidth === 'string' && cellWidth.endsWith('%')) {
    const percent = parseFloat(cellWidth);
    const clampedPercent = Math.max(MIN_CELL_WIDTH_PERCENT, Math.min(100, percent));
    return {
      ...baseStyle,
      flex: `0 0 ${clampedPercent}%`,
      width: `${clampedPercent}%`,
      minWidth: MIN_CELL_WIDTH_PX,
    };
  }

  // Handle legacy numeric flex weights (deprecated — convert to percentage)
  const cellPercent = (getNumericCellWidth(cellWidth) / totalWidth) * 100;
  const clampedPercent = Math.max(MIN_CELL_WIDTH_PERCENT, Math.min(100, cellPercent));

  return {
    ...baseStyle,
    flex: `0 0 ${clampedPercent}%`,
    width: `${clampedPercent}%`,
    minWidth: MIN_CELL_WIDTH_PX,
  };
}

// ── Cell Resize Handle ──────────────────────────────────────────────────────

function CellResizeHandle({
  rowId,
  cellIndex,
  leftWidth,
  rightWidth,
  onCommit,
  rowWidthPx,
}: {
  rowId: string;
  cellIndex: number;
  leftWidth: number;
  rightWidth: number;
  onCommit: (rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => void;
  rowWidthPx: number;
}) {
  const startXRef = useRef(0);
  const startLeftWidthRef = useRef(1);
  const totalWidthRef = useRef(2);
  const hasMovedRef = useRef(false);
  const nextWidthsRef = useRef({ left: 1, right: 1 });
  const leftCellRef = useRef<HTMLElement | null>(null);
  const rightCellRef = useRef<HTMLElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const leftCell = e.currentTarget.parentElement;
    const rightCell = leftCell?.nextElementSibling as HTMLElement | null;
    if (!leftCell || !rightCell) return;

    leftCellRef.current = leftCell;
    rightCellRef.current = rightCell;

    startXRef.current = e.clientX;
    startLeftWidthRef.current = leftWidth;
    totalWidthRef.current = leftWidth + rightWidth;
    hasMovedRef.current = false;
    nextWidthsRef.current = {
      left: startLeftWidthRef.current,
      right: totalWidthRef.current - startLeftWidthRef.current,
    };
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (ev: MouseEvent) => {
      // Convert pixel delta to percentage of row width
      const pxDelta = ev.clientX - startXRef.current;
      const rowWidth = rowWidthPx || 390; // Fallback to default if 0
      const pctDelta = (pxDelta / rowWidth) * 100;

      const minPct = MIN_CELL_PERCENT_FOR_DRAG;
      const maxLeft = Math.max(minPct, totalWidthRef.current - minPct);
      const nextLeft = Math.min(
        maxLeft,
        Math.max(minPct, Math.round((startLeftWidthRef.current + pctDelta) * 100) / 100),
      );
      const nextRight = Math.round((totalWidthRef.current - nextLeft) * 100) / 100;

      hasMovedRef.current = true;
      nextWidthsRef.current = { left: nextLeft, right: nextRight };

      // FF4-CELL-001: Direct DOM updates — React state on pointermove caused divider lag/jumps
      if (leftCellRef.current && rightCellRef.current) {
        applyCellWidthStyles(leftCellRef.current, nextLeft);
        applyCellWidthStyles(rightCellRef.current, nextRight);
      }
    };

    const handleMouseUp = () => {
      document.body.style.removeProperty('cursor');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (leftCellRef.current && rightCellRef.current) {
        clearCellWidthStyles(leftCellRef.current);
        clearCellWidthStyles(rightCellRef.current);
        leftCellRef.current = null;
        rightCellRef.current = null;
      }

      if (hasMovedRef.current) {
        onCommit(rowId, cellIndex, nextWidthsRef.current.left, nextWidthsRef.current.right);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cellIndex, leftWidth, onCommit, rightWidth, rowId, rowWidthPx]);

  return (
    <div
      data-testid={`cell-resize-handle-${rowId}-${cellIndex}`}
      className="absolute top-0 -right-1.5 z-10 h-full w-3 cursor-col-resize group"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute top-0 right-1.5 h-full w-1 transition-colors hover:bg-blue-400" />
    </div>
  );
}

// ── Row Drag Handle ──────────────────────────────────────────────────────────
// FF4-ROW-001: 6-dot drag handle positioned visibly to the left of each row.
// Uses GripVertical from lucide-react. Opacity transitions on row hover.

function RowDragHandle({
  isDragging,
  attributes,
  listeners,
  testId,
}: {
  isDragging: boolean;
   
  attributes: Record<string, any>;
   
  listeners: Record<string, any> | undefined;
  testId?: string;
}) {
  return (
    <div
      {...attributes}
      {...listeners}
      data-testid={testId}
      className={`absolute z-10 flex select-none items-center justify-center transition-opacity touch-none rounded-l-md ${
        isDragging
          ? 'opacity-100 cursor-grabbing bg-blue-50'
          : 'opacity-0 cursor-grab group-hover:opacity-100 hover:bg-gray-100'
      }`}
      style={{
        left: ROW_DRAG_HANDLE_OFFSET,
        top: 0,
        bottom: 0,
        width: ROW_DRAG_HANDLE_WIDTH,
      }}
      title="Drag to reorder row"
    >
      <Grip size={14} className={isDragging ? 'text-blue-500' : 'text-gray-400'} />
    </div>
  );
}

function RowHeightResizeHandle({
  rowId,
  onCommit,
}: {
  rowId: string;
  onCommit: (rowId: string, height: number) => void;
}) {
  const startYRef = useRef(0);
  const startHeightRef = useRef(MIN_ROW_HEIGHT);
  const nextHeightRef = useRef(MIN_ROW_HEIGHT);
  const hasMovedRef = useRef(false);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const rowElement = e.currentTarget.parentElement;
    if (!rowElement) return;

    rowRef.current = rowElement as HTMLDivElement;
    startYRef.current = e.clientY;
    startHeightRef.current = rowElement.getBoundingClientRect().height;
    nextHeightRef.current = Math.max(MIN_ROW_HEIGHT, Math.round(startHeightRef.current));
    hasMovedRef.current = false;
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientY - startYRef.current;
      const rawHeight = Math.round(startHeightRef.current + delta);

      // Stop drag at minimum — prevent bounce instead of clamping
      if (rawHeight < MIN_ROW_HEIGHT) {
        // Snap to minimum and don't move further
        if (rowRef.current) {
          rowRef.current.style.height = MIN_ROW_HEIGHT + 'px';
          rowRef.current.style.minHeight = MIN_ROW_HEIGHT + 'px';
        }
        nextHeightRef.current = MIN_ROW_HEIGHT;
        return;
      }

      hasMovedRef.current = true;
      nextHeightRef.current = rawHeight;

      // FF4-ROW-002: Direct DOM manipulation only — onPreview/React state caused full-canvas re-renders and lag
      if (rowRef.current) {
        rowRef.current.style.height = rawHeight + 'px';
        rowRef.current.style.minHeight = rawHeight + 'px';
      }
    };

    const handleMouseUp = () => {
      document.body.style.removeProperty('cursor');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Clear direct DOM override — let React take over
      if (rowRef.current) {
        rowRef.current.style.height = '';
        rowRef.current.style.minHeight = '';
        rowRef.current = null;
      }

      if (hasMovedRef.current) {
        onCommit(rowId, nextHeightRef.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rowId, onCommit]);

  return (
    <div
      data-testid="row-height-resize-handle"
      className="absolute inset-x-0 bottom-0 z-20 flex h-4 cursor-row-resize items-end justify-center hover:bg-blue-50/30 transition-colors"
      onMouseDown={handleMouseDown}
      title="Resize row height"
    >
      <div className="mb-1 h-1 w-16 rounded-full bg-gray-300 transition-colors group-hover:bg-blue-400" />
    </div>
  );
}

// ── Row Insertion Control ───────────────────────────────────────────────────
// Clicking "Add Row" immediately commits a 1-cell row. The cell count can be
// adjusted afterwards via the Property Inspector (setCellCount). This avoids
// the picker → cancel flow that previously left no committed row but confused
// users who expected the row to persist after the popover closed.

function RowInsertionControl({
  onAdd,
  between,
}: {
  onAdd: (cellCount: number) => void;
  between?: boolean;
}) {
  return (
    <div
      className={`relative z-10 flex items-center justify-center pointer-events-none ${between ? 'h-10 py-1' : 'py-3'}`}
    >
      {between && (
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-200" />
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onAdd(1); }}
        className={`pointer-events-auto relative z-10 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
          between
            ? 'border shadow-sm bg-white border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
        }`}
      >
        <Plus size={12} />
        Add Row
      </button>
    </div>
  );
}

// ── Sortable Row ─────────────────────────────────────────────────────────────

function SortableRow({
  row, rowIdx, isRowSelected, isCellSelected,
  handleEmptyCellClick, handleComponentClick,
  handleCellResizeCommit,
  handleRowResizeCommit,
  addRow, deleteRow, setSelection, copySelection, removeComponent,
  deviceWidth,
}: {
  row: EditorRow;
  rowIdx: number;
  isRowSelected: boolean;
  isCellSelected: (rowId: string, cellIdx: number) => boolean;
  handleEmptyCellClick: (rowId: string, cellIndex: number, e: React.MouseEvent) => void;
  handleComponentClick: (rowId: string, cellIndex: number, e: React.MouseEvent) => void;
  handleCellResizeCommit: (rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => void;
  handleRowResizeCommit: (rowId: string, height: number) => void;
  addRow: (cellCount?: number, index?: number) => void;
  deleteRow: (rowId: string) => void;
  setSelection: (sel: import('./types').Selection | null) => void;
  copySelection: () => void;
  removeComponent: (rowId: string, cellIndex: number) => void;
  deviceWidth: number;
}) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id: row.id });

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setSelection({ type: 'row', rowId: row.id });
  };

  const handleAddRowAbove = (rowId: string) => {
    const idx = useEditorStore.getState().rows.findIndex(r => r.id === rowId);
    addRow(1, idx >= 0 ? idx : 0);
  };

  const handleAddRowBelow = (rowId: string) => {
    const idx = useEditorStore.getState().rows.findIndex(r => r.id === rowId);
    addRow(1, idx >= 0 ? idx + 1 : useEditorStore.getState().rows.length);
  };

  const handleDuplicateRow = (rowId: string) => {
    useEditorStore.getState().duplicateRow(rowId);
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Insert point before first row */}
      {rowIdx === 0 && (
        <RowInsertionControl onAdd={(n) => addRow(n, 0)} between />
      )}

      {/* Row */}
      <div
        className={`relative z-0 group rounded-lg transition-all mb-1 border ${
          isDragging ? 'opacity-60 ring-1 ring-blue-200 border-blue-200' : ''
        } ${
          isRowSelected
            ? 'ring-2 ring-blue-500 border-blue-300 bg-white'
            : `border-gray-300 hover:border-gray-400 hover:ring-1 hover:ring-gray-300 bg-white`
        }`}
        style={getRowContainerStyle(row)}
        onClick={(e) => { e.stopPropagation(); setSelection({ type: 'row', rowId: row.id }); }}
        onContextMenu={handleContextMenu}
      >
        {/* Drag handle */}
        <RowDragHandle testId={`row-drag-handle-${row.id}`} isDragging={isDragging} attributes={attributes} listeners={listeners} />

        {/* Delete row button - top-LEFT outside content area (moved from right to prevent overlap with cell delete) */}
        {/* m3: Use -left-1 instead of -left-2.5 to prevent clipping by phone frame overflow-hidden */}
        <button
          data-testid={`btn-delete-row-${row.id}`}
          className="absolute -left-1 -top-2.5 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-600 shadow-md"
          onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}
          title="Delete row"
        >
          <X size={12} />
        </button>

        {/* Cells container — FF4-ROW-008: apply side padding when all cells fixed and total < 100% */}
        {(() => {
          const rowType = row.type ?? 'content';
          const isContent = rowType === 'content';
          const sidePaddingPct = isContent && row.cells.length > 0
            ? calculateSidePadding(row.cells.map(c => ({ id: c.id, width: c.width })))
            : 0;
          const paddingStyle = sidePaddingPct > 0
            ? { paddingLeft: `${(sidePaddingPct * 100) / 2}%`, paddingRight: `${(sidePaddingPct * 100) / 2}%` }
            : {};
          const containerStyle = { ...getRowContentStyle(row), ...paddingStyle };
          return (
        <div className="flex min-h-[48px] flex-1 items-stretch" style={containerStyle}>
          {(() => {
            if (rowType === 'divider') {
              return (
                <div className="flex-1 px-3">
                  <DividerPreview
                    color={row.dividerColor}
                    thickness={row.dividerThickness}
                    margin={0}
                  />
                </div>
              );
            }

            if (rowType === 'spacer') {
              const spacerHeight = Math.max(8, typeof row.spacerHeight === 'number' ? row.spacerHeight : 24);
              return (
                <div
                  className="flex-1 flex items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400 mx-3"
                  style={{ minHeight: spacerHeight }}
                >
                  Spacer {spacerHeight}px
                </div>
              );
            }

            // content type — render cells normally
            return row.cells.map((cell, cellIdx) => {
              const resolvedWidths = calculateCellWidths(
                row.cells.map((entry) => ({ id: entry.id, width: entry.width })),
              );
              const leftResolved = resolvedWidths.find((entry) => entry.cellId === cell.id)?.widthPercent
                ?? getNumericCellWidth(cell.width);
              const rightCell = row.cells[cellIdx + 1];
              const rightResolved = rightCell
                ? resolvedWidths.find((entry) => entry.cellId === rightCell.id)?.widthPercent
                  ?? getNumericCellWidth(rightCell.width)
                : 1;
              const displayedWidth = cell.width;
              const componentInfo = cell.content ? getComponentDefinition(cell.content.type) : undefined;
              const isReadOnlyRuntimeComponent = componentInfo?.readOnly === true;

              return (
                <div
                  key={cell.id}
                  className={`relative flex min-h-0 flex-col rounded transition-all ${
                    isCellSelected(row.id, cellIdx)
                      ? 'ring-2 ring-blue-400 bg-blue-50/50'
                      : cell.content ? 'bg-white shadow-sm' : 'bg-gray-50 border border-dashed border-gray-300 p-2'
                  }`}
                  style={getCellStyle(row, displayedWidth, resolvedWidths.reduce((sum, entry) => sum + entry.widthPercent, 0))}
                >
                  {cell.content ? (
                    <div
                      className="cursor-pointer relative group/cell flex-1 flex flex-col min-h-0"
                      onClick={(e) => handleComponentClick(row.id, cellIdx, e)}
                    >
                      {/* Delete cell button - top-left corner (FF4-CELL-002: both row and cell delete on left, no overlap) */}
                      <button
                        data-testid={`btn-delete-cell-${row.id}-${cellIdx}`}
                        className="absolute -left-1.5 -top-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/cell:opacity-100 transition-opacity z-30 hover:bg-red-600 shadow-md"
                        onClick={(e) => { e.stopPropagation(); removeComponent(row.id, cellIdx); }}
                        title="Delete component"
                      >
                        <X size={10} />
                      </button>

                      {/* Floating toolbar */}
                      <div className="absolute -top-6 left-0 right-0 flex items-center gap-0.5 justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-20">
                        <button
                          className={`p-1 bg-white border border-gray-200 rounded shadow-sm text-[9px] ${
                            isReadOnlyRuntimeComponent
                              ? 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              : 'text-gray-500 hover:text-blue-600 hover:border-blue-300'
                          }`}
                          onClick={(e) => handleComponentClick(row.id, cellIdx, e)}
                          title={isReadOnlyRuntimeComponent ? 'Inspect' : 'Edit'}
                        >
                          {isReadOnlyRuntimeComponent ? <Eye size={9} /> : <Edit2 size={9} />}
                        </button>
                        <button
                          className="p-1 bg-white border border-gray-200 rounded shadow-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 text-[9px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelection({ type: 'component', rowId: row.id, cellIndex: cellIdx });
                            copySelection();
                          }}
                          title="Copy"
                        >
                          <Copy size={9} />
                        </button>
                      </div>

                      {/* Component preview — FF4-ROW-012/FF4-CELL-004: fill entire cell */}
                      <div className={`pointer-events-none overflow-hidden ${FIT_CELL_CLASS}`} style={FIT_CELL_STYLE}>
                        <ComponentPreview component={cell.content} />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center flex-1 min-h-[40px] cursor-pointer hover:bg-blue-50 hover:border-blue-300 rounded transition-colors"
                      onClick={(e) => handleEmptyCellClick(row.id, cellIdx, e)}
                    >
                      <Plus size={16} className="text-gray-300" />
                    </div>
                  )}

                  {/* Cell resize handle (between cells, not on last) */}
                  {cellIdx < row.cells.length - 1 && (
                    <CellResizeHandle
                      rowId={row.id}
                      cellIndex={cellIdx}
                      leftWidth={leftResolved}
                      rightWidth={rightResolved}
                      onCommit={handleCellResizeCommit}
                      rowWidthPx={deviceWidth}
                    />
                  )}
                </div>
              );
            });
          })()}
        </div>
      );
    })()}

        <RowHeightResizeHandle
          rowId={row.id}
          onCommit={handleRowResizeCommit}
        />
      </div>

      {/* Row context menu */}
      {contextMenu && (
        <RowContextMenu
          rowId={row.id}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onDeleteRow={deleteRow}
          onDuplicateRow={handleDuplicateRow}
          onAddRowAbove={handleAddRowAbove}
          onAddRowBelow={handleAddRowBelow}
        />
      )}

      {/* Insert point after row */}
      <RowInsertionControl onAdd={(n) => addRow(n, rowIdx + 1)} between />
    </div>
  );
}

// ── Main Canvas Component ────────────────────────────────────────────────────

export function EditorCanvas() {
  const rows = useEditorStore(s => s.rows);
  const selection = useEditorStore(s => s.selection);
  const setSelection = useEditorStore(s => s.setSelection);
  const addRow = useEditorStore(s => s.addRow);
  const deleteRow = useEditorStore(s => s.deleteRow);
  const moveRow = useEditorStore(s => s.moveRow);
  const setComponent = useEditorStore(s => s.setComponent);
  const removeComponent = useEditorStore(s => s.removeComponent);
  const copySelection = useEditorStore(s => s.copySelection);
  const updateAdjacentCellWidths = useEditorStore(s => s.updateAdjacentCellWidths);
  const updateRowHeight = useEditorStore(s => s.updateRowHeight);
  const deviceWidth = useEditorStore(s => s.deviceWidth);
  const deviceHeight = useEditorStore(s => s.deviceHeight);

  const [pickerState, setPickerState] = useState<{ rowId: string; cellIndex: number; position: { x: number; y: number } } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleCellResizeCommit = useCallback((rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => {
    updateAdjacentCellWidths(rowId, cellIndex, leftWidth, rightWidth);
  }, [updateAdjacentCellWidths]);

  const isRowSelected = (rowId: string) => selection?.rowId === rowId && selection?.type === 'row';
  const isCellSelected = (rowId: string, cellIdx: number) =>
    selection?.rowId === rowId && selection?.cellIndex === cellIdx;

  const handleEmptyCellClick = (rowId: string, cellIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[EditorCanvas] empty cell clicked — row:', rowId, 'cell:', cellIndex);
    setSelection({ type: 'cell', rowId, cellIndex });
    setPickerState({ rowId, cellIndex, position: { x: e.clientX, y: e.clientY } });
  };

  const handleComponentClick = (rowId: string, cellIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[EditorCanvas] component clicked — row:', rowId, 'cell:', cellIndex);
    setSelection({ type: 'component', rowId, cellIndex });
  };

  const handlePickerSelect = (componentType: string) => {
    console.log('[EditorCanvas] component picker selected:', componentType);
    if (pickerState) {
      setComponent(pickerState.rowId, pickerState.cellIndex, componentType);
    }
    setPickerState(null);
  };

  const handleRowResizeCommit = useCallback((rowId: string, height: number) => {
    updateRowHeight(rowId, height);
  }, [updateRowHeight]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = rows.findIndex(r => r.id === active.id);
    const toIndex = rows.findIndex(r => r.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      console.log('[EditorCanvas] row dragged — from index:', fromIndex, 'to index:', toIndex);
      moveRow(fromIndex, toIndex);
    }
  }, [rows, moveRow]);

  const frameScale = Math.min(1, MAX_PREVIEW_WIDTH / deviceWidth, MAX_PREVIEW_HEIGHT / deviceHeight);
  const previewWidth = Math.round(deviceWidth * frameScale);
  const previewHeight = Math.round(deviceHeight * frameScale);

  return (
    <div data-testid="editor-canvas" className="h-full flex flex-col items-center bg-gray-100 overflow-auto p-6">
      {/* Device frame */}
      <div
        className="shrink-0"
        style={{ width: previewWidth, height: previewHeight }}
      >
        <div
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col"
          style={{
            width: deviceWidth,
            height: deviceHeight,
            transform: `scale(${frameScale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Phone status bar mock */}
          <div className="h-6 bg-gray-50 flex items-center justify-center">
            <div className="w-16 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Canvas content */}
          <div className="flex-1 overflow-y-auto p-2" onClick={() => setSelection(null)}>
            {rows.length === 0 && (
              <RowInsertionControl onAdd={(n) => addRow(n)} />
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {rows.map((row, rowIdx) => (
                  <SortableRow
                    key={row.id}
                    row={row}
                    rowIdx={rowIdx}
                    isRowSelected={isRowSelected(row.id)}
                    isCellSelected={isCellSelected}
                    handleEmptyCellClick={handleEmptyCellClick}
                    handleComponentClick={handleComponentClick}
                    handleCellResizeCommit={handleCellResizeCommit}
                    handleRowResizeCommit={handleRowResizeCommit}
                    addRow={addRow}
                    deleteRow={deleteRow}
                    setSelection={setSelection}
                    copySelection={copySelection}
                    removeComponent={removeComponent}
                    deviceWidth={deviceWidth}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Phone home indicator mock */}
          <div className="h-4 flex items-center justify-center">
            <div className="w-24 h-1 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>

      {/* Component picker popover */}
      {pickerState && (
        <ComponentPicker
          onSelect={handlePickerSelect}
          onClose={() => setPickerState(null)}
          position={pickerState.position}
        />
      )}
    </div>
  );
}
