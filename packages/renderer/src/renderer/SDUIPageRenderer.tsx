/**
 * SDUIPageRenderer — V2 Row-by-Row page renderer.
 *
 * Accepts a SDUIPage and an ActionDispatcher, renders rows → cells → components
 * using the component registry. Handles responsive breakpoints via useBreakpoint.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { SDUIPage, SDUIRow, SDUICell, SDUIComponent, ActionDispatcher } from '@keel/protocol';
import { resolveComponent } from '../registry/componentRegistry';
import { useBreakpoint } from '../hooks/useBreakpoint';

// ── Flat-props extraction ─────────────────────────────────────────────────
// AI-generated JSON often omits the "props" wrapper required by the V2 schema.
// This extracts all non-structural keys as props so components still render.
const STRUCTURAL_KEYS = new Set(['type', 'id', 'children', 'props']);

function extractFlatProps(comp: SDUIComponent): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(comp)) {
    if (!STRUCTURAL_KEYS.has(k)) result[k] = v;
  }
  return result;
}

// ── Page renderer (V2 — Row-by-Row) ──────────────────────────────────────

interface SDUIPageRendererProps {
  page: SDUIPage;
  onAction: ActionDispatcher;
}

export function SDUIPageRenderer({ page, onAction }: SDUIPageRendererProps) {
  const dispatch: ActionDispatcher = onAction;
  const breakpoint = useBreakpoint();

  return (
    <ScrollView style={styles.screenContainer} contentContainerStyle={styles.screenContent}>
      {page.rows.map((row, idx) => (
        <RowRenderer key={row.id ?? `row-${idx}`} row={row} dispatch={dispatch} breakpoint={breakpoint} />
      ))}
    </ScrollView>
  );
}

function RowRenderer({
  row,
  dispatch,
  breakpoint,
}: {
  row: SDUIRow;
  dispatch: ActionDispatcher;
  breakpoint: 'compact' | 'regular';
}) {
  // Handle responsive visibility
  const bpConfig = breakpoint === 'compact' ? row.compact : row.regular;
  if (bpConfig?.hidden) return null;

  // Skip malformed rows without cells
  if (!row.cells || !Array.isArray(row.cells) || row.cells.length === 0) return null;

  // Stack cells vertically on compact if specified
  const shouldStack = breakpoint === 'compact' && row.compact?.stack;
  const gap = row.gap ?? 12;

  const cellElements = row.cells.map((cell, ci) => (
    <CellRenderer key={cell.id ?? `cell-${ci}`} cell={cell} dispatch={dispatch} />
  ));

  // Scrollable row (horizontal carousel with snap)
  if (row.scrollable) {
    return (
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={[styles.scrollableRow, row.backgroundColor ? { backgroundColor: row.backgroundColor } : null]}
        contentContainerStyle={{ gap }}
      >
        {cellElements}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        styles.row,
        {
          flexDirection: shouldStack ? 'column' : 'row',
          gap,
        },
        row.backgroundColor ? { backgroundColor: row.backgroundColor } : null,
        row.padding ? { padding: typeof row.padding === 'number' ? row.padding : 0 } : null,
      ]}
    >
      {cellElements}
    </View>
  );
}

function CellRenderer({
  cell,
  dispatch,
}: {
  cell: SDUICell;
  dispatch: ActionDispatcher;
}) {
  // Skip malformed cells (metadata objects, missing content)
  if (!cell.content) {
    // Detect nested row objects masquerading as cells (agent error)
    if ((cell as any).cells && Array.isArray((cell as any).cells)) {
      return <RowRenderer row={cell as any} dispatch={dispatch} breakpoint="compact" />;
    }
    return null;
  }

  const width = cell.width;
  const flexStyle = width === 'auto' || width === undefined
    ? { flex: 1 }
    : { flex: width };

  return (
    <View style={flexStyle}>
      <V2ComponentRenderer component={cell.content} dispatch={dispatch} />
    </View>
  );
}

/** Renders a V2 component using the component registry with fallback. */
function V2ComponentRenderer({
  component,
  dispatch,
}: {
  component: SDUIComponent;
  dispatch: ActionDispatcher;
}) {
  if (!component || !component.type) {
    // Unwrap cell-format children: { id, width, content: { type, ... } }
    if ((component as any)?.content?.type) {
      const inner = (component as any).content;
      const unwrapped = { ...inner, id: inner.id ?? (component as any).id };
      return <V2ComponentRenderer component={unwrapped} dispatch={dispatch} />;
    }
    return (
      <View style={styles.unknownComponent}>
        <Text style={styles.unknownText}>Invalid component</Text>
      </View>
    );
  }

  // Extract props: merge explicit props with any flat top-level keys.
  // Agents often place some props at the top level and some inside "props".
  const flatProps = extractFlatProps(component);
  const props = Object.keys(flatProps).length > 0
    ? { ...flatProps, ...(component.props ?? {}) }
    : (component.props ?? {});

  const Comp = resolveComponent(component.type);
  if (Comp) {
    // Render children recursively if present (check multiple locations where agents place them)
    const kids = component.children
      ?? (component as any).content?.children
      ?? (props as any)?.children;
    // Strip children from props to avoid passing array as React prop
    const { children: _dropped, ...cleanProps } = (props ?? {}) as any;
    const childElements = kids?.map((child: SDUIComponent, idx: number) => (
      <V2ComponentRenderer
        key={child.id ?? `${component.id}-child-${idx}`}
        component={child}
        dispatch={dispatch}
      />
    ));

    return (
      <Comp {...cleanProps} dispatch={dispatch}>
        {childElements}
      </Comp>
    );
  }

  // Unknown component — graceful fallback per versioning strategy
  return (
    <View style={styles.unknownComponent}>
      <Text style={styles.unknownText}>Unsupported: {component.type}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  screenContent: { padding: 16, paddingBottom: 40 },
  row: {
    marginBottom: 8,
  },
  scrollableRow: {
    marginBottom: 8,
  },
  unknownComponent: {
    padding: 16,
    backgroundColor: '#FF3B3018',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  unknownText: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    color: '#FF3B30',
  },
});
