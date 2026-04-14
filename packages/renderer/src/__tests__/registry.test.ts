/**
 * Tests for the component registry — register, resolve, getRegisteredTypes.
 */
import {
  registerComponent,
  resolveComponent,
  getRegisteredTypes,
} from '../registry/componentRegistry';

describe('componentRegistry', () => {
  // ── Built-in components ────────────────────────────────────────────────

  it('resolves built-in Text component', () => {
    expect(resolveComponent('Text')).not.toBeNull();
  });

  it('resolves built-in Button component', () => {
    expect(resolveComponent('Button')).not.toBeNull();
  });

  it('resolves built-in Container component', () => {
    expect(resolveComponent('Container')).not.toBeNull();
  });

  it('resolves built-in CalendarModule component', () => {
    expect(resolveComponent('CalendarModule')).not.toBeNull();
  });

  it('returns null for unknown type', () => {
    expect(resolveComponent('NonExistentWidget')).toBeNull();
  });

  // ── Registration ───────────────────────────────────────────────────────

  it('registers and resolves a custom component', () => {
    const FakeComponent = () => null;
    registerComponent('TestWidget', FakeComponent);
    expect(resolveComponent('TestWidget')).toBe(FakeComponent);
  });

  it('overwrites existing registration', () => {
    const Original = () => null;
    const Replacement = () => null;
    registerComponent('OverwriteTest', Original);
    registerComponent('OverwriteTest', Replacement);
    expect(resolveComponent('OverwriteTest')).toBe(Replacement);
  });

  // ── getRegisteredTypes ─────────────────────────────────────────────────

  it('returns all built-in type names', () => {
    const types = getRegisteredTypes();
    expect(types).toContain('Text');
    expect(types).toContain('Button');
    expect(types).toContain('Image');
    expect(types).toContain('Markdown');
    expect(types).toContain('Icon');
    expect(types).toContain('Divider');
    expect(types).toContain('TextInput');
    expect(types).toContain('Container');
    expect(types).toContain('CalendarModule');
    expect(types).toContain('ChatModule');
    expect(types).toContain('NotesModule');
    expect(types).toContain('InputBar');
    expect(types).toContain('Form');
    expect(types).toContain('ScreenOptions');
  });

  it('includes custom-registered types', () => {
    registerComponent('MyCustomType', () => null);
    expect(getRegisteredTypes()).toContain('MyCustomType');
  });

  it('has at least 14 built-in types', () => {
    // 7 atomic + 1 structural + 6 composite = 14
    expect(getRegisteredTypes().length).toBeGreaterThanOrEqual(14);
  });

  // ── Form and ScreenOptions ────────────────────────────────────────────

  it('resolves built-in Form component', () => {
    expect(resolveComponent('Form')).not.toBeNull();
  });

  it('resolves built-in ScreenOptions component', () => {
    expect(resolveComponent('ScreenOptions')).not.toBeNull();
  });
});
