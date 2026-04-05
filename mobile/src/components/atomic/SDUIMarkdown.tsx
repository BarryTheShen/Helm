/**
 * SDUIMarkdown — Tier 2 atomic component.
 * Rich formatted content blocks using basic markdown parsing.
 * For MVP, uses simple regex-based parsing to styled Text elements.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';

interface SDUIMarkdownProps {
  content: string;
}

export function SDUIMarkdown({ content }: SDUIMarkdownProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
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

/** Parse inline markdown: **bold**, *italic*, `code`, ~~strike~~ */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match bold, italic, code, strikethrough
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g;
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
});
