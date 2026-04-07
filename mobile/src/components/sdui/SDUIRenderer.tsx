/**
 * SDUIRenderer — renders any SDUIComponent, SDUIScreen (v1), or SDUIPage (v2) from JSON.
 *
 * V1: Section-based layout (SDUIScreen → sections → components)
 * V2: Row-by-Row layout (SDUIPage → rows → cells → component)
 *
 * The renderer auto-detects the format via isSDUIPage().
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import type {
  SDUIComponent,
  SDUIScreen,
  SDUISection,
  SDUIAction,
  SDUIPage,
  SDUIRow,
  SDUICell,
  SDUIComponentV2,
  SDUIPayload,
} from '@/types/sdui';
import { isSDUIPage } from '@/types/sdui';
import { colors, spacing, typography } from '@/theme/colors';
import { resolveComponent } from '@/renderer/componentRegistry';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { resolveIconName } from '@/components/atomic/SDUIIcon';

// ── Flat-props extraction ─────────────────────────────────────────────────
// AI-generated JSON often omits the "props" wrapper required by the V2 schema.
// This extracts all non-structural keys as props so components still render.
const STRUCTURAL_KEYS = new Set(['type', 'id', 'children', 'props']);

function extractFlatProps(comp: SDUIComponentV2): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(comp)) {
    if (!STRUCTURAL_KEYS.has(k)) result[k] = v;
  }
  return result;
}

// ── Action dispatcher ─────────────────────────────────────────────────────
// Passed down to all components so they can fire actions without knowing
// feature-specific business logic (same principle as Airbnb GP IAction).

export type ActionDispatcher = (action: SDUIAction) => void;

// ── Screen renderer (V1 — section-based) ────────────────────────────────

interface SDUIScreenRendererProps {
  screen: SDUIScreen;
  onAction?: ActionDispatcher;
}

export function SDUIScreenRenderer({ screen, onAction }: SDUIScreenRendererProps) {
  const dispatch: ActionDispatcher = onAction ?? (() => {});
  return (
    <ScrollView style={styles.screenContainer} contentContainerStyle={styles.screenContent}>
      {screen.sections.map((section: SDUISection) => {
        // Support both singular `component` and plural `components` formats
        const comps: SDUIComponent[] = section.components
          ?? (section.component ? [section.component] : []);
        return (
          <View key={section.id} style={styles.section}>
            {section.title ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            ) : null}
            {comps.map((comp, idx) => (
              <SDUIRenderer key={comp.id ?? `${section.id}-c${idx}`} component={comp} onAction={dispatch} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Page renderer (V2 — Row-by-Row) ─────────────────────────────────────

interface SDUIPageRendererProps {
  page: SDUIPage;
  onAction?: ActionDispatcher;
}

export function SDUIPageRenderer({ page, onAction }: SDUIPageRendererProps) {
  const dispatch: ActionDispatcher = onAction ?? (() => {});
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
        style={[rowStyles.scrollableRow, row.backgroundColor ? { backgroundColor: row.backgroundColor } : null]}
        contentContainerStyle={{ gap }}
      >
        {cellElements}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        rowStyles.row,
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
  // Support old format (cell.component) and new format (cell.content) for backward compat.
  // The canonical format uses `content`; old AI-generated and pre-fix editor screens use `component`.
  const cellContent = cell.content ?? (cell as any).component ?? null;

  // Skip malformed cells (metadata objects, missing content)
  if (!cellContent) {
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
      <V2ComponentRenderer component={cellContent} dispatch={dispatch} />
    </View>
  );
}

/** Renders a V2 component using the component registry with fallback. */
function V2ComponentRenderer({
  component,
  dispatch,
}: {
  component: SDUIComponentV2;
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

  // Try V2 registry first
  const Comp = resolveComponent(component.type);
  if (Comp) {
    // Render children recursively if present (check multiple locations where agents place them)
    const kids = component.children
      ?? (component as any).content?.children
      ?? (props as any)?.children;
    // Strip children from props to avoid passing array as React prop
    const { children: _dropped, ...cleanProps } = (props ?? {}) as any;
    const childElements = kids?.map((child: SDUIComponentV2, idx: number) => (
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

  // Fallback: try old V1 switch-based renderer
  try {
    const v1Comp = component as unknown as SDUIComponent;
    const rendered = renderComponent(v1Comp, dispatch);
    if (rendered) return <View>{rendered}</View>;
  } catch {
    // Fall through to unknown fallback
  }

  // Unknown component — graceful fallback per versioning strategy
  return (
    <View style={styles.unknownComponent}>
      <Text style={styles.unknownText}>Unsupported: {component.type}</Text>
    </View>
  );
}

// ── Universal renderer (auto-detects V1 vs V2) ──────────────────────────

interface SDUIUniversalRendererProps {
  payload: SDUIPayload;
  onAction?: ActionDispatcher;
}

export function SDUIUniversalRenderer({ payload, onAction }: SDUIUniversalRendererProps) {
  if (isSDUIPage(payload)) {
    return <SDUIPageRenderer page={payload} onAction={onAction} />;
  }
  return <SDUIScreenRenderer screen={payload as SDUIScreen} onAction={onAction} />;
}

const rowStyles = StyleSheet.create({
  row: {
    marginBottom: 8,
  },
  scrollableRow: {
    marginBottom: 8,
  },
});

// ── V1 Component renderer ─────────────────────────────────────────────────

interface SDUIRendererProps {
  component: SDUIComponent;
  onAction?: ActionDispatcher;
}

export function SDUIRenderer({ component, onAction }: SDUIRendererProps) {
  const dispatch: ActionDispatcher = onAction ?? (() => {});
  try {
    return <View>{renderComponent(component, dispatch)}</View>;
  } catch {
    return (
      <View style={styles.unknownComponent}>
        <Text style={styles.unknownText}>Component error: {(component as any)?.type ?? 'unknown'}</Text>
      </View>
    );
  }
}

function renderComponent(comp: SDUIComponent, dispatch: ActionDispatcher): React.ReactNode {
  // Guard against malformed AI-generated JSON (missing required fields)
  if (!comp || !comp.type) {
    return <View key={(comp as any)?.id} style={styles.unknownComponent}><Text style={styles.unknownText}>Invalid component</Text></View>;
  }

  switch (comp.type) {

    // ── Text ──────────────────────────────────────────────────────────────
    case 'text': {
      const p = comp.props;
      const sizeMap = { xs: 11, sm: 13, md: 15, lg: 17 };
      return (
        <Text
          key={comp.id}
          style={[
            styles.text,
            { fontSize: sizeMap[p.size ?? 'md'] ?? 15 },
            p.bold && { fontWeight: '600' },
            p.italic && { fontStyle: 'italic' },
            p.color ? { color: p.color } : null,
            p.align ? { textAlign: p.align } : null,
          ]}
        >
          {p.content}
        </Text>
      );
    }

    // ── Heading ───────────────────────────────────────────────────────────
    case 'heading': {
      const p = comp.props;
      const fontSizes = { 1: 24, 2: 20, 3: 17 };
      return (
        <Text
          key={comp.id}
          style={[
            styles.heading,
            { fontSize: fontSizes[p.level ?? 2] ?? 20 },
            p.align ? { textAlign: p.align } : null,
          ]}
        >
          {p.content}
        </Text>
      );
    }

    // ── Button ────────────────────────────────────────────────────────────
    case 'button': {
      const p = comp.props;
      const variantStyle = {
        primary:     { bg: colors.primary,   text: '#fff' },
        secondary:   { bg: colors.surface,   text: colors.text },
        destructive: { bg: colors.error,     text: '#fff' },
        ghost:       { bg: 'transparent',    text: colors.primary },
      }[p.variant ?? 'primary'];
      return (
        <TouchableOpacity
          key={comp.id}
          style={[styles.button, { backgroundColor: variantStyle.bg }, p.disabled && styles.disabled]}
          onPress={() => !p.disabled && dispatch(p.action)}
          disabled={p.disabled}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={p.label}
        >
          <Text style={[styles.buttonText, { color: variantStyle.text }]}>{p.label}</Text>
        </TouchableOpacity>
      );
    }

    // ── Icon button ───────────────────────────────────────────────────────
    case 'icon_button': {
      const p = comp.props;
      return (
        <TouchableOpacity
          key={comp.id}
          style={styles.iconButton}
          onPress={() => dispatch(p.action)}
          accessibilityLabel={p.label}
        >
          <Text style={styles.iconButtonText}>{resolveIconName(p.icon)}</Text>
        </TouchableOpacity>
      );
    }

    // ── Divider ───────────────────────────────────────────────────────────
    case 'divider': {
      const spacingMap = { sm: 4, md: 8, lg: 16 };
      const v = spacingMap[comp.props.spacing ?? 'md'] ?? 8;
      return <View key={comp.id} style={[styles.divider, { marginVertical: v }]} />;
    }

    // ── Spacer ────────────────────────────────────────────────────────────
    case 'spacer': {
      const spacingMap = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };
      const h = spacingMap[comp.props.size ?? 'md'] ?? 16;
      return <View key={comp.id} style={{ height: h }} />;
    }

    // ── Card ──────────────────────────────────────────────────────────────
    case 'card': {
      const p = comp.props;
      return (
        <TouchableOpacity
          key={comp.id}
          style={[styles.card, p.elevated && styles.cardElevated]}
          onPress={p.action ? () => dispatch(p.action!) : undefined}
          activeOpacity={p.action ? 0.8 : 1}
          disabled={!p.action}
        >
          {p.title ? <Text style={styles.cardTitle}>{p.title}</Text> : null}
          {p.subtitle ? <Text style={styles.cardSubtitle}>{p.subtitle}</Text> : null}
          {comp.children?.map(child => (
            <View key={child.id}>{renderComponent(child, dispatch)}</View>
          ))}
        </TouchableOpacity>
      );
    }

    // ── Container (row / column layout) ──────────────────────────────────
    case 'container': {
      const p = comp.props;
      const gapMap: Record<string, number> = { none: 0, xs: 4, sm: 8, md: 12, lg: 20 };
      const paddingMap: Record<string, number> = { none: 0, xs: 4, sm: 8, md: 12, lg: 20 };
      const gap = gapMap[p.gap ?? 'md'] ?? 12;
      const pad = paddingMap[p.padding ?? 'none'] ?? 0;
      const justifyMap: Record<string, string> = {
        start: 'flex-start',
        center: 'center',
        end: 'flex-end',
        'space-between': 'space-between',
        'space-around': 'space-around',
      };
      return (
        <View
          key={comp.id}
          style={{
            flexDirection: p.direction ?? 'column',
            flexWrap: p.wrap ? 'wrap' : 'nowrap',
            gap,
            padding: pad,
            flex: p.flex ?? undefined,
            alignItems: p.align === 'center' ? 'center'
              : p.align === 'end' ? 'flex-end'
              : p.align === 'stretch' ? 'stretch'
              : 'flex-start',
            justifyContent: (justifyMap[p.justify ?? 'start'] ?? 'flex-start') as any,
          }}
        >
          {comp.children?.map(child => (
            <View key={child.id}>{renderComponent(child, dispatch)}</View>
          ))}
        </View>
      );
    }

    // ── List ──────────────────────────────────────────────────────────────
    case 'list': {
      const p = comp.props;
      return (
        <View key={comp.id}>
          {p.title ? <Text style={styles.listTitle}>{p.title}</Text> : null}
          {p.items.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.listItem, idx === p.items.length - 1 && styles.listItemLast]}
              onPress={item.action ? () => dispatch(item.action!) : undefined}
              activeOpacity={item.action ? 0.7 : 1}
              disabled={!item.action}
            >
              {item.icon ? <Text style={styles.listItemIcon}>{resolveIconName(item.icon)}</Text> : null}
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.listItemSubtitle}>{item.subtitle}</Text> : null}
              </View>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
              {item.right_text ? <Text style={styles.listItemRight}>{item.right_text}</Text> : null}
              {item.action ? <Text style={styles.chevron}>›</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    // ── Form ──────────────────────────────────────────────────────────────
    case 'form':
      return <FormRenderer key={comp.id} comp={comp} dispatch={dispatch} />;

    // ── Alert ─────────────────────────────────────────────────────────────
    case 'alert': {
      const p = comp.props;
      const severityColor = {
        info:    colors.primary,
        warning: colors.warning,
        error:   colors.error,
        success: colors.success,
      }[p.severity];
      const icons = { info: 'ℹ️', warning: '⚠️', error: '❌', success: '✅' };
      return (
        <View key={comp.id} style={[styles.alert, { borderLeftColor: severityColor, backgroundColor: severityColor + '18' }]}>
          <Text style={styles.alertIcon}>{icons[p.severity]}</Text>
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: severityColor }]}>{p.title}</Text>
            <Text style={styles.alertMessage}>{p.message}</Text>
          </View>
        </View>
      );
    }

    // ── Badge ─────────────────────────────────────────────────────────────
    case 'badge': {
      const p = comp.props;
      const bgMap = { blue: colors.primary, green: colors.success, red: colors.error, yellow: colors.warning, gray: colors.textSecondary };
      return (
        <View key={comp.id} style={[styles.badgeStandalone, { backgroundColor: (bgMap[p.color ?? 'blue'] ?? colors.primary) + '22' }]}>
          <Text style={[styles.badgeStandaloneText, { color: bgMap[p.color ?? 'blue'] ?? colors.primary }]}>{p.label}</Text>
        </View>
      );
    }

    // ── Stat ──────────────────────────────────────────────────────────────
    case 'stat': {
      const p = comp.props;
      const directionColor = { up: colors.success, down: colors.error, neutral: colors.textSecondary }[p.change_direction ?? 'neutral'];
      return (
        <View key={comp.id} style={styles.stat}>
          {p.icon ? <Text style={styles.statIcon}>{resolveIconName(p.icon)}</Text> : null}
          <Text style={styles.statValue}>{p.value}</Text>
          <Text style={styles.statLabel}>{p.label}</Text>
          {p.change ? <Text style={[styles.statChange, { color: directionColor }]}>{p.change}</Text> : null}
        </View>
      );
    }

    // ── Stats row ─────────────────────────────────────────────────────────
    case 'stats_row': {
      return (
        <View key={comp.id} style={styles.statsRow}>
          {comp.props.stats.map((s, i) => (
            <View key={i} style={styles.statsRowItem}>
              <Text style={styles.statsRowValue}>{s.value}</Text>
              <Text style={styles.statsRowLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      );
    }

    // ── Calendar (lightweight event list) ─────────────────────────────────
    case 'calendar': {
      const p = comp.props;
      return (
        <View key={comp.id} style={styles.calendarList}>
          {p.events.length === 0 ? (
            <Text style={styles.emptyText}>No events</Text>
          ) : (
            p.events.map(ev => (
              <View key={ev.id} style={[styles.calendarEvent, ev.color ? { borderLeftColor: ev.color } : null]}>
                <Text style={styles.calendarEventTitle}>{ev.title}</Text>
                <Text style={styles.calendarEventTime}>
                  {new Date(ev.start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </View>
      );
    }

    // ── Image ─────────────────────────────────────────────────────────────
    case 'image': {
      const p = comp.props;
      return (
        <Image
          key={comp.id}
          source={{ uri: p.uri }}
          style={{ width: '100%', aspectRatio: p.aspect_ratio ?? 16 / 9, borderRadius: 8 }}
          accessibilityLabel={p.alt}
          resizeMode="cover"
        />
      );
    }

    // ── Progress ──────────────────────────────────────────────────────────
    case 'progress': {
      const p = comp.props;
      const pct = Math.min(1, (p.value / (p.max ?? 100)));
      return (
        <View key={comp.id} style={styles.progressContainer}>
          {p.label ? <Text style={styles.progressLabel}>{p.label}</Text> : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: p.color ?? colors.primary }]} />
          </View>
          <Text style={styles.progressValue}>{Math.round(pct * 100)}%</Text>
        </View>
      );
    }

    default:
      return (
        <View style={styles.unknownComponent}>
          <Text style={styles.unknownText}>Unknown component: {(comp as any).type}</Text>
        </View>
      );
  }
}

// ── Form with local controlled state ─────────────────────────────────────

function FormRenderer({ comp, dispatch }: { comp: Extract<SDUIComponent, { type: 'form' }>; dispatch: ActionDispatcher }) {
  const p = comp.props;
  const initialValues: Record<string, string | boolean> = {};
  p.fields.forEach(f => {
    initialValues[f.id] = (f.default_value as string | boolean) ?? (f.type === 'checkbox' ? false : '');
  });
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues);

  const handleSubmit = () => {
    // Merge form values into the action
    const action = p.submit_action;
    if (action.type === 'server_action') {
      dispatch({ ...action, params: { ...(action.params ?? {}), ...values } });
    } else if (action.type === 'api_call') {
      dispatch({ ...action, body: { ...(action.body ?? {}), ...values } });
    } else {
      dispatch(action);
    }
  };

  return (
    <View style={styles.form}>
      {p.title ? <Text style={styles.formTitle}>{p.title}</Text> : null}
      {p.fields.map(field => (
        <View key={field.id} style={styles.formField}>
          <Text style={styles.formLabel}>
            {field.label}{field.required ? ' *' : ''}
          </Text>
          {field.type === 'checkbox' ? (
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setValues(v => ({ ...v, [field.id]: !v[field.id] }))}
            >
              <View style={[styles.checkboxBox, values[field.id] && styles.checkboxChecked]}>
                {values[field.id] ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>{field.placeholder ?? field.label}</Text>
            </TouchableOpacity>
          ) : field.type === 'select' ? (
            <View style={styles.selectContainer}>
              <Text style={styles.selectValue}>{String(values[field.id]) || 'Select…'}</Text>
              {field.options?.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.selectOption, values[field.id] === opt.value && styles.selectOptionSelected]}
                  onPress={() => setValues(v => ({ ...v, [field.id]: opt.value }))}
                >
                  <Text style={styles.selectOptionText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              style={styles.textInput}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={field.type === 'password'}
              keyboardType={field.type === 'number' ? 'numeric' : field.type === 'email' ? 'email-address' : 'default'}
              value={String(values[field.id] ?? '')}
              onChangeText={text => setValues(v => ({ ...v, [field.id]: text }))}
              multiline={field.type === 'textarea'}
              numberOfLines={field.type === 'textarea' ? 4 : 1}
            />
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={p.submit_label ?? 'Submit'}>
        <Text style={styles.submitButtonText}>{p.submit_label ?? 'Submit'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.md, paddingBottom: 40 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.caption1, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs, marginLeft: 4 },

  text: { ...typography.body, color: colors.text, marginVertical: 2 },
  heading: { fontWeight: '700', color: colors.text, marginVertical: 6 },

  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', marginVertical: 4 },
  buttonText: { fontWeight: '600', fontSize: 15 },
  disabled: { opacity: 0.4 },

  iconButton: { padding: 8 },
  iconButtonText: { fontSize: 22 },

  divider: { height: 1, backgroundColor: colors.divider },

  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, marginVertical: 4, borderWidth: 1, borderColor: colors.border },
  cardElevated: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardTitle: { ...typography.subheadline, color: colors.text, marginBottom: 4 },
  cardSubtitle: { ...typography.caption1, color: colors.textSecondary, marginBottom: 8 },

  listTitle: { ...typography.caption1, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs, marginLeft: 4 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  listItemLast: { borderBottomWidth: 0 },
  listItemIcon: { fontSize: 20, marginRight: 12 },
  listItemContent: { flex: 1 },
  listItemTitle: { ...typography.body, color: colors.text },
  listItemSubtitle: { ...typography.caption1, color: colors.textSecondary, marginTop: 2 },
  listItemRight: { ...typography.caption1, color: colors.textSecondary, marginRight: 8 },
  chevron: { color: colors.textSecondary, fontSize: 20, fontWeight: '300' },

  badge: { backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
  badgeText: { ...typography.caption1, color: colors.primary, fontWeight: '600' },

  badgeStandalone: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginVertical: 2 },
  badgeStandaloneText: { fontSize: 12, fontWeight: '600' },

  alert: { flexDirection: 'row', borderRadius: 10, padding: spacing.md, marginVertical: 4, borderLeftWidth: 4 },
  alertIcon: { fontSize: 18, marginRight: 10 },
  alertContent: { flex: 1 },
  alertTitle: { fontWeight: '700', fontSize: 14, marginBottom: 2 },
  alertMessage: { ...typography.body, color: colors.text, fontSize: 13 },

  stat: { alignItems: 'center', padding: spacing.md },
  statIcon: { fontSize: 28, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
  statLabel: { ...typography.caption1, color: colors.textSecondary, marginTop: 2 },
  statChange: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  statsRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statsRowItem: { flex: 1, alignItems: 'center' },
  statsRowValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statsRowLabel: { ...typography.caption1, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },

  calendarList: { gap: 8 },
  calendarEvent: { backgroundColor: colors.surface, borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
  calendarEventTitle: { fontWeight: '600', color: colors.text, fontSize: 14 },
  calendarEventTime: { ...typography.caption1, color: colors.textSecondary, marginTop: 2 },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 },

  progressContainer: { marginVertical: 6 },
  progressLabel: { ...typography.caption1, color: colors.textSecondary, marginBottom: 4 },
  progressTrack: { height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressValue: { ...typography.caption1, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },

  form: { gap: 12 },
  formTitle: { ...typography.subheadline, color: colors.text, marginBottom: 4 },
  formField: { gap: 4 },
  formLabel: { ...typography.caption1, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15, backgroundColor: colors.surface },
  selectContainer: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  selectValue: { padding: 10, color: colors.textSecondary, backgroundColor: colors.surface },
  selectOption: { padding: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  selectOptionSelected: { backgroundColor: colors.primary + '18' },
  selectOptionText: { ...typography.body, color: colors.text },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkboxBox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.border, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#fff', fontWeight: '700', fontSize: 13 },
  checkboxLabel: { ...typography.body, color: colors.text },
  submitButton: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  unknownComponent: { padding: spacing.md, backgroundColor: colors.error + '18', borderRadius: 8, borderWidth: 1, borderColor: colors.error },
  unknownText: { ...typography.body, color: colors.error },
});

