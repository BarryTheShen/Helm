/**
 * Component Registry — maps SDUI type strings to React components.
 *
 * Both V1 (legacy lowercase) and V2 (PascalCase) type names are registered.
 * Unknown types return null — the renderer shows a graceful fallback.
 */
import type { ComponentType } from 'react';

// Tier 2 — Atomic
import { SDUIText } from '@/components/atomic/SDUIText';
import { SDUIMarkdown } from '@/components/atomic/SDUIMarkdown';
import { SDUIRichTextRenderer } from '@/components/atomic/SDUIRichTextRenderer';
import { SDUIButton } from '@/components/atomic/SDUIButton';
import { SDUIImage } from '@/components/atomic/SDUIImage';
import { SDUITextInput } from '@/components/atomic/SDUITextInput';
import { SDUIIcon } from '@/components/atomic/SDUIIcon';
import { SDUIDivider } from '@/components/atomic/SDUIDivider';

// Tier 1 — Structural
import { SDUIContainer } from '@/components/structural/SDUIContainer';
import { SDUIEmpty } from '@/components/structural/SDUIEmpty';

// Tier 3 — Composite
import { CalendarModule } from '@/components/composite/CalendarModule';
import { ChatModule } from '@/components/composite/ChatModule';
import { NotesModule } from '@/components/composite/NotesModule';
import { TodoModule } from '@/components/composite/TodoModule';
import { ArticleCardModule } from '@/components/composite/ArticleCardModule';
import { InputBar } from '@/components/composite/InputBar';

// Tier 4 — SDUI-specific (shared across V1 + V2)
import { SDUIBadge } from '@/components/sdui/SDUIBadge';
import { SDUIStat } from '@/components/sdui/SDUIStat';
import { ListComponent } from '@/components/sdui/ListComponent';
import { AlertComponent } from '@/components/sdui/AlertComponent';
import { TodoComponent } from '@/components/sdui/TodoComponent';
import { RichTextRendererComponent } from '@/components/sdui/RichTextRendererComponent';
import { ArticleCardComponent } from '@/components/sdui/ArticleCardComponent';

// Registry: type string → React component
// Components receive { ...props, dispatch, children? }
const registry: Record<string, ComponentType<any>> = {
  // V2 PascalCase names (preferred)
  Text: SDUIText,
  Markdown: SDUIMarkdown,
  Button: SDUIButton,
  Image: SDUIImage,
  TextInput: SDUITextInput,
  Icon: SDUIIcon,
  Divider: SDUIDivider,
  Container: SDUIContainer,
  Empty: SDUIEmpty,
  CalendarModule: CalendarModule,
  ChatModule: ChatModule,
  NotesModule: NotesModule,
  TodoModule: TodoModule,
  ArticleCardModule: ArticleCardModule,
  InputBar: InputBar,
  // Composites used by AI-generated SDUI
  Badge: SDUIBadge,
  Stat: SDUIStat,
  List: ListComponent,
  Alert: AlertComponent,
  Todo: TodoComponent,
  RichText: RichTextRendererComponent,
  RichTextRenderer: RichTextRendererComponent,
  ArticleCard: ArticleCardComponent,
  // Backend snake_case aliases
  article_card: ArticleCardComponent,
  rich_text_renderer: RichTextRendererComponent,
  todo: TodoComponent,
};

// Build a case-insensitive index: lowercase key → canonical PascalCase key
const lowercaseIndex: Record<string, string> = {};
for (const key of Object.keys(registry)) {
  lowercaseIndex[key.toLowerCase()] = key;
}

/** Look up a component by its SDUI type string (case-insensitive). Returns null if not found. */
export function resolveComponent(type: string): ComponentType<any> | null {
  // Try exact match first, then fall back to case-insensitive lookup
  return registry[type] ?? registry[lowercaseIndex[type.toLowerCase()]] ?? null;
}

/** Register a new component type at runtime (for plugins/extensions). */
export function registerComponent(type: string, component: ComponentType<any>) {
  registry[type] = component;
  lowercaseIndex[type.toLowerCase()] = type;
}

/** Get all registered type names. */
export function getRegisteredTypes(): string[] {
  return Object.keys(registry);
}
