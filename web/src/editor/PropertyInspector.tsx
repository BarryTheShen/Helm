import { useState, useEffect } from 'react';
import { useEditorStore, MIN_ROW_HEIGHT } from './useEditorStore';
import { COMPONENT_SCHEMAS, ACTION_TYPES } from './componentSchemas';
import type { ActionSchema, FieldSchema } from './componentSchemas';
import { getActionPropName, getComponentDefinition } from './types';
import type { ActionRule, EditorComponent, EditorRowPaddingKey } from './types';
import { Settings, Rows3, Box, Minus, Plus } from 'lucide-react';
import { RuleBuilder } from './RuleBuilder';
import { api } from '../lib/api';
import type { DataSource, Workflow } from '../lib/api';
import { VariableInput } from './VariableInput';
import { IconPicker } from './IconPicker';
import { ActionParamsEditor } from './ActionParamsEditor';

const INTERACTIVE_COMPONENTS = new Set(['Button', 'TextInput', 'InputBar']);

const ROW_PADDING_FIELDS: Array<{ key: EditorRowPaddingKey; label: string }> = [
  { key: 'paddingTop', label: 'Top' },
  { key: 'paddingBottom', label: 'Bottom' },
  { key: 'paddingLeft', label: 'Left' },
  { key: 'paddingRight', label: 'Right' },
];

const INPUT_BAR_AUTHORABLE_ACTION_TYPES = new Set(['none', 'send_to_agent', 'server_action']);

function getAuthorableActionSchemas(componentType: string): ActionSchema[] {
  if (componentType !== 'InputBar') {
    return ACTION_TYPES;
  }

  return ACTION_TYPES.filter((action) => INPUT_BAR_AUTHORABLE_ACTION_TYPES.has(action.type));
}

function getActionFieldSchema(componentType: string, actionType: string, field: FieldSchema): FieldSchema {
  if (componentType !== 'InputBar') {
    return field;
  }

  if (actionType === 'send_to_agent' && field.key === 'message') {
    return {
      ...field,
      label: 'Message Template',
      placeholder: 'e.g. Summarize this: {{input}}',
    };
  }

  if (actionType === 'server_action' && field.key === 'params') {
    return {
      ...field,
      label: 'Parameters (JSON template)',
      placeholder: '{"text": "{{input}}"}',
    };
  }

  return field;
}

function getComponentInfo(type: string) {
  return getComponentDefinition(type);
}

type ActionRecord = Record<string, unknown>;

function isActionRecord(value: unknown): value is ActionRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStructuredFallbackValue(value: unknown): boolean {
  if (value !== null && typeof value === 'object') {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || value.includes('\n');
}

function parseUnknownActionFieldInput(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getFallbackActionField(key: string, value: unknown): FieldSchema {
  if (typeof value === 'boolean') {
    return { key, label: key, type: 'toggle' };
  }

  return {
    key,
    label: key,
    type: isStructuredFallbackValue(value) ? 'textarea' : 'text',
  };
}

type FormFieldValue = string | number | readonly string[] | undefined;

function coerceFormFieldValue(value: unknown, fallback?: unknown): FormFieldValue {
  const resolved = value ?? fallback;

  if (resolved === undefined || resolved === null) {
    return undefined;
  }

  if (typeof resolved === 'string' || typeof resolved === 'number') {
    return resolved;
  }

  if (Array.isArray(resolved) && resolved.every((entry): entry is string => typeof entry === 'string')) {
    return resolved;
  }

  return String(resolved);
}

function coerceStringValue(value: unknown, fallback: unknown = ''): string {
  const resolved = value ?? fallback;
  return typeof resolved === 'string' ? resolved : String(resolved);
}

function coerceOptionalNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getOptionalNumberInputValue(value: unknown): number | '' {
  const parsed = coerceOptionalNumberValue(value);
  return parsed === undefined ? '' : parsed;
}

function parseNumberFieldInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalNumberInput(value: string, min: number): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(min, parsed);
}

type SummaryRow = {
  label: string;
  value: string;
};

function formatSummaryLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function collapseSummaryText(value: string, maxLength = 80): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (!collapsed) {
    return '(empty)';
  }

  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 3)}...` : collapsed;
}

function getSummaryText(record: ActionRecord, keys: string[], maxLength = 40): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const collapsed = value.replace(/\s+/g, ' ').trim();
      if (collapsed) {
        return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 3)}...` : collapsed;
      }
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return null;
}

function isActionLikeProp(key: string, value: unknown): value is ActionRecord {
  if (!isActionRecord(value) || typeof value.type !== 'string') {
    return false;
  }

  const normalizedKey = key.replace(/[_-]+/g, '').toLowerCase();
  return normalizedKey === 'action' || normalizedKey.endsWith('action') || normalizedKey.startsWith('on');
}

function summarizeActionLikeValue(key: string, value: ActionRecord): string {
  const actionType = getSummaryText(value, ['type'], 32) ?? formatSummaryLabel(key);
  const details: string[] = [];

  const functionName = getSummaryText(value, ['function'], 32);
  if (functionName) {
    details.push(`function ${functionName}`);
  }

  const screen = getSummaryText(value, ['screen'], 32);
  if (screen) {
    details.push(`screen ${screen}`);
  }

  const target = getSummaryText(value, ['target', 'targetId'], 32);
  if (target) {
    details.push(`target ${target}`);
  }

  const url = getSummaryText(value, ['url'], 48);
  if (url) {
    details.push(url);
  }

  const params = value.params;
  if (Array.isArray(params)) {
    details.push(`${params.length} param${params.length === 1 ? '' : 's'}`);
  } else if (isActionRecord(params)) {
    const paramKeys = Object.keys(params);
    if (paramKeys.length > 0) {
      details.push(`params: ${paramKeys.slice(0, 3).join(', ')}${paramKeys.length > 3 ? ', ...' : ''}`);
    }
  }

  const content = getSummaryText(value, ['label', 'message', 'prompt', 'content'], 40);
  if (content) {
    details.push(content);
  }

  return details.length > 0 ? `${actionType}: ${details.join(' • ')}` : actionType;
}

function getListLikeSingular(key: string): string {
  const normalizedKey = key.replace(/[_-]+/g, '').toLowerCase();

  if (normalizedKey === 'fields') {
    return 'field';
  }

  if (normalizedKey === 'stats') {
    return 'stat';
  }

  if (normalizedKey === 'items' || normalizedKey === 'data') {
    return 'item';
  }

  return 'entry';
}

function getNormalizedListLikeKind(componentType: string, key: string): 'field' | 'stat' | 'item' | 'entry' {
  const normalizedKey = key.replace(/[_-]+/g, '').toLowerCase();
  const normalizedComponentType = componentType.replace(/[_-]+/g, '').toLowerCase();

  if (
    normalizedComponentType === 'form'
    && (normalizedKey === 'fields' || normalizedKey === 'components' || normalizedKey === 'items')
  ) {
    return 'field';
  }

  if (normalizedComponentType === 'statsrow' && (normalizedKey === 'stats' || normalizedKey === 'items')) {
    return 'stat';
  }

  if (normalizedComponentType === 'list' && (normalizedKey === 'items' || normalizedKey === 'data')) {
    return 'item';
  }

  if (normalizedKey === 'fields') {
    return 'field';
  }

  if (normalizedKey === 'stats') {
    return 'stat';
  }

  if (normalizedKey === 'items' || normalizedKey === 'data') {
    return 'item';
  }

  return 'entry';
}

function getListLikeKindLabel(kind: 'field' | 'stat' | 'item' | 'entry'): string {
  if (kind === 'field') {
    return 'field';
  }

  if (kind === 'stat') {
    return 'stat';
  }

  if (kind === 'item') {
    return 'item';
  }

  return 'entry';
}

function normalizeDirectionLabel(direction: string): string {
  const normalized = direction.trim().toLowerCase();

  if (normalized === 'up' || normalized === 'increase' || normalized === 'positive') {
    return 'up';
  }

  if (normalized === 'down' || normalized === 'decrease' || normalized === 'negative') {
    return 'down';
  }

  if (normalized === 'flat' || normalized === 'neutral' || normalized === 'steady') {
    return 'flat';
  }

  return normalized.replace(/[_-]+/g, ' ');
}

function summarizeStatChange(value: ActionRecord): string | null {
  const change = getSummaryText(value, ['change'], 20);
  const direction = getSummaryText(value, ['change_direction', 'changeDirection'], 20);
  const normalizedDirection = direction ? normalizeDirectionLabel(direction) : null;

  if (!change && !normalizedDirection) {
    return null;
  }

  if (change && normalizedDirection) {
    return `${normalizedDirection} ${change}`;
  }

  return change ?? normalizedDirection;
}

function summarizeListItemEntry(value: ActionRecord, index: number): string {
  const label = getSummaryText(value, ['label', 'title', 'text', 'name', 'value'], 30) ?? `Item ${index + 1}`;
  const extras = [
    getSummaryText(value, ['subtitle'], 24),
    getSummaryText(value, ['badge'], 18),
    getSummaryText(value, ['right_text', 'rightText'], 18),
  ].filter((entry): entry is string => Boolean(entry));

  if (extras.length === 0) {
    return label;
  }

  return `${label} • ${extras.join(' • ')}`;
}

function summarizeListLikeEntry(componentType: string, key: string, value: unknown, index: number): string {
  const listKind = getNormalizedListLikeKind(componentType, key);

  if (typeof value === 'string') {
    return collapseSummaryText(value, 32);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (!isActionRecord(value)) {
    return `${formatSummaryLabel(getListLikeKindLabel(listKind))} ${index + 1}`;
  }

  if (listKind === 'field') {
    const label = getSummaryText(value, ['label', 'title', 'text', 'name', 'placeholder'], 28) ?? `Field ${index + 1}`;
    const type = getSummaryText(value, ['type', 'kind', 'componentType', 'inputType'], 20);
    return type && type.toLowerCase() !== label.toLowerCase() ? `${label} (${type})` : label;
  }

  if (listKind === 'stat') {
    const label = getSummaryText(value, ['label', 'title', 'name'], 24) ?? `Stat ${index + 1}`;
    const statValue = getSummaryText(value, ['value', 'stat', 'amount', 'number'], 20);
    const statChange = summarizeStatChange(value);

    if (statValue && statChange) {
      return `${label}: ${statValue} • ${statChange}`;
    }

    return statValue ? `${label}: ${statValue}` : statChange ? `${label}: ${statChange}` : label;
  }

  if (listKind === 'item') {
    return summarizeListItemEntry(value, index);
  }

  return getSummaryText(value, ['label', 'title', 'text', 'name', 'value'], 30) ?? `${formatSummaryLabel(getListLikeSingular(key))} ${index + 1}`;
}

function summarizeListLikeValue(componentType: string, key: string, value: unknown[]): string {
  const listKind = getNormalizedListLikeKind(componentType, key);
  const singular = getListLikeKindLabel(listKind);
  const prefix = `${value.length} ${value.length === 1 ? singular : `${singular}s`}`;

  if (value.length === 0) {
    return prefix;
  }

  const preview = value.slice(0, 3).map((entry, index) => summarizeListLikeEntry(componentType, key, entry, index));
  return `${prefix}: ${preview.join(', ')}${value.length > preview.length ? ', ...' : ''}`;
}

function summarizeGenericObjectValue(value: ActionRecord): string {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return '0 fields';
  }

  const preview = keys.slice(0, 3).map((key) => {
    const fieldValue = value[key];
    const scalar = typeof fieldValue === 'string'
      ? collapseSummaryText(fieldValue, 24)
      : typeof fieldValue === 'number' || typeof fieldValue === 'boolean'
        ? String(fieldValue)
        : Array.isArray(fieldValue)
          ? `${fieldValue.length} item${fieldValue.length === 1 ? '' : 's'}`
          : isActionRecord(fieldValue)
            ? `${Object.keys(fieldValue).length} key${Object.keys(fieldValue).length === 1 ? '' : 's'}`
            : null;

    return scalar ? `${formatSummaryLabel(key)}: ${scalar}` : formatSummaryLabel(key);
  });

  return `${preview.join(' • ')}${keys.length > preview.length ? ' • ...' : ''}`;
}

function summarizeReadOnlyValue(componentType: string, key: string, value: unknown): string | null {
  if (typeof value === 'string') {
    return collapseSummaryText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return summarizeListLikeValue(componentType, key, value);
  }

  if (isActionLikeProp(key, value)) {
    return summarizeActionLikeValue(key, value);
  }

  if (isActionRecord(value)) {
    return summarizeGenericObjectValue(value);
  }

  return null;
}

function summarizeChildren(children?: EditorComponent[]): string | null {
  if (!children || children.length === 0) {
    return null;
  }

  const previewTypes = children
    .slice(0, 3)
    .map((child) => getComponentInfo(child.type)?.displayName ?? child.type);
  const suffix = children.length > 3 ? ', ...' : '';

  return `${children.length} child component${children.length === 1 ? '' : 's'} (${previewTypes.join(', ')}${suffix})`;
}

function buildReadOnlySummaryRows(component: EditorComponent): SummaryRow[] {
  const rows = Object.entries(component.props)
    .map(([key, value]) => {
      const summary = summarizeReadOnlyValue(component.type, key, value);
      if (!summary) {
        return null;
      }

      return {
        label: formatSummaryLabel(key),
        value: summary,
      };
    })
    .filter((row): row is SummaryRow => row !== null);

  const childSummary = summarizeChildren(component.children);
  if (childSummary) {
    rows.push({
      label: 'Children',
      value: childSummary,
    });
  }

  return rows;
}

function ReadOnlyComponentSummary({ component }: { component: EditorComponent }) {
  const summaryRows = buildReadOnlySummaryRows(component);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
        This legacy runtime component is preserved as-is. The editor exposes a read-only summary and does not offer editable fields for this payload.
      </div>

      {summaryRows.length > 0 ? (
        <div className="space-y-2">
          {summaryRows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{row.label}</div>
              <div className="mt-1 text-xs text-gray-700">{row.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-500">
          No summaryable props were found on this payload.
        </div>
      )}
    </div>
  );
}

const DATA_BINDING_COMPONENT_TYPES = new Set(['CalendarModule', 'ChatModule', 'NotesModule']);

const DATA_BINDING_SOURCE_TYPE: Record<string, string> = {
  CalendarModule: 'calendar',
  ChatModule: 'chat',
  NotesModule: 'notes',
};

// ── Field Renderers ──────────────────────────────────────────────────────────

function FieldRenderer({ field, value, onChange, screenComponents }: {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  screenComponents?: Array<{ id: string; type: string }>;
}) {
  switch (field.type) {
    case 'text':
      return (
        <VariableInput
          value={coerceStringValue(value, field.defaultValue ?? '')}
          onChange={onChange}
          placeholder={field.placeholder}
          screenComponents={screenComponents}
        />
      );
    case 'number':
      {
        const placeholder = field.placeholder ?? (typeof field.defaultValue === 'number' ? String(field.defaultValue) : undefined);

      return (
        <input
          type="number"
          value={getOptionalNumberInputValue(value)}
          onChange={e => onChange(parseNumberFieldInput(e.target.value))}
          placeholder={placeholder}
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      );
      }
    case 'select':
      return (
        <select
          value={String(value ?? field.defaultValue ?? '')}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          {field.options?.map(opt => (
            <option key={String(opt.value)} value={coerceFormFieldValue(opt.value, '')}>{opt.label}</option>
          ))}
        </select>
      );
    case 'toggle':
      return (
        <button
          onClick={() => onChange(!value)}
          className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      );
    case 'textarea':
      {
        const textareaValue = value ?? field.defaultValue ?? '';
        const textareaStr = typeof textareaValue === 'string' ? textareaValue : JSON.stringify(textareaValue, null, 2);

      return (
        <VariableInput
          value={textareaStr}
          onChange={onChange}
          placeholder={field.placeholder}
          multiline={true}
          screenComponents={screenComponents}
        />
      );
      }
    case 'color':
      return (
        <div className="flex gap-1.5 items-center">
          <input
            type="color"
            value={coerceStringValue(value, field.defaultValue ?? '#000000')}
            onChange={e => onChange(e.target.value)}
            className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
          />
          <input
            type="text"
            value={coerceStringValue(value, field.defaultValue ?? '#000000')}
            onChange={e => onChange(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
          />
        </div>
      );
    default:
      return null;
  }
}

// ── No Selection Panel ───────────────────────────────────────────────────────

function NoSelectionPanel() {
  const rows = useEditorStore(s => s.rows);
  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-gray-600">
        <Settings size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">Screen</span>
      </div>
      <div className="text-xs text-gray-400">
        {rows.length === 0
          ? 'Empty screen. Add rows to get started.'
          : `${rows.length} row${rows.length !== 1 ? 's' : ''}, ${rows.reduce((sum, r) => sum + r.cells.length, 0)} cells total.`
        }
      </div>
      <div className="text-xs text-gray-400 mt-4">
        Click a row, cell, or component on the canvas to edit its properties.
      </div>
    </div>
  );
}

// ── Row Properties Panel ─────────────────────────────────────────────────────

function RowPropertiesPanel({ rowId }: { rowId: string }) {
  const rows = useEditorStore(s => s.rows);
  const updateRowHeight = useEditorStore(s => s.updateRowHeight);
  const updateRowProps = useEditorStore(s => s.updateRowProps);
  const setCellCount = useEditorStore(s => s.setCellCount);
  const updateCellWidth = useEditorStore(s => s.updateCellWidth);

  const row = rows.find(r => r.id === rowId);
  if (!row) return null;

  const rowIdx = rows.indexOf(row);
  const rowBackground = row.backgroundColor ?? row.bgColor ?? '#ffffff';
  const isScrollable = row.scrollable ?? false;
  const uniformPadding = coerceOptionalNumberValue(row.padding);

  const handlePaddingChange = (key: EditorRowPaddingKey, value: number | undefined) => {
    const nextPadding = { [key]: value } as Partial<Record<EditorRowPaddingKey, number | undefined>>;
    updateRowProps(rowId, nextPadding);
  };

  const handleUniformPaddingChange = (value: string) => {
    updateRowProps(rowId, { padding: parseOptionalNumberInput(value, 0) });
  };

  const handleCellWidthChange = (cellIndex: number, value: string, unit: 'px' | '%' | 'flex') => {
    if (unit === '%') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) {
        updateCellWidth(rowId, cellIndex, `${parsed}%`);
      }
    } else {
      const nextWidth = parseOptionalNumberInput(value, 0.25);
      updateCellWidth(rowId, cellIndex, nextWidth === undefined ? 'auto' : nextWidth);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2 text-gray-600">
        <Rows3 size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">Row {rowIdx + 1}</span>
      </div>

      {/* Cell count */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Cells</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => row.cells.length > 1 && setCellCount(rowId, row.cells.length - 1)}
            disabled={row.cells.length <= 1}
            className="p-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus size={12} />
          </button>
          <span className="text-sm font-medium w-8 text-center">{row.cells.length}</span>
          <button
            onClick={() => setCellCount(rowId, row.cells.length + 1)}
            className="p-1 rounded border border-gray-200 hover:bg-gray-50"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="text-[10px] text-gray-300 mt-1">No maximum limit. Minimum width enforced per cell.</div>
      </div>

      {/* Row height */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
        <div className="flex gap-1.5">
          <button
            onClick={() => updateRowHeight(rowId, 'auto')}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              row.height === 'auto' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            Auto
          </button>
          <input
            type="number"
            value={typeof row.height === 'number' ? row.height : ''}
            onChange={e => {
              const val = e.target.value;
              if (val) {
                const numVal = Number(val);
                // Enforce minimum row height
                updateRowHeight(rowId, Math.max(MIN_ROW_HEIGHT, numVal));
              } else {
                updateRowHeight(rowId, 'auto');
              }
            }}
            min={MIN_ROW_HEIGHT}
            step={1}
            placeholder="px"
            className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none w-20"
          />
        </div>
        <div className="text-[10px] text-gray-400 mt-1">Minimum 48px enforced. Auto adjusts to content.</div>
      </div>

      {/* Cell widths */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Cell Widths</label>
        <div className="space-y-1.5">
          {row.cells.map((cell, cellIdx) => {
            const isPercentage = typeof cell.width === 'string' && cell.width.endsWith('%');
            const isAuto = cell.width === 'auto';
            const unit = isPercentage ? '%' : 'flex';
            const numericValue = isAuto
              ? ''
              : isPercentage
                ? parseFloat(String(cell.width))
                : getOptionalNumberInputValue(cell.width);

            return (
              <div key={cell.id} className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 w-12">Cell {cellIdx + 1}</span>
                <button
                  onClick={() => updateCellWidth(rowId, cellIdx, 'auto')}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    isAuto ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Auto
                </button>
                <input
                  type="number"
                  value={numericValue}
                  onChange={e => handleCellWidthChange(cellIdx, e.target.value, unit)}
                  step={unit === '%' ? 1 : 0.25}
                  min={unit === '%' ? 5 : 0.25}
                  placeholder={unit === '%' ? '%' : 'flex'}
                  disabled={isAuto}
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                />
                <div className="flex border border-gray-200 rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = isAuto ? 1 : (typeof cell.width === 'number' ? cell.width : parseFloat(String(cell.width)) || 1);
                      updateCellWidth(rowId, cellIdx, currentValue);
                    }}
                    className={`px-1.5 py-1 text-[10px] font-medium transition-colors ${
                      !isPercentage && !isAuto
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    flex
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = isAuto ? 50 : (typeof cell.width === 'number' ? cell.width * 10 : parseFloat(String(cell.width)) || 50);
                      updateCellWidth(rowId, cellIdx, `${Math.max(5, Math.min(100, currentValue))}%`);
                    }}
                    className={`px-1.5 py-1 text-[10px] font-medium transition-colors ${
                      isPercentage
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-400 mt-1">
          <strong>Auto:</strong> Equal distribution. <strong>Flex:</strong> Relative weights. <strong>%:</strong> Fixed percentage (5-100%, min 60px enforced).
        </div>
      </div>

      {/* Background color */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Background</label>
        <div className="flex gap-1.5 items-center">
          <input
            type="color"
            value={rowBackground}
            onChange={e => updateRowProps(rowId, { backgroundColor: e.target.value, bgColor: e.target.value })}
            className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
          />
          <input
            type="text"
            value={rowBackground}
            onChange={e => updateRowProps(rowId, { backgroundColor: e.target.value, bgColor: e.target.value })}
            className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md outline-none font-mono"
          />
        </div>
      </div>

      {/* Padding */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Padding (px)</label>
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 w-8">All</span>
            <input
              type="number"
              value={getOptionalNumberInputValue(row.padding)}
              min={0}
              onChange={e => handleUniformPaddingChange(e.target.value)}
              placeholder="Uniform"
              className="flex-1 px-1.5 py-1 text-xs border border-gray-200 rounded-md outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {ROW_PADDING_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 w-8">{label}</span>
                <input
                  type="number"
                  value={getOptionalNumberInputValue(row[key])}
                  min={0}
                  onChange={e => handlePaddingChange(key, parseOptionalNumberInput(e.target.value, 0))}
                  placeholder={uniformPadding === undefined ? '' : String(uniformPadding)}
                  className="flex-1 px-1.5 py-1 text-xs border border-gray-200 rounded-md outline-none"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-gray-400 mt-1">Padding creates inner spacing. Leave side values blank to use uniform padding.</div>
      </div>

      {/* Gap */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Gap (px)</label>
        <input
          type="number"
          value={getOptionalNumberInputValue(row.gap)}
          min={0}
          onChange={e => updateRowProps(rowId, { gap: parseOptionalNumberInput(e.target.value, 0) })}
          placeholder="4"
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none"
        />
        <div className="text-[10px] text-gray-400 mt-1">Space between cells. Default is 4px.</div>
      </div>

      {/* Scrollable */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-500">Scrollable (H)</label>
          <button onClick={() => updateRowProps(rowId, { scrollable: !isScrollable })} className={`relative w-9 h-5 rounded-full transition-colors ${isScrollable ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isScrollable ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="text-[10px] text-gray-400 mt-1">Enable horizontal scrolling for cells. When off, cells wrap within row width.</div>
      </div>

      {/* Bottom Divider */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-500">Show Divider</label>
          <button
            onClick={() => updateRowProps(rowId, { showDivider: !(row.showDivider ?? false) })}
            className={`relative w-9 h-5 rounded-full transition-colors ${row.showDivider ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${row.showDivider ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="text-[10px] text-gray-400 mt-1">Show a horizontal divider line below this row.</div>
      </div>

      {/* Divider Color */}
      {row.showDivider && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Divider Color</label>
          <div className="flex gap-1.5 items-center">
            <input
              type="color"
              value={row.dividerColor ?? '#E0E0E0'}
              onChange={e => updateRowProps(rowId, { dividerColor: e.target.value })}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={row.dividerColor ?? '#E0E0E0'}
              onChange={e => updateRowProps(rowId, { dividerColor: e.target.value })}
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md outline-none font-mono"
            />
          </div>
        </div>
      )}

      {/* Divider Thickness */}
      {row.showDivider && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Divider Thickness (px)</label>
          <input
            type="number"
            value={getOptionalNumberInputValue(row.dividerThickness)}
            min={1}
            max={8}
            onChange={e => updateRowProps(rowId, { dividerThickness: parseOptionalNumberInput(e.target.value, 1) })}
            placeholder="1"
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none"
          />
        </div>
      )}

      {/* Divider Margin */}
      {row.showDivider && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Divider Margin (px)</label>
          <input
            type="number"
            value={getOptionalNumberInputValue(row.dividerMargin)}
            min={0}
            onChange={e => updateRowProps(rowId, { dividerMargin: parseOptionalNumberInput(e.target.value, 0) })}
            placeholder="8"
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md outline-none"
          />
        </div>
      )}

      {/* Row ID */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Row ID</label>
        <div className="px-2 py-1 text-xs font-mono text-gray-400 bg-gray-50 border border-gray-100 rounded-md truncate">{row.id}</div>
      </div>
    </div>
  );
}

// ── Component Properties Panel ───────────────────────────────────────────────

function ComponentPropertiesPanel({ rowId, cellIndex }: { rowId: string; cellIndex: number }) {
  const rows = useEditorStore(s => s.rows);
  const updateComponentProps = useEditorStore(s => s.updateComponentProps);
  const removeComponent = useEditorStore(s => s.removeComponent);

  // Derive type before early returns so hooks can depend on it
  const row = rows.find(r => r.id === rowId);
  const componentType = row?.cells[cellIndex]?.content?.type ?? '';

  const [dataSources, setDataSources] = useState<DataSource[]>([]);

  useEffect(() => {
    if (!DATA_BINDING_COMPONENT_TYPES.has(componentType)) return;
    api.getDataSources({ limit: 50 })
      .then(body => setDataSources(body.items))
      .catch(() => {});
  }, [componentType]);

  if (!row) return null;
  const cell = row.cells[cellIndex];
  if (!cell?.content) return <EmptyCellPanel />;

  const component = cell.content;
  const { type, props } = component;
  const schema = COMPONENT_SCHEMAS[type] || [];
  const info = getComponentInfo(type);
  const isReadOnly = info?.readOnly === true;

  const handleChange = (key: string, value: unknown) => {
    updateComponentProps(rowId, cellIndex, { [key]: value });
  };

  // Collect all screen components for variable picker
  const screenComponents = rows.flatMap(r =>
    r.cells.map(c => c.content).filter((comp): comp is EditorComponent => comp !== null)
  ).map(comp => ({ id: comp.id, type: comp.type }));

  const actionPropName = getActionPropName(type);
  const authorableActionSchemas = getAuthorableActionSchemas(type);
  const hasAction = actionPropName !== null;
  const actionValue = actionPropName ? props[actionPropName] : undefined;
  const action = isActionRecord(actionValue) ? actionValue : undefined;
  const actionType = typeof action?.type === 'string' ? action.type : 'none';
  const knownAction = authorableActionSchemas.find(at => at.type === actionType);
  const actionOptions = !knownAction && actionType !== 'none'
    ? [...authorableActionSchemas, { type: actionType, label: `Unknown: ${actionType}`, fields: [] }]
    : authorableActionSchemas;
  const fallbackActionEntries = !knownAction && action
    ? Object.entries(action).filter(([key]) => key !== 'type')
    : [];

  const handleActionTypeChange = (newType: string) => {
    if (!actionPropName) return;

    updateComponentProps(rowId, cellIndex, {
      [actionPropName]: newType === 'none' ? undefined : { type: newType },
    });
  };

  const handleActionFieldChange = (key: string, value: unknown) => {
    if (!actionPropName) return;

    const currentAction = action || { type: actionType };
    updateComponentProps(rowId, cellIndex, {
      [actionPropName]: {
        ...currentAction,
        [key]: value,
      },
    });
  };

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-600">
          <span>{info?.icon || '📦'}</span>
          <span className="text-xs font-semibold uppercase tracking-wider">{info?.displayName || type}</span>
        </div>
        <button
          onClick={() => removeComponent(rowId, cellIndex)}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Component fields */}
      {isReadOnly ? (
        <ReadOnlyComponentSummary component={component} />
      ) : (
        <div className="space-y-3">
          {schema.map(field => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
              <FieldRenderer
                field={field}
                value={props[field.key]}
                onChange={(val) => handleChange(field.key, val)}
                screenComponents={screenComponents}
              />
            </div>
          ))}
        </div>
      )}

      {/* Data Binding (for composite modules) */}
      {!isReadOnly && DATA_BINDING_COMPONENT_TYPES.has(type) && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            🔗 Data Binding
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Data Source</label>
            <select
              value={(props.dataBinding as { sourceId?: string } | undefined)?.sourceId ?? ''}
              onChange={e => handleChange('dataBinding', e.target.value ? { sourceId: e.target.value } : undefined)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">None</option>
              {dataSources
                .filter(ds => !DATA_BINDING_SOURCE_TYPE[type] || ds.type === DATA_BINDING_SOURCE_TYPE[type])
                .map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* Action config (for Button, Image) */}
      {!isReadOnly && hasAction && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            ⚡ Action
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Type</label>
              <select
                value={actionType}
                onChange={e => handleActionTypeChange(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                {actionOptions.map(at => (
                  <option key={at.type} value={at.type}>{at.label}</option>
                ))}
              </select>
            </div>

            {knownAction?.fields.map((field) => {
              const actionField = getActionFieldSchema(type, actionType, field);

              return (
                <div key={actionField.key}>
                  <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{actionField.label}</label>
                  <FieldRenderer
                    field={actionField}
                    value={action?.[actionField.key]}
                    onChange={(val) => handleActionFieldChange(actionField.key, val)}
                    screenComponents={screenComponents}
                  />
                </div>
              );
            })}

            {!knownAction && fallbackActionEntries.map(([key, value]) => {
              const field = getFallbackActionField(key, value);

              return (
                <div key={field.key}>
                  <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{field.label}</label>
                  <FieldRenderer
                    field={field}
                    value={value}
                    onChange={(nextValue) => handleActionFieldChange(
                      key,
                      typeof nextValue === 'string'
                        ? parseUnknownActionFieldInput(nextValue)
                        : nextValue,
                    )}
                    screenComponents={screenComponents}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty Cell Panel ─────────────────────────────────────────────────────────

function EmptyCellPanel() {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 text-gray-600">
        <Box size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">Empty Cell</span>
      </div>
      <div className="text-xs text-gray-400 mt-2">
        Click the + button on the canvas to add a component to this cell.
      </div>
    </div>
  );
}

// ── Main PropertyInspector Component ─────────────────────────────────────────

function RulesPanel({ rowId, cellIndex }: { rowId: string; cellIndex: number }) {
  const rows = useEditorStore(s => s.rows);
  const updateCellRules = useEditorStore(s => s.updateCellRules);

  const row = rows.find(r => r.id === rowId);
  const cell = row?.cells[cellIndex];
  const componentType = cell?.content?.type;
  const rules: ActionRule[] = Array.isArray(cell?.rules) ? cell.rules as ActionRule[] : [];

  return (
    <div className="p-3">
      <RuleBuilder
        rules={rules}
        onChange={(nextRules) => updateCellRules(rowId, cellIndex, nextRules)}
        componentType={componentType}
      />
    </div>
  );
}

type InspectorTab = 'properties' | 'rules';

function ComponentInspectorTabbed({ rowId, cellIndex }: { rowId: string; cellIndex: number }) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('properties');
  const rows = useEditorStore(s => s.rows);

  const row = rows.find(r => r.id === rowId);
  const cell = row?.cells[cellIndex];
  const componentType = cell?.content?.type;
  const isInteractive = typeof componentType === 'string' && INTERACTIVE_COMPONENTS.has(componentType);

  if (!isInteractive) {
    return <ComponentPropertiesPanel rowId={rowId} cellIndex={cellIndex} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'properties'
              ? 'text-blue-700 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'rules'
              ? 'text-blue-700 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Rules
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'properties' && (
          <ComponentPropertiesPanel rowId={rowId} cellIndex={cellIndex} />
        )}
        {activeTab === 'rules' && (
          <RulesPanel rowId={rowId} cellIndex={cellIndex} />
        )}
      </div>
    </div>
  );
}

export function PropertyInspector() {
  const selection = useEditorStore(s => s.selection);

  return (
    <div className="h-full overflow-y-auto">
      {!selection && <NoSelectionPanel />}
      {selection?.type === 'row' && <RowPropertiesPanel rowId={selection.rowId} />}
      {selection?.type === 'cell' && selection.cellIndex !== undefined && (
        <ComponentInspectorTabbed rowId={selection.rowId} cellIndex={selection.cellIndex} />
      )}
      {selection?.type === 'component' && selection.cellIndex !== undefined && (
        <ComponentInspectorTabbed rowId={selection.rowId} cellIndex={selection.cellIndex} />
      )}
    </div>
  );
}