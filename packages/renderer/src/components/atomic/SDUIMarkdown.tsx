/**
 * SDUIMarkdown — Tier 2 atomic component.
 * Rich formatted content blocks using basic markdown parsing.
 * For MVP, uses simple regex-based parsing to styled Text elements.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '../../theme/tokens';

interface SDUIMarkdownProps {
  content: string;
}

export function SDUIMarkdown({ content }: SDUIMarkdownProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // LaTeX display block ($$...$$)
    if (line.trim().startsWith('$$')) {
      const mathLines: string[] = [];
      const singleLine = line.trim().slice(2);
      if (singleLine.endsWith('$$') && singleLine.length > 2) {
        // Single-line display math: $$...$$ on one line
        mathLines.push(singleLine.slice(0, -2));
      } else {
        if (singleLine) mathLines.push(singleLine);
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const last = lines[i].trim().slice(0, -2);
          if (last) mathLines.push(last);
        }
      }
      elements.push(
        <View key={`math-${i}`} style={styles.mathBlock}>
          <Text style={styles.mathText}>{mathLines.join('\n')}</Text>
        </View>
      );
    }
    // Headings
    else if (line.startsWith('### ')) {
      elements.push(
        <Text key={i} style={styles.h3}>{renderInline(line.slice(4))}</Text>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <Text key={i} style={styles.h2}>{renderInline(line.slice(3))}</Text>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <Text key={i} style={styles.h1}>{renderInline(line.slice(2))}</Text>
      );
    }
    // Markdown table
    else if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[][] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        const row = lines[j].trim();
        // Skip separator rows (|---|---|)
        if (/^\|[\s\-:]+\|/.test(row) && !row.replace(/[\s|:\-]/g, '')) {
          j++;
          continue;
        }
        const cells = row.split('|').filter((_, idx, arr) =>
          idx > 0 && idx < arr.length - 1
        ).map(c => c.trim());
        if (cells.length > 0) tableRows.push(cells);
        j++;
      }
      i = j - 1; // advance past table

      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(1);
        elements.push(
          <View key={`table-${i}`} style={styles.table}>
            <View style={styles.tableHeaderRow}>
              {headerRow.map((cell, ci) => (
                <View key={ci} style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>
                  <Text style={styles.tableHeaderText}>{cell}</Text>
                </View>
              ))}
            </View>
            {dataRows.map((row, ri) => (
              <View key={ri} style={styles.tableRow}>
                {row.map((cell, ci) => (
                  <View key={ci} style={[styles.tableCell, { flex: 1 }]}>
                    <Text style={styles.body}>{renderInline(cell)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      }
    }
    // List items
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <View key={i} style={styles.listItem}>
          <Text style={styles.bullet}>{'•  '}</Text>
          <Text style={styles.body}>{renderInline(line.slice(2))}</Text>
        </View>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.)\s(.*)$/);
      if (match) {
        elements.push(
          <View key={i} style={styles.listItem}>
            <Text style={styles.bullet}>{match[1] + ' '}</Text>
            <Text style={styles.body}>{renderInline(match[2])}</Text>
          </View>
        );
      }
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <View key={i} style={styles.blockquote}>
          <Text style={styles.blockquoteText}>{renderInline(line.slice(2))}</Text>
        </View>
      );
    }
    // Code block (```...```)
    else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <View key={`code-${i}`} style={styles.codeBlock}>
          <Text style={styles.codeText}>{codeLines.join('\n')}</Text>
        </View>
      );
    }
    // Empty line = spacing
    else if (line.trim() === '') {
      elements.push(<View key={i} style={styles.spacer} />);
    }
    // Regular paragraph
    else {
      elements.push(
        <Text key={i} style={styles.body}>{renderInline(line)}</Text>
      );
    }
  }

  return <View style={styles.container}>{elements}</View>;
}

/** Parse inline markdown: **bold**, *italic*, `code`, ~~strike~~, $latex$ */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match bold, italic, code, strikethrough, inline math
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~|\$(.+?)\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(<Text key={match.index} style={{ fontWeight: '700' }}>{match[2]}</Text>);
    } else if (match[3]) {
      // *italic*
      parts.push(<Text key={match.index} style={{ fontStyle: 'italic' }}>{match[3]}</Text>);
    } else if (match[4]) {
      // `code`
      parts.push(
        <Text key={match.index} style={styles.inlineCode}>{match[4]}</Text>
      );
    } else if (match[5]) {
      // ~~strikethrough~~
      parts.push(
        <Text key={match.index} style={{ textDecorationLine: 'line-through' }}>{match[5]}</Text>
      );
    } else if (match[6]) {
      // $inline math$
      parts.push(
        <Text key={match.index} style={styles.inlineMath}>{match[6]}</Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 30, color: '#000', marginTop: 8, marginBottom: 4 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 26, color: '#000', marginTop: 6, marginBottom: 3 },
  h3: { fontSize: 17, fontWeight: '600', lineHeight: 22, color: '#000', marginTop: 4, marginBottom: 2 },
  body: { fontSize: 16, lineHeight: 22, color: '#000', flexShrink: 1 },
  listItem: { flexDirection: 'row', paddingLeft: 8, marginVertical: 1 },
  bullet: { fontSize: 16, lineHeight: 22, color: '#000', width: 20 },
  blockquote: {
    borderLeftWidth: 3, borderLeftColor: '#C6C6C8', paddingLeft: 12,
    paddingVertical: 4, marginVertical: 4,
  },
  blockquoteText: { fontSize: 16, lineHeight: 22, color: '#8E8E93', fontStyle: 'italic' },
  codeBlock: {
    backgroundColor: '#F2F2F7', borderRadius: 8, padding: 12, marginVertical: 4,
  },
  codeText: { fontFamily: 'monospace', fontSize: 14, lineHeight: 20, color: '#000' },
  inlineCode: {
    fontFamily: 'monospace', fontSize: 14, backgroundColor: '#F2F2F7',
    paddingHorizontal: 4, borderRadius: 3,
  },
  spacer: { height: 8 },
  // Table styles
  table: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 6,
    overflow: 'hidden' as const, marginVertical: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row' as const, backgroundColor: '#F5F5F5',
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  tableRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  tableCell: {
    paddingHorizontal: 10, paddingVertical: 8,
    borderRightWidth: 1, borderRightColor: '#F0F0F0',
  },
  tableHeaderCell: {
    backgroundColor: '#F5F5F5',
  },
  tableHeaderText: {
    fontSize: 14, fontWeight: '600' as const, color: '#333',
  },
  // Math styles
  mathBlock: {
    backgroundColor: '#F8F6FF', borderRadius: 8, padding: 14,
    marginVertical: 6, borderLeftWidth: 3, borderLeftColor: '#7C4DFF',
  },
  mathText: {
    fontFamily: 'monospace', fontSize: 15, lineHeight: 22,
    color: '#4A148C', textAlign: 'center' as const,
  },
  inlineMath: {
    fontFamily: 'monospace', fontSize: 14, color: '#4A148C',
    backgroundColor: '#F3E8FF', paddingHorizontal: 4, borderRadius: 3,
  },
});
