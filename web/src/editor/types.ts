// Editor state types for the Helm SDUI visual editor

export interface ActionStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
}

export interface ActionRule {
  id: string;
  trigger: 'onPress' | 'onSubmit' | 'onSend';
  actions: ActionStep[];
}

export interface EditorComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: EditorComponent[];
}

export interface EditorCell {
  id: string;
  width: number | string;
  content: EditorComponent | null;
  rules?: ActionRule[];
  [key: string]: unknown;
}

export type EditorRowHeight = 'auto' | number;
export type EditorRowPaddingValue = number | string;

export interface EditorRowVisualProps {
  bgColor?: string;
  backgroundColor?: string;
  paddingTop?: EditorRowPaddingValue;
  paddingBottom?: EditorRowPaddingValue;
  paddingLeft?: EditorRowPaddingValue;
  paddingRight?: EditorRowPaddingValue;
  padding?: EditorRowPaddingValue;
  scrollable?: boolean;
  gap?: number;
  showDivider?: boolean;
  dividerColor?: string;
  dividerThickness?: number;
  dividerMargin?: number;
  compact?: { hidden?: boolean; stack?: boolean };
  regular?: { hidden?: boolean };
}

export type EditorRowPaddingKey = 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight';

export interface EditorRow extends EditorRowVisualProps {
  id: string;
  height: EditorRowHeight;
  cells: EditorCell[];
  [key: string]: unknown;
}

export interface EditorScreen {
  rows: EditorRow[];
  [key: string]: unknown;
}

export interface Selection {
  type: 'row' | 'cell' | 'component';
  rowId: string;
  cellIndex?: number;
}

export interface ClipboardItem {
  type: 'row' | 'component';
  data: EditorRow | EditorComponent;
}

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  icon: string;
  category: 'phone' | 'tablet' | 'desktop';
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'iPhone SE', width: 375, height: 667, icon: '📱', category: 'phone' },
  { name: 'iPhone 15', width: 390, height: 844, icon: '📱', category: 'phone' },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932, icon: '📱', category: 'phone' },
  { name: 'Pixel 8', width: 412, height: 915, icon: '📱', category: 'phone' },
  { name: 'Samsung S24', width: 360, height: 780, icon: '📱', category: 'phone' },
  { name: 'iPad Mini', width: 744, height: 1133, icon: '📋', category: 'tablet' },
  { name: 'iPad Air', width: 820, height: 1180, icon: '📋', category: 'tablet' },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, icon: '📋', category: 'tablet' },
  { name: 'Desktop', width: 1280, height: 800, icon: '💻', category: 'desktop' },
  { name: 'Desktop HD', width: 1920, height: 1080, icon: '💻', category: 'desktop' },
];

// Component type categories for the component picker
export interface ComponentDefinition {
  type: string;
  displayName: string;
  icon: string;
  category: 'structural' | 'atomic' | 'composite';
  description: string;
  authorable?: boolean;
  readOnly?: boolean;
}

const READ_ONLY_RUNTIME_COMPONENTS: ComponentDefinition[] = [
  {
    type: 'icon_button',
    displayName: 'Icon Button',
    icon: '🔘',
    category: 'atomic',
    description: 'Legacy runtime icon button preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'spacer',
    displayName: 'Spacer',
    icon: '↕️',
    category: 'structural',
    description: 'Legacy runtime spacer preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'card',
    displayName: 'Card',
    icon: '🗂️',
    category: 'structural',
    description: 'Legacy runtime card preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'list',
    displayName: 'List',
    icon: '📋',
    category: 'composite',
    description: 'Legacy runtime list preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'form',
    displayName: 'Form',
    icon: '🧾',
    category: 'composite',
    description: 'Legacy runtime form preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'list_item',
    displayName: 'List Item',
    icon: '•',
    category: 'atomic',
    description: 'Legacy runtime list item preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'alert',
    displayName: 'Alert',
    icon: '⚠️',
    category: 'atomic',
    description: 'Legacy runtime alert preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'badge',
    displayName: 'Badge',
    icon: '🏷️',
    category: 'atomic',
    description: 'Legacy runtime badge preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'stat',
    displayName: 'Stat',
    icon: '📊',
    category: 'atomic',
    description: 'Legacy runtime stat preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'stats_row',
    displayName: 'Stats Row',
    icon: '📈',
    category: 'composite',
    description: 'Legacy runtime stats row preserved read-only',
    authorable: false,
    readOnly: true,
  },
  {
    type: 'progress',
    displayName: 'Progress',
    icon: '⏳',
    category: 'atomic',
    description: 'Legacy runtime progress preserved read-only',
    authorable: false,
    readOnly: true,
  },
];

export const COMPONENT_REGISTRY: ComponentDefinition[] = [
  // Atomic Components
  { type: 'Text', displayName: 'Text', icon: '📝', category: 'atomic', description: 'Text content with styling' },
  { type: 'Markdown', displayName: 'Markdown', icon: '📄', category: 'atomic', description: 'Rich markdown content' },
  { type: 'Button', displayName: 'Button', icon: '🔘', category: 'atomic', description: 'Interactive button with actions' },
  { type: 'Image', displayName: 'Image', icon: '🖼️', category: 'atomic', description: 'Display an image' },
  { type: 'TextInput', displayName: 'Text Input', icon: '✏️', category: 'atomic', description: 'User text input field' },
  { type: 'Icon', displayName: 'Icon', icon: '⭐', category: 'atomic', description: 'Display an icon' },
  // Structural
  { type: 'Empty', displayName: 'Empty', icon: '📦', category: 'structural', description: 'Container for vertical stacking of components' },
  { type: 'Container', displayName: 'Container', icon: '🧱', category: 'structural', description: 'Flex layout container with nested children', authorable: false },
  // Components (Composite)
  { type: 'CalendarModule', displayName: 'Calendar', icon: '📅', category: 'composite', description: 'Calendar view with events' },
  { type: 'ChatModule', displayName: 'Chat', icon: '💬', category: 'composite', description: 'Chat interface' },
  { type: 'NotesModule', displayName: 'Notes', icon: '📓', category: 'composite', description: 'Notes editor' },
  { type: 'InputBar', displayName: 'Input Bar', icon: '💬', category: 'composite', description: 'Message input bar with send' },
  { type: 'Todo', displayName: 'Todo', icon: '✅', category: 'composite', description: 'Todo list with checkboxes' },
  { type: 'ArticleCard', displayName: 'Article Card', icon: '📰', category: 'composite', description: 'Article preview card' },
  { type: 'RichTextRenderer', displayName: 'Rich Text Renderer', icon: '📝', category: 'composite', description: 'Rich text markdown renderer' },
  { type: 'RichText', displayName: 'Rich Text', icon: '📝', category: 'composite', description: 'Rich text markdown renderer (alias)' },
  ...READ_ONLY_RUNTIME_COMPONENTS,
];

export function getComponentDefinition(type: string): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY.find((definition) => definition.type === type);
}

export function getAuthorableComponents(): ComponentDefinition[] {
  return COMPONENT_REGISTRY.filter((definition) => definition.authorable !== false && definition.readOnly !== true);
}

// Preset definitions for quick component/row creation
export interface ComponentPreset {
  name: string;
  type: string;
  props: Record<string, unknown>;
  icon?: string;
}

export interface RowPreset {
  name: string;
  cellCount: number;
  height?: 'auto' | number;
  props?: Record<string, unknown>;
  icon?: string;
}

export const COMPONENT_PRESETS: ComponentPreset[] = [
  { name: 'Heading', type: 'Text', props: { content: 'Heading', variant: 'heading' }, icon: '📰' },
  { name: 'Body Text', type: 'Text', props: { content: 'Body text', variant: 'body' }, icon: '📝' },
  { name: 'Caption', type: 'Text', props: { content: 'Caption text', variant: 'caption' }, icon: '🏷️' },
  { name: 'Primary Button', type: 'Button', props: { label: 'Button', variant: 'primary' }, icon: '🔵' },
  { name: 'Secondary Button', type: 'Button', props: { label: 'Button', variant: 'secondary' }, icon: '⚪' },
  { name: 'Icon Button', type: 'Button', props: { icon: 'star', variant: 'icon' }, icon: '⭐' },
  { name: 'Text Input', type: 'TextInput', props: { placeholder: 'Enter text...' }, icon: '✏️' },
  { name: 'Image', type: 'Image', props: { src: 'https://via.placeholder.com/300x200', aspectRatio: 1.5 }, icon: '🖼️' },
  { name: 'Icon', type: 'Icon', props: { name: 'star', size: 24, color: '#000000' }, icon: '⭐' },
  { name: 'Empty Container', type: 'Empty', props: { gap: 8, padding: 0 }, icon: '📦' },
];

export const ROW_PRESETS: RowPreset[] = [
  { name: 'Single Column', cellCount: 1, height: 'auto', icon: '▭' },
  { name: 'Two Columns', cellCount: 2, height: 'auto', icon: '▭▭' },
  { name: 'Three Columns', cellCount: 3, height: 'auto', icon: '▭▭▭' },
  { name: 'Four Columns', cellCount: 4, height: 'auto', icon: '▭▭▭▭' },
];

export type ActionPropName = 'onPress' | 'onSubmit' | 'onSend';

const ACTION_PROP_MAP = {
  Button: 'onPress',
  Image: 'onPress',
  TextInput: 'onSubmit',
  InputBar: 'onSend',
} as const satisfies Partial<Record<string, ActionPropName>>;

function normalizeLegacyTypeKey(type: string): string {
  return type.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const LEGACY_TYPE_MAP: Record<string, string> = {
  text: 'Text',
  paragraph: 'Text',
  body: 'Text',
  caption: 'Text',
  label: 'Text',
  heading: 'Text',
  header: 'Text',
  title: 'Text',
  subtitle: 'Text',
  sectiontitle: 'Text',
  markdown: 'Markdown',
  button: 'Button',
  submit: 'Button',
  submitbutton: 'Button',
  formbutton: 'Button',
  resetbutton: 'Button',
  checkbox: 'Button',
  radio: 'Button',
  switch: 'Button',
  toggle: 'Button',
  image: 'Image',
  heroimage: 'Image',
  textinput: 'TextInput',
  textfield: 'TextInput',
  input: 'TextInput',
  formfield: 'TextInput',
  forminput: 'TextInput',
  emailinput: 'TextInput',
  emailfield: 'TextInput',
  passwordinput: 'TextInput',
  passwordfield: 'TextInput',
  numberinput: 'TextInput',
  numericinput: 'TextInput',
  phoneinput: 'TextInput',
  telinput: 'TextInput',
  searchinput: 'TextInput',
  dateinput: 'TextInput',
  timeinput: 'TextInput',
  textarea: 'TextInput',
  select: 'TextInput',
  dropdown: 'TextInput',
  combobox: 'TextInput',
  icon: 'Icon',
  divider: 'Divider',
  hr: 'Divider',
  rule: 'Divider',
  container: 'Container',
  form: 'form',
  fieldset: 'Container',
  formsection: 'Container',
  calendar: 'CalendarModule',
  calendarmodule: 'CalendarModule',
  chat: 'ChatModule',
  chatmodule: 'ChatModule',
  notes: 'NotesModule',
  notesmodule: 'NotesModule',
  inputbar: 'InputBar',
};

const STRUCTURAL_COMPONENT_KEYS = new Set(['type', 'id', 'props', 'children', 'component', 'componentType', 'kind']);

const HEADING_LEGACY_TYPE_KEYS = new Set(['heading', 'header', 'title', 'subtitle', 'sectiontitle']);
const CAPTION_LEGACY_TYPE_KEYS = new Set(['caption', 'label', 'helpertext']);
const CHECKABLE_LEGACY_TYPE_KEYS = new Set(['checkbox', 'radio', 'switch', 'toggle']);
const SELECT_LIKE_LEGACY_TYPE_KEYS = new Set(['select', 'dropdown', 'combobox']);
const MULTILINE_INPUT_LEGACY_TYPE_KEYS = new Set(['textarea']);
const EMAIL_INPUT_LEGACY_TYPE_KEYS = new Set(['emailinput', 'emailfield']);
const PASSWORD_INPUT_LEGACY_TYPE_KEYS = new Set(['passwordinput', 'passwordfield']);
const PHONE_INPUT_LEGACY_TYPE_KEYS = new Set(['phoneinput', 'telinput']);
const NUMERIC_INPUT_LEGACY_TYPE_KEYS = new Set(['numberinput', 'numericinput']);
const FORM_CONTAINER_LEGACY_TYPE_KEYS = new Set(['fieldset', 'formsection']);

let editorIdCounter = 0;

export function createEditorId(prefix = 'editor'): string {
  editorIdCounter += 1;
  return `${prefix}-${Date.now()}-${editorIdCounter}`;
}

export function getActionPropName(componentType: string): ActionPropName | null {
  return ACTION_PROP_MAP[componentType as keyof typeof ACTION_PROP_MAP] ?? null;
}

export function normalizeComponentType(type: string): string {
  const legacyTypeKey = normalizeLegacyTypeKey(type);
  if (legacyTypeKey.startsWith('heading')) {
    return 'Text';
  }

  return LEGACY_TYPE_MAP[legacyTypeKey] ?? type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getStringProp(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (isNonEmptyString(value)) {
      return value;
    }
  }

  return undefined;
}

function getNumberProp(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function summarizeLegacyOptions(options: unknown): string | undefined {
  if (isNonEmptyString(options)) {
    return options;
  }

  if (!Array.isArray(options)) {
    return undefined;
  }

  const labels = options
    .map((option) => {
      if (isNonEmptyString(option)) {
        return option;
      }

      if (isRecord(option)) {
        return getStringProp(option, ['label', 'title', 'text', 'value', 'name']);
      }

      return undefined;
    })
    .filter((option): option is string => option !== undefined);

  if (labels.length === 0) {
    return undefined;
  }

  const preview = labels.slice(0, 3).join(', ');
  return labels.length > 3 ? `${preview}, ...` : preview;
}

function getRawComponentType(component: Record<string, unknown>): string | null {
  if (typeof component.type === 'string') {
    return component.type;
  }

  if (typeof component.component === 'string') {
    return component.component;
  }

  if (typeof component.componentType === 'string') {
    return component.componentType;
  }

  if (typeof component.kind === 'string') {
    return component.kind;
  }

  return null;
}

function buildLegacyFormChildren(props: Record<string, unknown>): unknown[] | undefined {
  const children: unknown[] = [];
  const title = getStringProp(props, ['title', 'heading', 'label', 'name']);

  if (title) {
    children.push({
      type: 'Text',
      props: { content: title, variant: 'heading' },
    });
  }

  for (const key of ['fields', 'components', 'items']) {
    const entries = props[key];
    if (Array.isArray(entries)) {
      children.push(...entries);
    }
  }

  const submitLabel = getStringProp(props, ['submitLabel', 'buttonLabel', 'actionLabel']);
  if (submitLabel) {
    children.push({
      type: 'Button',
      props: { label: submitLabel, variant: 'primary' },
    });
  }

  if (children.length > 0) {
    return children;
  }

  const description = getStringProp(props, ['description', 'text', 'content']);
  if (description) {
    return [{
      type: 'Markdown',
      props: { content: description },
    }];
  }

  return undefined;
}

function looksLikeJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeButtonVariant(value: unknown): unknown {
  if (value === 'danger') return 'destructive';
  if (value === 'outline') return 'secondary';
  return value;
}

function normalizeButtonSize(value: unknown): unknown {
  if (value === 'small') return 'sm';
  if (value === 'medium') return 'md';
  if (value === 'large') return 'lg';
  return value;
}

function normalizeCalendarView(value: unknown): 'month' | 'week' | 'day' | 'agenda' | 'compact' | undefined {
  if (value === 'month' || value === 'week' || value === 'day' || value === 'agenda' || value === 'compact') {
    return value;
  }
  // Legacy threeDay mapping
  if (value === 'threeDay') return 'week';
  return undefined;
}

function createFallbackSheetContent(sheetId: string): EditorComponent {
  return {
    id: createEditorId('sheet-content'),
    type: 'Text',
    props: { content: sheetId },
  };
}

function extractFlatProps(component: Record<string, unknown>): Record<string, unknown> {
  const flatProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(component)) {
    if (key === 'content' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      continue;
    }

    if (!STRUCTURAL_COMPONENT_KEYS.has(key)) {
      flatProps[key] = value;
    }
  }
  return flatProps;
}

function normalizeActionRecordForEditor(action: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...action };

  if (normalized.type === 'navigate' && typeof normalized.screen !== 'string' && typeof normalized.target === 'string') {
    normalized.screen = normalized.target;
  }

  if (normalized.type === 'toggle' && typeof normalized.target !== 'string' && typeof normalized.targetId === 'string') {
    normalized.target = normalized.targetId;
  }

  if (normalized.type === 'server_action' && isRecord(normalized.params)) {
    normalized.params = JSON.stringify(normalized.params, null, 2);
  }

  if (normalized.type === 'open_sheet') {
    const rawContent = normalized.content ?? normalized.sheetId;
    if (typeof rawContent === 'string') {
      normalized.content = looksLikeJson(rawContent)
        ? rawContent
        : JSON.stringify(createFallbackSheetContent(rawContent), null, 2);
    } else if (rawContent !== undefined) {
      normalized.content = JSON.stringify(rawContent, null, 2);
    }
  }

  return normalized;
}

function serializeActionRecordForRuntime(action: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = { ...action };

  if (serialized.type === 'navigate' && typeof serialized.screen !== 'string' && typeof serialized.target === 'string') {
    serialized.screen = serialized.target;
  }

  if (serialized.type === 'toggle' && typeof serialized.target !== 'string' && typeof serialized.targetId === 'string') {
    serialized.target = serialized.targetId;
  }

  if (serialized.type === 'server_action' && typeof serialized.params === 'string') {
    const parsed = tryParseJson(serialized.params);
    serialized.params = isRecord(parsed) ? parsed : undefined;
  }

  if (serialized.type === 'open_sheet') {
    const rawContent = serialized.content ?? serialized.sheetId;
    if (typeof rawContent === 'string') {
      const trimmedContent = rawContent.trim();
      if (!trimmedContent) {
        serialized.content = undefined;
      } else {
        const parsed = tryParseJson(trimmedContent);
        if (isRecord(parsed)) {
          const normalizedContent = normalizeComponentForEditor(parsed);
          serialized.content = normalizedContent ? serializeComponentForRuntime(normalizedContent) : createFallbackSheetContent(trimmedContent);
        } else {
          serialized.content = createFallbackSheetContent(trimmedContent);
        }
      }
    } else if (isRecord(rawContent)) {
      const normalizedContent = normalizeComponentForEditor(rawContent);
      serialized.content = normalizedContent ? serializeComponentForRuntime(normalizedContent) : undefined;
    } else {
      serialized.content = undefined;
    }
  }

  delete serialized.targetId;
  delete serialized.sheetId;

  if (serialized.type === 'navigate') {
    delete serialized.target;
  }

  return Object.fromEntries(Object.entries(serialized).filter(([, value]) => value !== undefined));
}

function normalizeActionProp(
  props: Record<string, unknown>,
  canonicalKey: ActionPropName,
  legacyKeys: string[] = [],
): void {
  const candidateKeys = [canonicalKey, ...legacyKeys];

  for (const key of candidateKeys) {
    const value = props[key];
    if (isRecord(value) && typeof value.type === 'string') {
      props[canonicalKey] = normalizeActionRecordForEditor(value);
      break;
    }
  }

  for (const key of legacyKeys) {
    delete props[key];
  }
}

function serializeActionProp(
  props: Record<string, unknown>,
  canonicalKey: ActionPropName,
  legacyKeys: string[] = [],
): void {
  const candidateKeys = [canonicalKey, ...legacyKeys];

  for (const key of candidateKeys) {
    const value = props[key];
    if (isRecord(value) && typeof value.type === 'string') {
      props[canonicalKey] = serializeActionRecordForRuntime(value);
      break;
    }
  }

  for (const key of legacyKeys) {
    delete props[key];
  }
}

function getServerActionValidationError(
  action: Record<string, unknown>,
  location: string,
): string | null {
  if (action.type !== 'server_action') {
    return null;
  }

  if (!isNonEmptyString(action.function)) {
    return `${location} has an incomplete server action. Enter a function name before saving.`;
  }

  if (action.params === undefined) {
    return null;
  }

  if (typeof action.params !== 'string') {
    return `${location} has invalid server action parameters. Enter a JSON object before saving.`;
  }

  const trimmedParams = action.params.trim();
  if (!trimmedParams) {
    return null;
  }

  const parsedParams = tryParseJson(trimmedParams);
  if (!isRecord(parsedParams)) {
    return `${location} has invalid server action parameters. Enter a JSON object before saving.`;
  }

  return null;
}

function getComponentPersistenceValidationError(
  component: EditorComponent,
  location: string,
): string | null {
  const actionPropName = getActionPropName(component.type);
  if (actionPropName) {
    const actionValue = component.props[actionPropName];
    if (isRecord(actionValue)) {
      const validationError = getServerActionValidationError(actionValue, location);
      if (validationError) {
        return validationError;
      }
    }
  }

  if (!component.children) {
    return null;
  }

  for (let childIndex = 0; childIndex < component.children.length; childIndex += 1) {
    const child = component.children[childIndex];
    const childLocation = `${location} > Child ${childIndex + 1} (${child.type})`;
    const validationError = getComponentPersistenceValidationError(child, childLocation);
    if (validationError) {
      return validationError;
    }
  }

  return null;
}

export function getEditorPersistenceValidationError(rows: EditorRow[]): string | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex += 1) {
      const component = row.cells[cellIndex].content;
      if (!component) {
        continue;
      }

      const location = `Row ${rowIndex + 1}, Cell ${cellIndex + 1} (${component.type})`;
      const validationError = getComponentPersistenceValidationError(component, location);
      if (validationError) {
        return validationError;
      }
    }
  }

  return null;
}

export function normalizeComponentPropsForEditor(
  componentType: string,
  props: Record<string, unknown>,
  sourceType: string = componentType,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...props };
  const legacyTypeKey = normalizeLegacyTypeKey(sourceType);

  switch (componentType) {
    case 'Text': {
      const content = getStringProp(normalized, ['content', 'text', 'title', 'heading', 'label', 'value']);
      if (content !== undefined) {
        normalized.content = content;
      }

      if (normalized.variant === undefined) {
        if (HEADING_LEGACY_TYPE_KEYS.has(legacyTypeKey) || legacyTypeKey.startsWith('heading')) {
          normalized.variant = 'heading';
        } else if (CAPTION_LEGACY_TYPE_KEYS.has(legacyTypeKey)) {
          normalized.variant = 'caption';
        } else {
          normalized.variant = 'body';
        }
      }

      if (typeof normalized.align !== 'string' && typeof normalized.textAlign === 'string') {
        normalized.align = normalized.textAlign;
      }

      delete normalized.text;
      delete normalized.title;
      delete normalized.heading;
      delete normalized.label;
      delete normalized.textAlign;
      break;
    }

    case 'Button': {
      const label = getStringProp(normalized, ['label', 'text', 'title', 'content', 'value', 'name']);
      const isCheckable = CHECKABLE_LEGACY_TYPE_KEYS.has(legacyTypeKey);

      if (isCheckable) {
        const isChecked = normalized.checked === true || normalized.selected === true || normalized.value === true;
        const marker = legacyTypeKey === 'radio'
          ? (isChecked ? '(o)' : '( )')
          : (isChecked ? '[x]' : '[ ]');
        normalized.label = `${marker} ${label ?? 'Option'}`;
        if (normalized.variant === undefined) {
          normalized.variant = 'secondary';
        }
      } else if (label !== undefined) {
        normalized.label = label;
      } else if (legacyTypeKey.includes('submit')) {
        normalized.label = 'Submit';
      }

      if (normalized.variant === undefined && legacyTypeKey.includes('submit')) {
        normalized.variant = 'primary';
      }

      normalized.variant = normalizeButtonVariant(normalized.variant);
      normalized.size = normalizeButtonSize(normalized.size);
      delete normalized.text;
      delete normalized.title;
      normalizeActionProp(normalized, 'onPress', ['action']);
      break;
    }

    case 'Image': {
      if (typeof normalized.src !== 'string' && typeof normalized.uri === 'string') {
        normalized.src = normalized.uri;
      }
      if (normalized.aspectRatio === undefined && typeof normalized.aspect_ratio === 'number') {
        normalized.aspectRatio = normalized.aspect_ratio;
      }
      delete normalized.uri;
      delete normalized.aspect_ratio;
      normalizeActionProp(normalized, 'onPress', ['action']);
      break;
    }

    case 'TextInput': {
      const placeholder = getStringProp(normalized, ['placeholder', 'label', 'title', 'prompt', 'name']);
      const inputValue = getStringProp(normalized, ['value', 'defaultValue', 'text', 'content']);
      const maxLines = getNumberProp(normalized, ['maxLines', 'rows', 'lines']);
      const optionSummary = summarizeLegacyOptions(normalized.options);

      if (normalized.placeholder === undefined && placeholder !== undefined) {
        normalized.placeholder = placeholder;
      }

      if (normalized.value === undefined && inputValue !== undefined) {
        normalized.value = inputValue;
      }

      if (normalized.maxLines === undefined && maxLines !== undefined) {
        normalized.maxLines = maxLines;
      }

      if (
        normalized.multiline === undefined
        && (MULTILINE_INPUT_LEGACY_TYPE_KEYS.has(legacyTypeKey) || (maxLines !== undefined && maxLines > 1))
      ) {
        normalized.multiline = true;
      }

      if (normalized.keyboardType === undefined) {
        if (EMAIL_INPUT_LEGACY_TYPE_KEYS.has(legacyTypeKey)) {
          normalized.keyboardType = 'email-address';
        } else if (PASSWORD_INPUT_LEGACY_TYPE_KEYS.has(legacyTypeKey)) {
          normalized.keyboardType = 'default';
        } else if (PHONE_INPUT_LEGACY_TYPE_KEYS.has(legacyTypeKey)) {
          normalized.keyboardType = 'phone-pad';
        } else if (NUMERIC_INPUT_LEGACY_TYPE_KEYS.has(legacyTypeKey)) {
          normalized.keyboardType = 'numeric';
        }
      }

      if (normalized.secureTextEntry === undefined && PASSWORD_INPUT_LEGACY_TYPE_KEYS.has(legacyTypeKey)) {
        normalized.secureTextEntry = true;
      }

      if (SELECT_LIKE_LEGACY_TYPE_KEYS.has(legacyTypeKey)) {
        if (normalized.editable === undefined) {
          normalized.editable = false;
        }

        if (normalized.placeholder === undefined) {
          normalized.placeholder = 'Select option';
        }

        if (normalized.value === undefined && optionSummary !== undefined) {
          normalized.value = optionSummary;
        }
      }

      delete normalized.text;
      delete normalized.title;
      delete normalized.rows;
      delete normalized.lines;
      normalizeActionProp(normalized, 'onSubmit', ['action', 'onPress']);
      break;
    }

    case 'InputBar': {
      normalizeActionProp(normalized, 'onSend', ['action', 'onPress']);
      break;
    }

    case 'CalendarModule': {
      const nextView = normalizeCalendarView(normalized.variant ?? normalized.defaultView);
      if (nextView) {
        normalized.variant = nextView;
      }
      delete normalized.defaultView;
      break;
    }

    case 'Container': {
      if (FORM_CONTAINER_LEGACY_TYPE_KEYS.has(legacyTypeKey) && normalized.children === undefined) {
        const children = buildLegacyFormChildren(normalized);
        if (children !== undefined) {
          normalized.children = children;
        }

        if (normalized.direction === undefined) {
          normalized.direction = 'column';
        }

        if (normalized.gap === undefined) {
          normalized.gap = 8;
        }

        if (normalized.padding === undefined) {
          normalized.padding = 12;
        }
      }

      break;
    }

    default:
      break;
  }

  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined));
}

export function serializeComponentPropsForRuntime(
  componentType: string,
  props: Record<string, unknown>,
): Record<string, unknown> {
  const serialized: Record<string, unknown> = { ...props };

  switch (componentType) {
    case 'Text': {
      if (typeof serialized.align !== 'string' && typeof serialized.textAlign === 'string') {
        serialized.align = serialized.textAlign;
      }
      delete serialized.textAlign;
      break;
    }

    case 'Button': {
      serialized.variant = normalizeButtonVariant(serialized.variant);
      serialized.size = normalizeButtonSize(serialized.size);
      serializeActionProp(serialized, 'onPress', ['action']);
      break;
    }

    case 'Image': {
      if (typeof serialized.src !== 'string' && typeof serialized.uri === 'string') {
        serialized.src = serialized.uri;
      }
      if (serialized.aspectRatio === undefined && typeof serialized.aspect_ratio === 'number') {
        serialized.aspectRatio = serialized.aspect_ratio;
      }
      delete serialized.uri;
      delete serialized.aspect_ratio;
      serializeActionProp(serialized, 'onPress', ['action']);
      break;
    }

    case 'TextInput': {
      serializeActionProp(serialized, 'onSubmit', ['action', 'onPress']);
      break;
    }

    case 'InputBar': {
      serializeActionProp(serialized, 'onSend', ['action', 'onPress']);
      break;
    }

    case 'CalendarModule': {
      serialized.variant = normalizeCalendarView(serialized.variant ?? serialized.defaultView) ?? 'month';
      delete serialized.defaultView;
      break;
    }

    default:
      break;
  }

  return Object.fromEntries(Object.entries(serialized).filter(([, value]) => value !== undefined));
}

export function normalizeComponentForEditor(value: unknown): EditorComponent | null {
  if (typeof value === 'string') {
    const type = normalizeComponentType(value);
    const normalizedProps = normalizeComponentPropsForEditor(type, {}, value);
    const rawChildren = Array.isArray(normalizedProps.children) ? normalizedProps.children : undefined;

    delete normalizedProps.children;

    const children = rawChildren
      ?.map((child) => normalizeComponentForEditor(child))
      .filter((child): child is EditorComponent => child !== null);

    return {
      id: createEditorId(type.toLowerCase()),
      type,
      props: normalizedProps,
      ...(children && children.length > 0 ? { children } : {}),
    };
  }

  if (!isRecord(value)) return null;

  if (isRecord(value.content)) {
    return normalizeComponentForEditor(value.content);
  }

  const rawType = getRawComponentType(value);
  if (!rawType) return null;

  const type = normalizeComponentType(rawType);
  const nestedProps = isRecord(value.props) ? value.props : {};
  const mergedProps = { ...extractFlatProps(value), ...nestedProps };
  const normalizedProps = normalizeComponentPropsForEditor(type, mergedProps, rawType);

  const rawChildren = Array.isArray(value.children)
    ? value.children
    : Array.isArray((nestedProps as { children?: unknown[] }).children)
      ? (nestedProps as { children?: unknown[] }).children
      : Array.isArray(normalizedProps.children)
        ? normalizedProps.children as unknown[]
      : undefined;

  delete normalizedProps.children;

  const children = rawChildren
    ?.map((child) => normalizeComponentForEditor(child))
    .filter((child): child is EditorComponent => child !== null);

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : createEditorId(type.toLowerCase()),
    type,
    props: normalizedProps,
    ...(children && children.length > 0 ? { children } : {}),
  };
}

export function serializeComponentForRuntime(component: EditorComponent): EditorComponent {
  return {
    id: component.id || createEditorId(component.type.toLowerCase()),
    type: component.type,
    props: serializeComponentPropsForRuntime(component.type, component.props),
    ...(component.children && component.children.length > 0
      ? { children: component.children.map((child) => serializeComponentForRuntime(child)) }
      : {}),
  };
}

export function cloneEditorComponent(component: EditorComponent): EditorComponent {
  return {
    id: createEditorId(component.type.toLowerCase()),
    type: component.type,
    props: JSON.parse(JSON.stringify(component.props ?? {})) as Record<string, unknown>,
    ...(component.children && component.children.length > 0
      ? { children: component.children.map((child) => cloneEditorComponent(child)) }
      : {}),
  };
}