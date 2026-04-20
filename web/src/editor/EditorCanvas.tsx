import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

import { ComponentPicker } from './ComponentPicker';
import { Plus, GripVertical, X, Edit2, Eye, Copy, Trash2 } from 'lucide-react';

const MIN_ROW_HEIGHT = 48;
const ROW_DRAG_HANDLE_WIDTH = 24;
const ROW_DRAG_HANDLE_MARGIN = 32; // Left margin space for drag handle
const DEFAULT_ROW_RIGHT_PADDING = 4;
const SCROLLABLE_CELL_WIDTH = 160;
const SCROLLABLE_CELL_MIN_WIDTH = 120;
const MAX_PREVIEW_WIDTH = 960;
const MAX_PREVIEW_HEIGHT = 1200;

// ── Component Preview Renderers ──────────────────────────────────────────────

function TextPreview({ content, variant, fontSize, fontWeight, color, align, bold, italic }: any) {
  const semanticStyle = variant === 'heading'
    ? { fontSize: 28, fontWeight: '700', lineHeight: 1.2 }
    : variant === 'caption'
      ? { fontSize: 12, fontWeight: '400', lineHeight: 1.4 }
      : { fontSize: 16, fontWeight: '400', lineHeight: 1.5 };

  const resolvedFontSize = typeof fontSize === 'number' ? fontSize : semanticStyle.fontSize;
  const resolvedFontWeight = (typeof fontWeight === 'string' && fontWeight.length > 0) || typeof fontWeight === 'number'
    ? String(fontWeight)
    : bold
      ? '700'
      : semanticStyle.fontWeight;

  return (
    <div style={{ fontSize: resolvedFontSize, fontWeight: resolvedFontWeight, fontStyle: italic ? 'italic' : 'normal', lineHeight: semanticStyle.lineHeight, color: color || '#000', textAlign: align || 'left', padding: '4px 0' }}>
      {content || 'Text'}
    </div>
  );
}

function ButtonPreview({ label, variant, size, icon }: any) {
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white', secondary: 'bg-gray-200 text-gray-800',
    ghost: 'bg-transparent text-gray-600', destructive: 'bg-red-600 text-white', icon: 'bg-transparent text-blue-600',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg',
    small: 'px-3 py-1 text-sm', medium: 'px-4 py-2', large: 'px-6 py-3 text-lg',
  };

  if (variant === 'icon') {
    return <button className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-600">{icon || '⭐'}</button>;
  }

  return (
    <button className={`rounded-md font-medium ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`}>
      {label || 'Button'}
    </button>
  );
}

function ImagePreview({ src, height, aspectRatio, borderRadius }: any) {
  return (
    <img
      src={src || 'https://via.placeholder.com/300x200'}
      alt=""
      style={{
        width: '100%',
        height: height || undefined,
        aspectRatio: aspectRatio || (height ? undefined : 16 / 9),
        borderRadius: borderRadius || 0,
        objectFit: 'cover',
      }}
    />
  );
}

function MarkdownPreview({ content }: any) {
  return <div className="prose prose-sm max-w-none" style={{ whiteSpace: 'pre-wrap' }}>{content || '# Heading\n\nParagraph'}</div>;
}

function DividerPreview({ color, thickness, margin }: any) {
  return <hr style={{ borderColor: color || '#E0E0E0', borderWidth: thickness ?? 1, margin: `${margin ?? 8}px 0` }} />;
}

function IconPreview({ name, size, color }: any) {
  return <span style={{ fontSize: size || 24, color: color || '#000' }}>⭐ {name || 'star'}</span>;
}

function TextInputPreview({ placeholder, multiline, value, secureTextEntry, options }: any) {
  const rawValue = value === undefined || value === null ? '' : String(value);
  const displayValue = secureTextEntry && rawValue ? '*'.repeat(Math.max(rawValue.length, 4)) : rawValue;
  const isSelectLike = Array.isArray(options) || typeof options === 'string';

  if (isSelectLike) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
        <span className={displayValue ? 'text-gray-700' : 'text-gray-400'}>{displayValue || placeholder || 'Select option'}</span>
        <span className="text-gray-400">v</span>
      </div>
    );
  }

  return (
    <div>
      {multiline ? (
        <textarea value={displayValue} placeholder={placeholder || 'Enter text...'} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" rows={3} readOnly />
      ) : (
        <input type="text" value={displayValue} placeholder={placeholder || 'Enter text...'} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" readOnly />
      )}
    </div>
  );
}

function CalendarPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
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
    <div className="bg-white rounded-lg border p-2 flex gap-1.5">
      <input type="text" placeholder={placeholder || 'Type a message...'} className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs" readOnly />
      <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs">Send</button>
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
    <button className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm">
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

const PREVIEW_RENDERERS: Record<string, (props: any) => JSX.Element> = {
  Text: TextPreview,
  Markdown: MarkdownPreview,
  Button: ButtonPreview,
  Image: ImagePreview,
  TextInput: TextInputPreview,
  Icon: IconPreview,
  Divider: DividerPreview,
  Container: ContainerPreview,
  CalendarModule: CalendarPreview,
  ChatModule: ChatPreview,
  NotesModule: NotesPreview,
  InputBar: InputBarPreview,
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
  const Renderer = PREVIEW_RENDERERS[component.type];
  if (Renderer) {
    return <Renderer {...component.props} children={component.children} />;
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
  const style: CSSProperties = {
    minHeight: typeof resolvedHeight === 'number' ? resolvedHeight : MIN_ROW_HEIGHT,
  };

  if (typeof resolvedHeight === 'number') {
    style.height = resolvedHeight;
  }

  const backgroundColor = row.backgroundColor ?? row.bgColor;
  if (backgroundColor) {
    style.backgroundColor = backgroundColor;
  }

  return style;
}

function resolveSpacingValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getRowContentStyle(row: EditorRow): CSSProperties {
  const uniformPadding = resolveSpacingValue(row.padding);

  return {
    gap: row.gap ?? 4,
    paddingTop: resolveSpacingValue(row.paddingTop) ?? uniformPadding ?? 0,
    paddingBottom: resolveSpacingValue(row.paddingBottom) ?? uniformPadding ?? 0,
    paddingRight: resolveSpacingValue(row.paddingRight) ?? uniformPadding ?? DEFAULT_ROW_RIGHT_PADDING,
    paddingLeft: resolveSpacingValue(row.paddingLeft) ?? uniformPadding ?? 0,
    overflowX: row.scrollable ? 'auto' : 'visible',
    overflowY: 'hidden',
  };
}

function getNumericCellWidth(width: EditorCell['width']): number {
  if (typeof width === 'string' && width.endsWith('%')) {
    const parsed = parseFloat(width);
    return isNaN(parsed) ? 1 : parsed;
  }
  return typeof width === 'number' ? width : 1;
}

function getCellStyle(row: EditorRow, cellWidth: EditorCell['width'], totalWidth: number): CSSProperties {
  if (row.scrollable) {
    return {
      flex: '0 0 auto',
      width: `${Math.max(getNumericCellWidth(cellWidth) * SCROLLABLE_CELL_WIDTH, SCROLLABLE_CELL_MIN_WIDTH)}px`,
      minWidth: SCROLLABLE_CELL_MIN_WIDTH,
    };
  }

  if (cellWidth === 'auto') {
    return {
      flex: '1 1 0%',
      minWidth: 40,
    };
  }

  // Handle percentage widths
  if (typeof cellWidth === 'string' && cellWidth.endsWith('%')) {
    return {
      flex: `0 0 ${cellWidth}`,
      width: cellWidth,
      minWidth: 40,
    };
  }

  // Handle numeric flex weights
  const cellPercent = (getNumericCellWidth(cellWidth) / totalWidth) * 100;

  return {
    flex: `${cellPercent} 0 0%`,
    minWidth: 40,
  };
}

// ── Cell Resize Handle ──────────────────────────────────────────────────────

function CellResizeHandle({
  rowId,
  cellIndex,
  leftWidth,
  rightWidth,
  onPreview,
  onCommit,
}: {
  rowId: string;
  cellIndex: number;
  leftWidth: number;
  rightWidth: number;
  onPreview: (rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => void;
  onCommit: (rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => void;
}) {
  const startXRef = useRef(0);
  const startLeftWidthRef = useRef(1);
  const totalWidthRef = useRef(2);
  const hasMovedRef = useRef(false);
  const nextWidthsRef = useRef({ left: 1, right: 1 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
      const delta = (ev.clientX - startXRef.current) / 100;
      const minWidth = 0.25;
      const maxLeft = Math.max(minWidth, totalWidthRef.current - minWidth);
      const nextLeft = Math.min(
        maxLeft,
        Math.max(minWidth, Math.round((startLeftWidthRef.current + delta) * 100) / 100),
      );
      const nextRight = Math.round((totalWidthRef.current - nextLeft) * 100) / 100;

      if (Math.abs(ev.clientX - startXRef.current) > 0) {
        hasMovedRef.current = true;
      }

      nextWidthsRef.current = { left: nextLeft, right: nextRight };
      onPreview(rowId, cellIndex, nextLeft, nextRight);
    };

    const handleMouseUp = () => {
      document.body.style.removeProperty('cursor');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (hasMovedRef.current) {
        onCommit(rowId, cellIndex, nextWidthsRef.current.left, nextWidthsRef.current.right);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cellIndex, leftWidth, onCommit, onPreview, rightWidth, rowId]);

  return (
    <div
      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-10 group"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute top-1/2 -translate-y-1/2 -right-0.5 w-2 h-8 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ── Row Drag Handle ──────────────────────────────────────────────────────────

function RowDragHandle({
  isDragging,
  attributes,
  listeners,
}: {
  isDragging: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Record<string, any> | undefined;
}) {
  return (
    <div
      {...attributes}
      {...listeners}
      className={`absolute z-10 flex select-none items-center justify-center transition-opacity touch-none ${
        isDragging
          ? 'opacity-100 cursor-grabbing'
          : 'opacity-0 cursor-grab group-hover:opacity-100'
      }`}
      style={{
        left: -ROW_DRAG_HANDLE_MARGIN,
        top: 0,
        bottom: 0,
        width: ROW_DRAG_HANDLE_WIDTH
      }}
      title="Drag to reorder row"
    >
      <GripVertical size={12} className={isDragging ? 'text-blue-500' : 'text-gray-400'} />
    </div>
  );
}

function RowHeightResizeHandle({
  rowId,
  onPreview,
  onCommit,
}: {
  rowId: string;
  onPreview: (rowId: string, height: number) => void;
  onCommit: (rowId: string, height: number) => void;
}) {
  const startYRef = useRef(0);
  const startHeightRef = useRef(MIN_ROW_HEIGHT);
  const nextHeightRef = useRef(MIN_ROW_HEIGHT);
  const hasMovedRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const rowElement = e.currentTarget.parentElement;
    if (!rowElement) return;

    startYRef.current = e.clientY;
    startHeightRef.current = rowElement.getBoundingClientRect().height;
    nextHeightRef.current = Math.max(MIN_ROW_HEIGHT, Math.round(startHeightRef.current));
    hasMovedRef.current = false;
    document.body.style.cursor = 'row-resize';

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientY - startYRef.current;
      const nextHeight = Math.max(MIN_ROW_HEIGHT, Math.round(startHeightRef.current + delta));

      if (Math.abs(delta) > 0) {
        hasMovedRef.current = true;
      }

      nextHeightRef.current = nextHeight;
      onPreview(rowId, nextHeight);
    };

    const handleMouseUp = () => {
      document.body.style.removeProperty('cursor');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (hasMovedRef.current) {
        onCommit(rowId, nextHeightRef.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rowId, onCommit, onPreview]);

  return (
    <div
      className="absolute inset-x-8 bottom-0 z-10 flex h-3 cursor-row-resize items-end justify-center"
      onMouseDown={handleMouseDown}
      title="Resize row height"
    >
      <div className="mb-0.5 h-1 w-14 rounded-full bg-gray-200 transition-colors group-hover:bg-blue-300" />
    </div>
  );
}

// ── Row Insertion Control ───────────────────────────────────────────────────

function RowInsertionControl({
  onAdd,
  between,
}: {
  onAdd: (cellCount: number) => void;
  between?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!showPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  const handleToggle = () => {
    if (!showPicker && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.left + rect.width / 2 - 80 });
    }
    setShowPicker(!showPicker);
  };

  return (
    <div
      className={`relative z-10 flex items-center justify-center pointer-events-none ${between ? 'h-10 py-1' : 'py-3'}`}
    >
      {between && (
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-200" />
      )}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`pointer-events-auto relative z-10 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
          between
            ? 'border shadow-sm bg-white border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
        }`}
      >
        <Plus size={12} />
        Add Row
      </button>
      {showPicker && createPortal(
        <div
          ref={pickerRef}
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-[9999]"
          style={{ top: pickerPos.top, left: Math.max(8, pickerPos.left) }}
        >
          <div className="text-xs font-medium text-gray-500 px-2 py-1">Cells per row</div>
          <div className="flex gap-1 px-1">
            {[1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => { onAdd(n); setShowPicker(false); }}
                className="w-10 py-2 text-sm font-medium bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded border border-gray-200 hover:border-blue-300 transition-colors">
                {n}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Sortable Row ─────────────────────────────────────────────────────────────

function SortableRow({
  row, rowIdx, isRowSelected, isCellSelected,
  rowResizePreview, getDisplayedCellWidth,
  handleEmptyCellClick, handleComponentClick,
  handleCellResizePreview, handleCellResizeCommit,
  handleRowResizePreview, handleRowResizeCommit,
  addRow, deleteRow, setSelection, copySelection, removeComponent,
}: {
  row: EditorRow;
  rowIdx: number;
  isRowSelected: boolean;
  isCellSelected: (rowId: string, cellIdx: number) => boolean;
  rowResizePreview: { rowId: string; height: number } | null;
  getDisplayedCellWidth: (rowId: string, cellIndex: number, width: EditorCell['width']) => EditorCell['width'];
  handleEmptyCellClick: (rowId: string, cellIndex: number, e: React.MouseEvent) => void;
  handleComponentClick: (rowId: string, cellIndex: number, e: React.MouseEvent) => void;
  handleCellResizePreview: (rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => void;
  handleCellResizeCommit: (rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => void;
  handleRowResizePreview: (rowId: string, height: number) => void;
  handleRowResizeCommit: (rowId: string, height: number) => void;
  addRow: (cellCount?: number, index?: number) => void;
  deleteRow: (rowId: string) => void;
  setSelection: (sel: import('./types').Selection | null) => void;
  copySelection: () => void;
  removeComponent: (rowId: string, cellIndex: number) => void;
}) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id: row.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Insert point before first row */}
      {rowIdx === 0 && (
        <RowInsertionControl onAdd={(n) => addRow(n, 0)} between />
      )}

      {/* Row */}
      <div
        className={`relative z-0 group rounded-lg transition-all mb-1 border border-dashed ${
          isDragging ? 'opacity-60 ring-1 ring-blue-200 border-blue-200' : ''
        } ${
          isRowSelected
            ? 'ring-2 ring-blue-500 border-blue-300'
            : `border-gray-200 hover:border-gray-400 hover:ring-1 hover:ring-gray-300 ${
                rowIdx % 2 === 0 ? 'bg-white/60' : 'bg-gray-50/40'
              }`
        }`}
        style={getRowContainerStyle(
          row,
          rowResizePreview?.rowId === row.id ? rowResizePreview.height : undefined,
        )}
        onClick={(e) => { e.stopPropagation(); setSelection({ type: 'row', rowId: row.id }); }}
      >
        {/* Drag handle */}
        <RowDragHandle isDragging={isDragging} attributes={attributes} listeners={listeners} />

        {/* Delete row button */}
        <button
          className="absolute -right-1 -top-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
          onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}
          title="Delete row"
        >
          <X size={10} />
        </button>

        {/* Cells container */}
        <div className="flex min-h-[48px] items-stretch gap-1" style={getRowContentStyle(row)}>
          {row.cells.map((cell, cellIdx) => {
            const displayedCellWidths = row.cells.map((entry, index) => getDisplayedCellWidth(row.id, index, entry.width));
            const totalWidth = displayedCellWidths.reduce<number>((sum, width) => sum + getNumericCellWidth(width), 0);
            const displayedWidth = displayedCellWidths[cellIdx] ?? cell.width;
            const adjacentDisplayedWidth = displayedCellWidths[cellIdx + 1] ?? row.cells[cellIdx + 1]?.width ?? 1;
            const componentInfo = cell.content ? getComponentDefinition(cell.content.type) : undefined;
            const isReadOnlyRuntimeComponent = componentInfo?.readOnly === true;

            return (
              <div
                key={cell.id}
                className={`relative rounded transition-all p-1 ${
                  isCellSelected(row.id, cellIdx)
                    ? 'ring-2 ring-blue-400 bg-blue-50/50'
                    : cell.content ? 'bg-white' : 'bg-gray-50 border border-dashed border-gray-200'
                }`}
                style={getCellStyle(row, displayedWidth, totalWidth)}
              >
                {cell.content ? (
                  <div
                    className="cursor-pointer relative group/cell"
                    onClick={(e) => handleComponentClick(row.id, cellIdx, e)}
                  >
                    {/* Floating toolbar */}
                    <div className="absolute -top-5 left-0 right-0 flex items-center gap-0.5 justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity z-20">
                      <button
                        className={`p-0.5 bg-white border border-gray-200 rounded text-[9px] ${
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
                        className="p-0.5 bg-white border border-gray-200 rounded text-gray-500 hover:text-blue-600 hover:border-blue-300 text-[9px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelection({ type: 'component', rowId: row.id, cellIndex: cellIdx });
                          copySelection();
                        }}
                        title="Copy"
                      >
                        <Copy size={9} />
                      </button>
                      <button
                        className="p-0.5 bg-white border border-gray-200 rounded text-gray-500 hover:text-red-500 hover:border-red-300 text-[9px]"
                        onClick={(e) => { e.stopPropagation(); removeComponent(row.id, cellIdx); }}
                        title="Delete"
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>

                    {/* Component preview */}
                    <div className="pointer-events-none overflow-hidden">
                      <ComponentPreview component={cell.content} />
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center h-full min-h-[40px] cursor-pointer hover:bg-blue-50 hover:border-blue-300 rounded transition-colors"
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
                    leftWidth={getNumericCellWidth(displayedWidth)}
                    rightWidth={getNumericCellWidth(adjacentDisplayedWidth)}
                    onPreview={handleCellResizePreview}
                    onCommit={handleCellResizeCommit}
                  />
                )}
              </div>
            );
          })}
        </div>

        <RowHeightResizeHandle
          rowId={row.id}
          onPreview={handleRowResizePreview}
          onCommit={handleRowResizeCommit}
        />
      </div>

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
  const [rowResizePreview, setRowResizePreview] = useState<{ rowId: string; height: number } | null>(null);
  const [cellResizePreview, setCellResizePreview] = useState<{
    rowId: string;
    cellIndex: number;
    leftWidth: number;
    rightWidth: number;
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleCellResizePreview = useCallback((rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => {
    setCellResizePreview({ rowId, cellIndex, leftWidth, rightWidth });
  }, []);

  const handleCellResizeCommit = useCallback((rowId: string, cellIndex: number, leftWidth: number, rightWidth: number) => {
    setCellResizePreview(null);
    updateAdjacentCellWidths(rowId, cellIndex, leftWidth, rightWidth);
  }, [updateAdjacentCellWidths]);

  const getDisplayedCellWidth = useCallback((rowId: string, cellIndex: number, width: EditorCell['width']): EditorCell['width'] => {
    if (!cellResizePreview || cellResizePreview.rowId !== rowId) {
      return width;
    }

    if (cellResizePreview.cellIndex === cellIndex) {
      return cellResizePreview.leftWidth;
    }

    if (cellResizePreview.cellIndex + 1 === cellIndex) {
      return cellResizePreview.rightWidth;
    }

    return width;
  }, [cellResizePreview]);

  const isRowSelected = (rowId: string) => selection?.rowId === rowId && selection?.type === 'row';
  const isCellSelected = (rowId: string, cellIdx: number) =>
    selection?.rowId === rowId && selection?.cellIndex === cellIdx;

  const handleEmptyCellClick = (rowId: string, cellIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelection({ type: 'cell', rowId, cellIndex });
    setPickerState({ rowId, cellIndex, position: { x: e.clientX, y: e.clientY } });
  };

  const handleComponentClick = (rowId: string, cellIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelection({ type: 'component', rowId, cellIndex });
  };

  const handlePickerSelect = (componentType: string) => {
    if (pickerState) {
      setComponent(pickerState.rowId, pickerState.cellIndex, componentType);
    }
    setPickerState(null);
  };

  const handleRowResizePreview = useCallback((rowId: string, height: number) => {
    setRowResizePreview({ rowId, height });
  }, []);

  const handleRowResizeCommit = useCallback((rowId: string, height: number) => {
    setRowResizePreview(null);
    updateRowHeight(rowId, height);
  }, [updateRowHeight]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = rows.findIndex(r => r.id === active.id);
    const toIndex = rows.findIndex(r => r.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      moveRow(fromIndex, toIndex);
    }
  }, [rows, moveRow]);

  const frameScale = Math.min(1, MAX_PREVIEW_WIDTH / deviceWidth, MAX_PREVIEW_HEIGHT / deviceHeight);
  const previewWidth = Math.round(deviceWidth * frameScale);
  const previewHeight = Math.round(deviceHeight * frameScale);

  return (
    <div className="h-full flex flex-col items-center bg-gray-100 overflow-auto p-6">
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
          <div className="flex-1 overflow-y-auto p-2" style={{ paddingLeft: ROW_DRAG_HANDLE_MARGIN + 8 }} onClick={() => setSelection(null)}>
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
                    rowResizePreview={rowResizePreview}
                    getDisplayedCellWidth={getDisplayedCellWidth}
                    handleEmptyCellClick={handleEmptyCellClick}
                    handleComponentClick={handleComponentClick}
                    handleCellResizePreview={handleCellResizePreview}
                    handleCellResizeCommit={handleCellResizeCommit}
                    handleRowResizePreview={handleRowResizePreview}
                    handleRowResizeCommit={handleRowResizeCommit}
                    addRow={addRow}
                    deleteRow={deleteRow}
                    setSelection={setSelection}
                    copySelection={copySelection}
                    removeComponent={removeComponent}
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
