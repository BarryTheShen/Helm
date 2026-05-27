/* eslint-disable @typescript-eslint/no-explicit-any */
import { type CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import { renderLucideIcon } from '../lib/lucideIcon';
import { hasMarkdownSyntax, markdownWithHardBreaks } from '../lib/sduiTextContent';
import { resolveVariables } from '../editor/variableResolver';
import { CalendarPreview } from './calendar/CalendarPreview';

interface SDUIComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: SDUIComponent[];
}

interface SDUICell {
  id: string;
  width: number | string;
  content: SDUIComponent | null;
}

interface SDUIRow {
  id: string;
  type?: 'content' | 'divider' | 'spacer';
  height: number | 'auto';
  cells: SDUICell[];
  backgroundColor?: string;
  bgColor?: string;
  paddingTop?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  paddingRight?: number | string;
  padding?: number | string;
  gap?: number;
  scrollable?: boolean;
  showDivider?: boolean;
  dividerColor?: string;
  dividerThickness?: number;
  dividerMargin?: number;
  spacerHeight?: number;
}

interface SDUIScreen {
  rows: SDUIRow[];
}

interface SDUIPreviewProps {
  json: SDUIScreen | string;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
  /** When true, render module content only (no outer phone chrome). Used inside AppPhoneShell. */
  embedded?: boolean;
  /** Match published app dark mode in embedded previews (FF4-APP-020). */
  darkMode?: boolean;
}

// Component preview renderers (simplified versions from EditorCanvas)
function TextPreview({ content, variant, fontSize, fontWeight, color, align, bold, italic, darkMode }: any) {
  const semanticStyle = variant === 'heading'
    ? { fontSize: 28, fontWeight: '700', lineHeight: 1.2 }
    : variant === 'caption'
      ? { fontSize: 12, fontWeight: '400', lineHeight: 1.4 }
      : { fontSize: 16, fontWeight: '400', lineHeight: 1.5 };

  const resolvedContent = resolveVariables(content || 'Text');
  const useMarkdown = hasMarkdownSyntax(resolvedContent);
  const defaultColor = darkMode ? '#F3F4F6' : '#000';

  const resolvedFontSize = typeof fontSize === 'number' ? fontSize : semanticStyle.fontSize;
  const resolvedFontWeight = (typeof fontWeight === 'string' && fontWeight.length > 0) || typeof fontWeight === 'number'
    ? String(fontWeight)
    : bold
      ? '700'
      : semanticStyle.fontWeight;

  const baseStyle: CSSProperties = {
    fontSize: resolvedFontSize,
    fontWeight: resolvedFontWeight,
    fontStyle: italic ? 'italic' : 'normal',
    lineHeight: semanticStyle.lineHeight,
    color: color || defaultColor,
    textAlign: (align || 'left') as CSSProperties['textAlign'],
    padding: '4px 0',
  };

  if (!useMarkdown) {
    return (
      <div data-testid="text-preview" style={{ ...baseStyle, whiteSpace: 'pre-wrap' }}>
        {resolvedContent}
      </div>
    );
  }

  const markdownStyle: CSSProperties = {
    ...semanticStyle,
    color: color || defaultColor,
    textAlign: align || 'left',
    padding: '4px 0',
  };

  return (
    <div data-testid="text-preview" style={markdownStyle}>
      <ReactMarkdown>{markdownWithHardBreaks(resolvedContent)}</ReactMarkdown>
    </div>
  );
}

function ButtonPreview({ label, variant, size, icon, iconPosition = 'left' }: any) {
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white',
    secondary: 'bg-gray-200 text-gray-800',
    ghost: 'bg-transparent text-gray-600',
    destructive: 'bg-red-600 text-white',
    icon: 'bg-transparent text-blue-600',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg',
  };
  const iconNode = renderLucideIcon(icon || 'star', 18, 'shrink-0');

  if (variant === 'icon') {
    return (
      <button className="flex h-full w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600">
        {renderLucideIcon(icon || 'star', 24, 'shrink-0')}
      </button>
    );
  }

  return (
    <button className={`flex h-full w-full items-center justify-center gap-1.5 rounded-md font-medium ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`}>
      {!!icon && iconPosition !== 'right' && iconNode}
      {label || 'Button'}
      {!!icon && iconPosition === 'right' && iconNode}
    </button>
  );
}

function ImagePreview({ src, height, aspectRatio, borderRadius }: any) {
  return (
    <img
      src={src || 'https://via.placeholder.com/300x200'}
      alt=""
      style={{
        width: '100%',
        height: height || undefined,
        aspectRatio: aspectRatio || (height ? undefined : 16 / 9),
        borderRadius: borderRadius || 0,
        objectFit: 'cover',
      }}
    />
  );
}

function MarkdownPreview(props: any) {
  return <TextPreview {...props} />;
}

function DividerPreview({ color, thickness, margin }: any) {
  return <hr style={{ borderColor: color || '#E0E0E0', borderWidth: thickness ?? 1, margin: `${margin ?? 8}px 0` }} />;
}

function IconPreview({ name, size, color }: any) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ color: color || '#000' }}
    >
      {renderLucideIcon(name || 'star', size || 24)}
    </span>
  );
}

function EmptyPreview({ children }: { children?: SDUIComponent[] }) {
  return (
    <div
      className="flex min-h-[48px] w-full flex-1 flex-col rounded border border-dashed border-gray-200"
      data-testid="empty-container-preview"
    >
      {children && children.length > 0 ? (
        children.map((child, index) => (
          <div key={child.id || index} className="w-full flex-1" style={{ minHeight: 0 }}>
            <ComponentPreview component={child} />
          </div>
        ))
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs italic text-gray-400">Empty container</div>
      )}
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-sm font-bold mb-2">💬 Chat</div>
      <div className="space-y-1.5 text-xs">
        <div className="flex"><span className="bg-gray-100 rounded-lg px-2 py-1">Hi! How can I help?</span></div>
        <div className="flex justify-end"><span className="bg-blue-600 text-white rounded-lg px-2 py-1">Show events</span></div>
      </div>
    </div>
  );
}

function NotesPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-sm font-bold mb-2">📓 Notes</div>
      <div className="text-xs text-gray-400 space-y-1">
        <p>Meeting notes from today...</p>
        <p className="text-gray-300">Start typing to edit...</p>
      </div>
    </div>
  );
}

function InputBarPreview({ placeholder }: any) {
  return (
    <div className="bg-white rounded-lg border p-2 flex gap-1.5">
      <input type="text" placeholder={placeholder || 'Type a message...'} className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs" readOnly />
      <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs">Send</button>
    </div>
  );
}

function TodoPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-sm font-bold mb-2">✓ To-Do</div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <input type="checkbox" className="rounded" readOnly />
          <span>Complete project</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" defaultChecked className="rounded" readOnly />
          <span className="line-through text-gray-400">Review code</span>
        </div>
      </div>
    </div>
  );
}

function ArticleCardPreview({ title, summary, imageUrl }: any) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {imageUrl && (
        <div className="h-32 bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
          📷 {imageUrl}
        </div>
      )}
      <div className="p-3">
        <div className="text-sm font-bold mb-1">{title || 'Article Title'}</div>
        <div className="text-xs text-gray-600">{summary || 'Article summary...'}</div>
      </div>
    </div>
  );
}

function RichTextRendererPreview({ content }: any) {
  return (
    <div className="text-sm text-gray-700 leading-relaxed">
      {content || 'Rich text content...'}
    </div>
  );
}

function ContainerPreview({ children }: any) {
  return (
    <div className="border border-gray-200 rounded-md p-2">
      {children && Array.isArray(children) && children.map((child: SDUIComponent, idx: number) => (
        <ComponentPreview key={child.id || idx} component={child} />
      ))}
    </div>
  );
}

const PREVIEW_RENDERERS: Record<string, (props: any) => React.JSX.Element> = {
  Text: TextPreview,
  text: TextPreview,
  Markdown: MarkdownPreview,
  markdown: MarkdownPreview,
  Button: ButtonPreview,
  button: ButtonPreview,
  Image: ImagePreview,
  image: ImagePreview,
  Icon: IconPreview,
  icon: IconPreview,
  Divider: DividerPreview,
  divider: DividerPreview,
  Container: ContainerPreview,
  container: ContainerPreview,
  CalendarModule: CalendarPreview,
  calendarmodule: CalendarPreview,
  calendar: CalendarPreview,
  ChatModule: ChatPreview,
  chatmodule: ChatPreview,
  chat: ChatPreview,
  NotesModule: NotesPreview,
  notesmodule: NotesPreview,
  notes: NotesPreview,
  InputBar: InputBarPreview,
  inputbar: InputBarPreview,
  Todo: TodoPreview,
  todo: TodoPreview,
  ArticleCard: ArticleCardPreview,
  article_card: ArticleCardPreview,
  RichTextRenderer: RichTextRendererPreview,
  rich_text_renderer: RichTextRendererPreview,
  Empty: EmptyPreview,
  empty: EmptyPreview,
};

function ComponentPreview({ component, darkMode }: { component: SDUIComponent; darkMode?: boolean }) {
  const Renderer = PREVIEW_RENDERERS[component.type];
  if (Renderer) {
    return (
      <div className="h-full w-full min-h-0 flex flex-1 flex-col">
        <Renderer {...component.props} darkMode={darkMode} children={component.children} />
      </div>
    );
  }
  return <div className={`text-xs italic p-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Unknown: {component.type}</div>;
}

function resolveSpacingValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function getRowStyle(row: SDUIRow): CSSProperties {
  const rowType = row.type ?? 'content';

  if (rowType === 'divider') {
    const thickness = typeof row.dividerThickness === 'number' ? row.dividerThickness : 1;
    const color = row.dividerColor || '#E0E0E0';
    const margin = typeof row.dividerMargin === 'number' ? row.dividerMargin : 8;
    return {
      minHeight: thickness + margin * 2,
      display: 'flex',
      alignItems: 'center',
      marginTop: margin,
      marginBottom: margin,
      backgroundColor: color,
      height: thickness,
    };
  }

  if (rowType === 'spacer') {
    const height = typeof row.spacerHeight === 'number' ? row.spacerHeight : 24;
    return {
      minHeight: height,
      height,
    };
  }

  const uniformPadding = resolveSpacingValue(row.padding);
  const backgroundColor = row.backgroundColor ?? row.bgColor;

  const style: CSSProperties = {
    minHeight: typeof row.height === 'number' ? row.height : 48,
    display: 'flex',
    gap: row.gap ?? 4,
    paddingTop: resolveSpacingValue(row.paddingTop) ?? uniformPadding ?? 0,
    paddingBottom: resolveSpacingValue(row.paddingBottom) ?? uniformPadding ?? 0,
    paddingRight: resolveSpacingValue(row.paddingRight) ?? uniformPadding ?? 4,
    paddingLeft: resolveSpacingValue(row.paddingLeft) ?? uniformPadding ?? 0,
    overflowX: row.scrollable ? 'auto' : 'visible',
    overflowY: 'hidden',
  };

  if (typeof row.height === 'number') {
    style.height = row.height;
  }

  if (backgroundColor) {
    style.backgroundColor = backgroundColor;
  }

  if (row.showDivider) {
    const thickness = typeof row.dividerThickness === 'number' ? row.dividerThickness : 1;
    const color = row.dividerColor || '#E0E0E0';
    const margin = typeof row.dividerMargin === 'number' ? row.dividerMargin : 0;
    style.borderBottom = `${thickness}px solid ${color}`;
    if (margin > 0) {
      style.marginBottom = margin;
    }
  }

  return style;
}

function getNumericCellWidth(width: SDUICell['width']): number {
  if (typeof width === 'string' && width.endsWith('%')) {
    const parsed = parseFloat(width);
    return isNaN(parsed) ? 1 : parsed;
  }
  return typeof width === 'number' ? width : 1;
}

function getCellStyle(row: SDUIRow, cellWidth: SDUICell['width'], totalWidth: number): CSSProperties {
  if (row.scrollable) {
    return {
      flex: '0 0 auto',
      width: `${Math.max(getNumericCellWidth(cellWidth) * 160, 120)}px`,
      minWidth: 120,
    };
  }

  if (cellWidth === 'auto') {
    return {
      flex: '1 1 0%',
      minWidth: 40,
    };
  }

  if (typeof cellWidth === 'string' && cellWidth.endsWith('%')) {
    return {
      flex: `0 0 ${cellWidth}`,
      width: cellWidth,
      minWidth: 40,
    };
  }

  const cellPercent = (getNumericCellWidth(cellWidth) / totalWidth) * 100;
  return {
    flex: `${cellPercent} 0 0%`,
    minWidth: 40,
  };
}

export function SDUIPreview({
  json,
  className = '',
  maxWidth = 375,
  maxHeight = 667,
  embedded = false,
  darkMode = false,
}: SDUIPreviewProps) {
  let screen: SDUIScreen;

  try {
    if (typeof json === 'string') {
      screen = JSON.parse(json);
    } else {
      screen = json;
    }

    if (!screen || !Array.isArray(screen.rows)) {
      throw new Error('Invalid SDUI structure: missing rows array');
    }
  } catch (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="text-red-700 font-medium mb-2">Invalid SDUI JSON</div>
        <div className="text-red-600 text-sm">{error instanceof Error ? error.message : 'Failed to parse JSON'}</div>
      </div>
    );
  }

  const rowContent = screen.rows.length === 0 ? (
    <div className={`text-center py-8 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No content</div>
  ) : (
    screen.rows.map((row, rowIdx) => {
      const rowType = row.type ?? 'content';

      if (rowType === 'divider' || rowType === 'spacer') {
        return (
          <div
            key={row.id || rowIdx}
            data-testid={rowType === 'divider' ? 'row-divider-preview' : 'row-spacer-preview'}
            style={getRowStyle(row)}
          />
        );
      }

      const totalWidth = row.cells.reduce((sum, cell) => sum + getNumericCellWidth(cell.width), 0);

      return (
        <div
          key={row.id || rowIdx}
          className="mb-1 rounded"
          style={getRowStyle(row)}
        >
          {row.cells.map((cell, cellIdx) => (
            <div
              key={cell.id || cellIdx}
              className="rounded p-1 flex min-h-0 flex-col"
              style={getCellStyle(row, cell.width, totalWidth)}
            >
              {cell.content ? (
                <ComponentPreview component={cell.content} darkMode={darkMode} />
              ) : (
                <div className={`flex items-center justify-center h-full min-h-[40px] border border-dashed rounded text-xs ${
                  darkMode
                    ? 'bg-gray-800 border-gray-700 text-gray-600'
                    : 'bg-gray-50 border-gray-200 text-gray-300'
                }`}>
                  Empty
                </div>
              )}
            </div>
          ))}
        </div>
      );
    })
  );

  if (embedded) {
    return (
      <div
        className={`h-full w-full overflow-y-auto flex flex-col ${darkMode ? 'bg-gray-900' : ''} ${className}`}
        data-testid="sdui-preview-embedded"
        data-theme={darkMode ? 'dark' : 'light'}
      >
        {rowContent}
      </div>
    );
  }

  return (
    <div className={`bg-gray-100 rounded-lg p-4 ${className}`}>
      <div
        className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mx-auto"
        style={{ maxWidth, maxHeight, width: '100%' }}
      >
        {/* Phone status bar mock */}
        <div className="h-6 bg-gray-50 flex items-center justify-center border-b border-gray-100">
          <div className="w-16 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-2" style={{ maxHeight: maxHeight - 40 }}>
          {rowContent}
        </div>

        {/* Phone home indicator mock */}
        <div className="h-4 flex items-center justify-center border-t border-gray-100">
          <div className="w-24 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}
