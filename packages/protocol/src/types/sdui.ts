/**
 * Keel SDUI V2 Type System
 *
 * Row-by-Row page layout with responsive breakpoints.
 * Architecture: Page → rows[] → cells[] → component
 *
 * Adding a new component:
 *   1. Add its type literal to SDUIComponentType
 *   2. Register it via `registerComponent()` in @keel/renderer
 */

// ── Actions ────────────────────────────────────────────────────────────────

export type SDUIAction =
  | { type: 'navigate'; screen: string; params?: Record<string, string> }
  | { type: 'go_back' }
  | { type: 'api_call'; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: Record<string, unknown> }
  | { type: 'server_action'; function: string; params?: Record<string, any> }
  | { type: 'send_to_agent'; message: string }
  | { type: 'dismiss' }
  | { type: 'open_sheet'; content: SDUIComponent }
  | { type: 'copy_text'; text: string }
  | { type: 'open_url'; url: string }
  | { type: 'toggle'; target: string }
  | { type: 'form_submit'; form_id: string; data: Record<string, unknown> }
  | { type: 'select_screen'; option_id: string }
  | { type: 'update_component'; component_id: string; props: Record<string, unknown> };

// ── V2 Component Types (PascalCase) ───────────────────────────────────────

export type SDUIComponentType =
  // Atomic (Tier 2)
  | 'Text'
  | 'Markdown'
  | 'Button'
  | 'Image'
  | 'TextInput'
  | 'Icon'
  | 'Divider'
  // Structural (Tier 1)
  | 'Container'
  // Composite (Tier 3)
  | 'CalendarModule'
  | 'ChatModule'
  | 'NotesModule'
  | 'InputBar'
  | 'Form'
  | 'ScreenOptions';

/** V2 component: type + props bag. Rendered via componentRegistry. */
export interface SDUIComponent {
  type: SDUIComponentType | (string & {});
  id: string;
  props: Record<string, any>;
  children?: SDUIComponent[];
}

// ── Layout ────────────────────────────────────────────────────────────────

/** A single cell within a row, holding one component */
export interface SDUICell {
  id: string;
  /** Fractional width (0-1) or 'auto' for natural width */
  width?: number | 'auto';
  /** The component rendered inside this cell */
  content: SDUIComponent;
}

/** A single row containing one or more cells */
export interface SDUIRow {
  id: string;
  cells: SDUICell[];
  /** Responsive layout for phone (<768px) */
  compact?: { hidden?: boolean; stack?: boolean; direction?: string; gap?: number };
  /** Responsive layout for tablet (>=768px) */
  regular?: { hidden?: boolean; direction?: string; gap?: number };
  /** Horizontal scroll with snap (for carousels) */
  scrollable?: boolean;
  backgroundColor?: string;
  padding?: number | string;
  gap?: number;
}

/** A complete page descriptor — the top-level SDUI payload */
export interface SDUIPage {
  schema_version: '1.0.0';
  module_id: string;
  title?: string;
  rows: SDUIRow[];
  generated_at?: string;
  meta?: Record<string, unknown>;
}

/** Defines a single field in an SDUI Form component */
export interface SDUIFormField {
  id: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | boolean | number;
  options?: Array<{ label: string; value: string }>;
}

/** A set of screen options presented by the AI for the user to choose from */
export interface SDUIScreenOptions {
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    screen: SDUIPage;
  }>;
}

/** A partial update to an existing component's props */
export interface SDUIComponentUpdate {
  component_id: string;
  props: Record<string, unknown>;
}

/** Type guard: returns true if an object is a V2 SDUIPage */
export function isSDUIPage(payload: any): payload is SDUIPage {
  return payload != null && payload.schema_version === '1.0.0' && Array.isArray(payload.rows);
}

/** Callback type for handling SDUI actions */
export type ActionDispatcher = (action: SDUIAction) => void;
