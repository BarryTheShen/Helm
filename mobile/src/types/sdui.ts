/**
 * Server-Driven UI (SDUI) type system
 *
 * Architecture (inspired by Airbnb Ghost Platform):
 *   Screen  → top-level page descriptor
 *     sections[]  → named, independent UI blocks
 *       component → typed component with strongly-typed props
 *         actions → user interactions → typed actions handled by the client
 *
 * The AI generates SDUIScreen JSON objects and POSTs them to
 *   POST /api/sdui/{module_id}
 * The frontend polls GET /api/sdui/{module_id} and renders natively.
 *
 * Adding a new component:
 *   1. Add its type literal to SDUIComponentType
 *   2. Add its Props interface
 *   3. Add a union member to SDUIComponent
 *   4. Add a case to SDUIRenderer.tsx
 */

// ── Actions ────────────────────────────────────────────────────────────────
// Actions describe what happens when a user interacts with a component.
// The frontend dispatches them without knowing feature-specific business logic.

export type SDUIAction =
  | { type: 'navigate'; screen: string; params?: Record<string, string> }
  | { type: 'api_call'; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; body?: Record<string, unknown> }
  | { type: 'dismiss' }
  | { type: 'open_sheet'; content: SDUIComponent }
  | { type: 'copy_text'; text: string }
  | { type: 'open_url'; url: string };

// ── Component type union ───────────────────────────────────────────────────

export type SDUIComponentType =
  | 'text'
  | 'heading'
  | 'button'
  | 'icon_button'
  | 'divider'
  | 'spacer'
  | 'card'
  | 'container'
  | 'list'
  | 'list_item'
  | 'form'
  | 'alert'
  | 'badge'
  | 'stat'
  | 'stats_row'
  | 'calendar'
  | 'image'
  | 'progress';

// ── Component definitions ──────────────────────────────────────────────────

export interface TextComponent {
  type: 'text';
  id: string;
  props: { content: string; size?: 'xs' | 'sm' | 'md' | 'lg'; color?: string; bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right' };
}

export interface HeadingComponent {
  type: 'heading';
  id: string;
  props: { content: string; level?: 1 | 2 | 3; align?: 'left' | 'center' | 'right' };
}

export interface ButtonComponent {
  type: 'button';
  id: string;
  props: { label: string; variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'; action: SDUIAction; disabled?: boolean; icon?: string };
}

export interface IconButtonComponent {
  type: 'icon_button';
  id: string;
  props: { icon: string; label: string; action: SDUIAction; size?: 'sm' | 'md' | 'lg' };
}

export interface DividerComponent {
  type: 'divider';
  id: string;
  props: { spacing?: 'sm' | 'md' | 'lg' };
}

export interface SpacerComponent {
  type: 'spacer';
  id: string;
  props: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' };
}

export interface CardComponent {
  type: 'card';
  id: string;
  props: { title?: string; subtitle?: string; elevated?: boolean; action?: SDUIAction };
  children: SDUIComponent[];
}

export interface ContainerComponent {
  type: 'container';
  id: string;
  props: { direction?: 'row' | 'column'; gap?: 'xs' | 'sm' | 'md' | 'lg'; wrap?: boolean; align?: 'start' | 'center' | 'end' | 'stretch' };
  children: SDUIComponent[];
}

export interface ListComponent {
  type: 'list';
  id: string;
  props: { title?: string; items: ListItem[] };
}

export interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
  right_text?: string;
  action?: SDUIAction;
}

export interface FormFieldOption { label: string; value: string }

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[];
  default_value?: string | boolean | number;
}

export interface FormComponent {
  type: 'form';
  id: string;
  props: { title?: string; fields: FormField[]; submit_label?: string; submit_action: SDUIAction };
}

export interface AlertComponent {
  type: 'alert';
  id: string;
  props: { severity: 'info' | 'warning' | 'error' | 'success'; title: string; message: string; dismissible?: boolean };
}

export interface BadgeComponent {
  type: 'badge';
  id: string;
  props: { label: string; color?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' };
}

export interface StatComponent {
  type: 'stat';
  id: string;
  props: { label: string; value: string; change?: string; change_direction?: 'up' | 'down' | 'neutral'; icon?: string };
}

export interface StatsRowComponent {
  type: 'stats_row';
  id: string;
  props: { stats: Array<{ label: string; value: string; change?: string; change_direction?: 'up' | 'down' | 'neutral' }> };
}

export interface CalendarComponent {
  type: 'calendar';
  id: string;
  props: {
    events: Array<{ id: string; title: string; start: string; end: string; allDay?: boolean; color?: string }>;
    view?: 'month' | 'day';
  };
}

export interface ImageComponent {
  type: 'image';
  id: string;
  props: { uri: string; aspect_ratio?: number; alt?: string; action?: SDUIAction };
}

export interface ProgressComponent {
  type: 'progress';
  id: string;
  props: { value: number; max?: number; label?: string; color?: string };
}

// Discriminated union over all component types
export type SDUIComponent =
  | TextComponent
  | HeadingComponent
  | ButtonComponent
  | IconButtonComponent
  | DividerComponent
  | SpacerComponent
  | CardComponent
  | ContainerComponent
  | ListComponent
  | FormComponent
  | AlertComponent
  | BadgeComponent
  | StatComponent
  | StatsRowComponent
  | CalendarComponent
  | ImageComponent
  | ProgressComponent;

// ── Screen & Section ───────────────────────────────────────────────────────

export interface SDUISection {
  /** Stable ID for this section (used for keying) */
  id: string;
  /** Optional display title above the section */
  title?: string;
  component: SDUIComponent;
}

/**
 * A complete screen descriptor.  The backend generates this; the frontend renders it.
 * Stored in the DB as module state JSON and served at GET /api/sdui/{module_id}.
 */
export interface SDUIScreen {
  /** Schema version for forward-compatibility */
  schema_version: 1;
  /** Module/screen identifier (e.g. 'home', 'calendar', 'tasks') */
  module_id: string;
  /** Page title shown in the navigation header */
  title: string;
  /** Sections rendered top-to-bottom */
  sections: SDUISection[];
  /** ISO timestamp when this screen was last generated by AI */
  generated_at?: string;
}

// Legacy alias — kept for backward compat with old code that uses SDUIComponent directly
export interface LegacySDUIComponent {
  type: SDUIComponentType;
  id: string;
  props: Record<string, unknown>;
  children?: LegacySDUIComponent[];
}
