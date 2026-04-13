/**
 * Preset system — swap all component renderers with one call.
 *
 * A preset is a partial map of SDUI type names to React components.
 * registerPreset() calls registerComponent() for each entry, so presets
 * can be partial — types not in the preset keep their built-in renderer.
 */
import type { ComponentType } from 'react';
import { registerComponent } from './componentRegistry';

/** A preset maps SDUI type strings to React components. Partial is fine. */
export type Preset = Record<string, ComponentType<any>>;

/** Apply a preset — registers every component in the map. Existing entries are overwritten. */
export function registerPreset(preset: Preset): void {
  for (const [type, component] of Object.entries(preset)) {
    registerComponent(type, component);
  }
}
