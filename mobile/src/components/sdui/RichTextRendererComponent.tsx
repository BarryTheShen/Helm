/**
 * RichTextRendererComponent — SDUI component for rendering markdown content.
 *
 * Renders markdown with support for:
 * - Headings (h1, h2, h3)
 * - Bold, italic, strikethrough
 * - Lists (ordered and unordered)
 * - Links (displayed as underlined text)
 * - Code blocks and inline code
 * - Blockquotes
 *
 * Props:
 * - content: string (markdown content)
 * - theme: "light" | "dark" (optional, default "light")
 *
 * Note: react-native-markdown-display is NOT in dependencies.
 * This component uses a custom regex-based parser similar to SDUIMarkdown.
 */
import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { resolveColor, themeColors } from '@/theme/tokens';
import type { ActionDispatcher } from '@/components/sdui/SDUIRenderer';

interface RichTextRendererComponentProps {
  content: string;
  theme?: 'light' | 'dark';
  dispatch?: ActionDispatcher;
}

export function RichTextRendererComponent({
  content,
  theme = 'light',
}: RichTextRendererComponentProps) {
  if (!content || typeof content !== 'string') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid markdown content</Text>
      </View>
    );
  }

  const themeStyle = theme === 'dark' ? darkTheme : lightTheme;
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <Text key={i} style={[styles.h3, { color: themeStyle.text }]}>
          {renderInline(line.slice(4), themeStyle)}
        </Text>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <Text key={i} style={[styles.h2, { color: themeStyle.text }]}>
          {renderInline(line.slice(3), themeStyle)}
        </Text>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <Text key={i} style={[styles.h1, { color: themeStyle.text }]}>
          {renderInline(line.slice(2), themeStyle)}
        </Text>
      );
    }
    // List items
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <View key={i} style={styles.listItem}>
          <Text style={[styles.bullet, { color: themeStyle.text }]}>{'•  '}</Text>
          <Text style={[styles.body, { color: themeStyle.text }]}>
            {renderInline(line.slice(2), themeStyle)}
          </Text>
        </View>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.)\s(.*)$/);
      if (match) {
        elements.push(
          <View key={i} style={styles.listItem}>
            <Text style={[styles.bullet, { color: themeStyle.text }]}>{match[1] + ' '}</Text>
            <Text style={[styles.body, { color: themeStyle.text }]}>
              {renderInline(match[2], themeStyle)}
            </Text>
          </View>
        );
      }
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <View key={i} style={[styles.blockquote, { borderLeftColor: themeStyle.border }]}>
          <Text style={[styles.blockquoteText, { color: themeStyle.textSecondary }]}>
            {renderInline(line.slice(2), themeStyle)}
          </Text>
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
        <View key={`code-${i}`} style={[styles.codeBlock, { backgroundColor: themeStyle.codeBg }]}>
          <Text style={[styles.codeText, { color: themeStyle.codeText }]}>
            {codeLines.join('\n')}
          </Text>
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
        <Text key={i} style={[styles.body, { color: themeStyle.text }]}>
          {renderInline(line, themeStyle)}
        </Text>
      );
    }
  }

  return <View style={styles.container}>{elements}</View>;
}

/** Parse inline markdown: **bold**, *italic*, `code`, ~~strike~~, [link](url) */
function renderInline(text: string, themeStyle: ThemeStyle): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match bold, italic, code, strikethrough, links
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <Text key={`bold-${keyCounter++}`} style={{ fontWeight: '700' }}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <Text key={`italic-${keyCounter++}`} style={{ fontStyle: 'italic' }}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      // `code`
      parts.push(
        <Text
          key={`code-${keyCounter++}`}
          style={[styles.inlineCode, { backgroundColor: themeStyle.codeBg, color: themeStyle.codeText }]}
        >
          {match[4]}
        </Text>
      );
    } else if (match[5]) {
      // ~~strikethrough~~
      parts.push(
        <Text key={`strike-${keyCounter++}`} style={{ textDecorationLine: 'line-through' }}>
          {match[5]}
        </Text>
      );
    } else if (match[6] && match[7]) {
      // [link text](url)
      const linkText = match[6];
      const url = match[7];
      parts.push(
        <Text
          key={`link-${keyCounter++}`}
          style={[styles.link, { color: themeStyle.link }]}
          onPress={() => {
            Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
          }}
        >
          {linkText}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

// Theme definitions
interface ThemeStyle {
  text: string;
  textSecondary: string;
  codeBg: string;
  codeText: string;
  border: string;
  link: string;
}

const lightTheme: ThemeStyle = {
  text: themeColors.text,
  textSecondary: themeColors.textSecondary,
  codeBg: themeColors.surface,
  codeText: themeColors.text,
  border: themeColors.border,
  link: themeColors.primary,
};

const darkTheme: ThemeStyle = {
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  codeBg: '#2C2C2E',
  codeText: '#FFFFFF',
  border: '#48484A',
  link: '#0A84FF',
};

const styles = StyleSheet.create({
  container: { gap: 2 },
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 30, marginTop: 8, marginBottom: 4 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 26, marginTop: 6, marginBottom: 3 },
  h3: { fontSize: 17, fontWeight: '600', lineHeight: 22, marginTop: 4, marginBottom: 2 },
  body: { fontSize: 16, lineHeight: 22, flexShrink: 1 },
  listItem: { flexDirection: 'row', paddingLeft: 8, marginVertical: 1 },
  bullet: { fontSize: 16, lineHeight: 22, width: 20 },
  blockquote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 4,
  },
  blockquoteText: { fontSize: 16, lineHeight: 22, fontStyle: 'italic' },
  codeBlock: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  codeText: { fontFamily: 'monospace', fontSize: 14, lineHeight: 20 },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  link: {
    textDecorationLine: 'underline',
  },
  spacer: { height: 8 },
  errorContainer: {
    padding: 12,
    backgroundColor: '#FF3B3020',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
  },
});
