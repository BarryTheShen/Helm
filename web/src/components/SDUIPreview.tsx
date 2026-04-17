import { type CSSProperties } from 'react';

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
}

interface SDUIScreen {
  rows: SDUIRow[];
}

interface SDUIPreviewProps {
  json: SDUIScreen | string;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
}

// Component preview renderers (simplified versions from EditorCanvas)
function TextPreview({ content, variant, fontSize, fontWeight, color, align, bold, italic }: any) {
  const semanticStyle = variant === 'heading'
    ? { fontSize: 28, fontWeight: '700', lineHeight: 1.2 }
    : variant === 'caption'
      ? { fontSize: 12, fontWeight: '400', lineHeight: 1.4 }
      : { fontSize: 16, fontWeight: '400', lineHeight: 1.5 };

  const resolvedFontSize = typeof fontSize === 'number' ? fontSize : semanticStyle.fontSize;
  const resolvedFontWeight = (typeof fontWeight === 'string' && fontWeight.length > 0) || typeof fontWeight === 'number'
    ? String(fontWeight)
    : bold
      ? '700'
      : semanticStyle.fontWeight;

  return (
    <div style={{ fontSize: resolvedFontSize, fontWeight: resolvedFontWeight, fontStyle: italic ? 'italic' : 'normal', lineHeight: semanticStyle.lineHeight, color: color || '#000', textAlign: align || 'left', padding: '4px 0' }}>
      {content || 'Text'}
    </div>
  );
}

function ButtonPreview({ label, variant, size, icon }: any) {
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

  if (variant === 'icon') {
    return <button className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-600">{icon || '⭐'}</button>;
  }

  return (
    <button className={`rounded-md font-medium ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`}>
      {label || 'Button'}
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

function MarkdownPreview({ content }: any) {
  return <div className="prose prose-sm max-w-none" style={{ whiteSpace: 'pre-wrap' }}>{content || '# Heading\n\nParagraph'}</div>;
}

function DividerPreview({ color, thickness, margin }: any) {
  return <hr style={{ borderColor: color || '#E0E0E0', borderWidth: thickness ?? 1, margin: `${margin ?? 8}px 0` }} />;
}

function IconPreview({ name, size, color }: any) {
  return <span style={{ fontSize: size || 24, color: color || '#000' }}>⭐ {name || 'star'}</span>;
}

function TextInputPreview({ placeholder, multiline, value, secureTextEntry }: any) {
  const rawValue = value === undefined || value === null ? '' : String(value);
  const displayValue = secureTextEntry && rawValue ? '*'.repeat(Math.max(rawValue.length, 4)) : rawValue;

  return (
    <div>
      {multiline ? (
        <textarea value={displayValue} placeholder={placeholder || 'Enter text...'} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" rows={3} readOnly />
      ) : (
        <input type="text" value={displayValue} placeholder={placeholder || 'Enter text...'} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" readOnly />
      )}
    </div>
  );
}

function CalendarPreview() {
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="text-sm font-bold mb-2">📅 Calendar</div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-500">
        {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs mt-1">
        {Array.from({length: 28}, (_,i) => (
          <div key={i} className={`py-0.5 rounded ${i === 4 ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}>{i+1}</div>
        ))}
      </div>
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

const PREVIEW_RENDERERS: Record<string, (props: any) => JSX.Element> = {
  Text: TextPreview,
  text: TextPreview,
  Markdown: MarkdownPreview,
  markdown: MarkdownPreview,
  Button: ButtonPreview,
  button: ButtonPreview,
  Image: ImagePreview,
  image: ImagePreview,
  TextInput: TextInputPreview,
  textinput: TextInputPreview,
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
};

function ComponentPreview({ component }: { component: SDUIComponent }) {
  const Renderer = PREVIEW_RENDERERS[component.type];
  if (Renderer) {
    return <Renderer {...component.props} children={component.children} />;
  }
  return <div className="text-xs text-gray-400 italic p-2">Unknown: {component.type}</div>;
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

export function SDUIPreview({ json, className = '', maxWidth = 375, maxHeight = 667 }: SDUIPreviewProps) {
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
          {screen.rows.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">No content</div>
          ) : (
            screen.rows.map((row, rowIdx) => {
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
                      className="rounded p-1"
                      style={getCellStyle(row, cell.width, totalWidth)}
                    >
                      {cell.content ? (
                        <ComponentPreview component={cell.content} />
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[40px] bg-gray-50 border border-dashed border-gray-200 rounded text-gray-300 text-xs">
                          Empty
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Phone home indicator mock */}
        <div className="h-4 flex items-center justify-center border-t border-gray-100">
          <div className="w-24 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}
