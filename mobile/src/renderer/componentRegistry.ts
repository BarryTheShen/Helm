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
import { SDUIButton } from '@/components/atomic/SDUIButton';
import { SDUIImage } from '@/components/atomic/SDUIImage';
import { SDUITextInput } from '@/components/atomic/SDUITextInput';
import { SDUIIcon } from '@/components/atomic/SDUIIcon';
import { SDUIDivider } from '@/components/atomic/SDUIDivider';

// Tier 1 — Structural
import { SDUIContainer } from '@/components/structural/SDUIContainer';

// Tier 3 — Composite
import { CalendarModule } from '@/components/composite/CalendarModule';
import { ChatModule } from '@/components/composite/ChatModule';
import { NotesModule } from '@/components/composite/NotesModule';
import { InputBar } from '@/components/composite/InputBar';

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
  CalendarModule: CalendarModule,
  ChatModule: ChatModule,
  NotesModule: NotesModule,
  InputBar: InputBar,
};

/** Look up a component by its SDUI type string. Returns null if not found. */
export function resolveComponent(type: string): ComponentType<any> | null {
  return registry[type] ?? null;
}

/** Register a new component type at runtime (for plugins/extensions). */
export function registerComponent(type: string, component: ComponentType<any>) {
  registry[type] = component;
}

/** Get all registered type names. */
export function getRegisteredTypes(): string[] {
  return Object.keys(registry);
}
