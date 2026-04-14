/**
 * @keel/renderer — SDUI V2 renderer, component registry, and theme system.
 *
 * Public API surface:
 *   - SDUIPageRenderer: renders a SDUIPage (V2 row-by-row layout)
 *   - registerComponent / resolveComponent / getRegisteredTypes: component registry
 *   - useBreakpoint: responsive size class hook
 *   - All atomic, structural, and composite components
 *   - Theme tokens: colors, spacing, typography, shadows
 */

// ── Renderer ──────────────────────────────────────────────────────────────
export { SDUIPageRenderer } from './renderer/SDUIPageRenderer';

// ── Registry ──────────────────────────────────────────────────────────────
export { registerComponent, resolveComponent, getRegisteredTypes } from './registry/componentRegistry';

// ── Presets ──────────────────────────────────────────────────────────────
export { registerPreset } from './registry/presets';
export type { Preset } from './registry/presets';

// ── Hooks ─────────────────────────────────────────────────────────────────
export { useBreakpoint } from './hooks/useBreakpoint';
export type { SizeClass } from './hooks/useBreakpoint';

// ── Atomic components ─────────────────────────────────────────────────────
export { SDUIText } from './components/atomic/SDUIText';
export { SDUIButton } from './components/atomic/SDUIButton';
export { SDUIIcon, resolveIconName } from './components/atomic/SDUIIcon';
export { SDUIImage } from './components/atomic/SDUIImage';
export { SDUITextInput } from './components/atomic/SDUITextInput';
export { SDUIDivider } from './components/atomic/SDUIDivider';
export { SDUIMarkdown } from './components/atomic/SDUIMarkdown';

// ── Structural components ─────────────────────────────────────────────────
export { SDUIContainer } from './components/structural/SDUIContainer';

// ── Composite components ──────────────────────────────────────────────────
export { CalendarModule } from './components/composite/CalendarModule';
export { ChatModule } from './components/composite/ChatModule';
export { NotesModule } from './components/composite/NotesModule';
export { InputBar } from './components/composite/InputBar';
export { SDUIForm } from './components/composite/SDUIForm';
export { ScreenOptions } from './components/composite/ScreenOptions';

// ── Theme ─────────────────────────────────────────────────────────────────
export { themeColors, themeShadows, resolveColor } from './theme/tokens';
export { colors, spacing, borderRadius, typography } from './theme/colors';
