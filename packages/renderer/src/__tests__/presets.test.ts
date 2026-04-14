/**
 * Tests for the preset system — registerPreset, partial presets, override behavior.
 */
import {
  registerComponent,
  resolveComponent,
  getRegisteredTypes,
} from '../registry/componentRegistry';
import { registerPreset } from '../registry/presets';
import type { Preset } from '../registry/presets';

describe('registerPreset', () => {
  // ── Basic registration ─────────────────────────────────────────────────

  it('registers all components in a preset', () => {
    const FakeButton = () => null;
    const FakeText = () => null;
    const preset: Preset = { PresetBtn: FakeButton, PresetTxt: FakeText };

    registerPreset(preset);

    expect(resolveComponent('PresetBtn')).toBe(FakeButton);
    expect(resolveComponent('PresetTxt')).toBe(FakeText);
  });

  it('registers components that appear in getRegisteredTypes', () => {
    const Comp = () => null;
    registerPreset({ PresetWidget: Comp });
    expect(getRegisteredTypes()).toContain('PresetWidget');
  });

  // ── Override behavior ──────────────────────────────────────────────────

  it('overrides built-in components', () => {
    const originalButton = resolveComponent('Button');
    expect(originalButton).not.toBeNull();

    const ReplacementButton = () => null;
    registerPreset({ Button: ReplacementButton });

    expect(resolveComponent('Button')).toBe(ReplacementButton);
    expect(resolveComponent('Button')).not.toBe(originalButton);
  });

  it('preserves components not in the preset', () => {
    // CalendarModule should still be the built-in after applying a partial preset
    const calBefore = resolveComponent('CalendarModule');
    expect(calBefore).not.toBeNull();

    registerPreset({ Button: () => null });

    expect(resolveComponent('CalendarModule')).toBe(calBefore);
  });

  it('preserves previously registered custom components', () => {
    const Custom = () => null;
    registerComponent('MyCustomWidget', Custom);

    registerPreset({ Text: () => null });

    expect(resolveComponent('MyCustomWidget')).toBe(Custom);
  });

  // ── Partial presets ────────────────────────────────────────────────────

  it('handles a single-component preset', () => {
    const SingleComp = () => null;
    registerPreset({ OnlyOne: SingleComp });
    expect(resolveComponent('OnlyOne')).toBe(SingleComp);
  });

  it('handles an empty preset without error', () => {
    expect(() => registerPreset({})).not.toThrow();
  });

  // ── Multiple presets ───────────────────────────────────────────────────

  it('last preset wins for overlapping types', () => {
    const First = () => null;
    const Second = () => null;

    registerPreset({ Overlap: First });
    expect(resolveComponent('Overlap')).toBe(First);

    registerPreset({ Overlap: Second });
    expect(resolveComponent('Overlap')).toBe(Second);
  });

  it('merges non-overlapping types from multiple presets', () => {
    const A = () => null;
    const B = () => null;

    registerPreset({ TypeA: A });
    registerPreset({ TypeB: B });

    expect(resolveComponent('TypeA')).toBe(A);
    expect(resolveComponent('TypeB')).toBe(B);
  });

  // ── Built-in count preserved ───────────────────────────────────────────

  it('still has at least 14 types after applying a preset', () => {
    registerPreset({ Button: () => null, Text: () => null });
    expect(getRegisteredTypes().length).toBeGreaterThanOrEqual(14);
  });
});
