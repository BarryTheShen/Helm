# Autopilot Spec: Preset/Adapter System + Paper Preset

## Goal
Add a preset/adapter system to `@keel/renderer` so users can swap the underlying UI library (React Native Paper, Tamagui, etc.) with one line. Build a React Native Paper preset as the first official adapter. Update the demo app to showcase it.

## What "This" Means
- `registerPreset(PaperPreset)` replaces all built-in component renderers with Paper equivalents
- The protocol (`@keel/protocol`) stays unchanged — same JSON, different visual output
- Presets are optional — built-in components remain the default

## Deliverables
1. **Preset type + registerPreset API** in renderer package
2. **React Native Paper preset** mapping all atomic + structural components
3. **Updated keel-demo** showing Paper preset usage
4. **Tests** for preset registration, override, and Paper mapping
5. **Package config** updates (peer deps, exports)

## UI Lib Choice: React Native Paper
- Most popular RN component library (~13k GitHub stars)
- Material Design 3, great theming
- Maps well to Keel atomic types (Button, Text, TextInput, Divider, Icon, Card)

## Architecture
- `Preset = Record<string, ComponentType<any>>` — simple type-to-component map
- `registerPreset(preset)` iterates and calls `registerComponent()` for each entry
- Presets can be partial — only override what they provide, fallback to built-in
- No breaking changes to existing API
