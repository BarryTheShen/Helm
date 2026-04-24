/**
 * RichTextRendererComponent — SDUI component for rendering markdown content.
 *
 * Uses react-native-markdown-display for full markdown support including:
 * - Headings (h1-h3)
 * - Bold, italic, strikethrough
 * - Lists (ordered and unordered)
 * - Links (clickable)
 * - Code blocks and inline code
 * - Blockquotes
 * - Tables
 * - Inline images
 * - Video embeds (YouTube, Vimeo, iframe)
 *
 * Props:
 * - content: string (markdown content)
 * - theme: "light" | "dark" (optional, default "light")
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Linking, TouchableOpacity, Image } from 'react-native';
import Markdown, { MarkdownIt, RenderRules } from 'react-native-markdown-display';
import { themeColors } from '@/theme/tokens';
import type { ActionDispatcher } from '@/components/sdui/SDUIRenderer';

interface RichTextRendererComponentProps {
  content?: string;
  theme?: 'light' | 'dark';
  dispatch?: ActionDispatcher;
}

export function RichTextRendererComponent({
  content = '# Hello\n\nThis is **markdown**.',
  theme = 'light',
}: RichTextRendererComponentProps) {
  if (!content || typeof content !== 'string') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid markdown content</Text>
      </View>
    );
  }

  const isDark = theme === 'dark';
  const themeStyle = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  // Custom markdown-it instance with table support
  const markdownItInstance = useMemo(() => {
    const md = MarkdownIt({ typographer: true, linkify: true });

    // Add video embed rule for YouTube/Vimeo/iframe
    md.inline.ruler.before('link', 'video', (state, silent) => {
      const pos = state.pos;
      const max = state.posMax;

      // Match ![video](url) or <iframe...>
      if (state.src.charCodeAt(pos) === 0x21 /* ! */ &&
          state.src.charCodeAt(pos + 1) === 0x5B /* [ */ &&
          state.src.slice(pos, pos + 8) === '![video]') {
        const match = state.src.slice(pos).match(/^!\[video\]\(([^)]+)\)/);
        if (match) {
          if (!silent) {
            const token = state.push('video', '', 0);
            token.content = match[1];
          }
          state.pos += match[0].length;
          return true;
        }
      }

      // Match <iframe src="...">
      if (state.src.charCodeAt(pos) === 0x3C /* < */ &&
          state.src.slice(pos, pos + 7) === '<iframe') {
        const match = state.src.slice(pos).match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/);
        if (match) {
          if (!silent) {
            const token = state.push('video', '', 0);
            token.content = match[1];
          }
          state.pos += match[0].length;
          return true;
        }
      }

      return false;
    });

    return md;
  }, []);

  // Custom render rules
  const rules: RenderRules = useMemo(() => ({
    // Video embed renderer
    video: (node, children, parent, styles) => {
      const url = node.content || '';
      const videoId = extractVideoId(url);

      if (!videoId) {
        return (
          <TouchableOpacity
            key={node.key}
            style={styles.videoPlaceholder}
            onPress={() => Linking.openURL(url)}
          >
            <Text style={styles.videoText}>🎥 Open Video</Text>
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          key={node.key}
          style={styles.videoPlaceholder}
          onPress={() => Linking.openURL(url)}
        >
          <Text style={styles.videoText}>▶️ {videoId.platform} Video</Text>
        </TouchableOpacity>
      );
    },

    // Image renderer with error handling
    image: (node, children, parent, styles) => {
      const { src, alt } = node.attributes;
      return (
        <Image
          key={node.key}
          source={{ uri: src }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={alt}
        />
      );
    },

    // Link renderer with tap handling
    link: (node, children, parent, styles) => {
      const { href } = node.attributes;
      return (
        <Text
          key={node.key}
          style={styles.link}
          onPress={() => {
            if (href) {
              Linking.openURL(href).catch(err => console.error('Failed to open URL:', err));
            }
          }}
        >
          {children}
        </Text>
      );
    },

    // Table support
    table: (node, children, parent, styles) => (
      <View key={node.key} style={styles.table}>
        {children}
      </View>
    ),
    table_row: (node, children, parent, styles) => (
      <View key={node.key} style={styles.tableRow}>
        {children}
      </View>
    ),
    table_cell: (node, children, parent, styles) => (
      <View key={node.key} style={styles.tableCell}>
        <Text style={styles.tableCellText}>{children}</Text>
      </View>
    ),
    th: (node, children, parent, styles) => (
      <View key={node.key} style={styles.tableHeader}>
        <Text style={styles.tableHeaderText}>{children}</Text>
      </View>
    ),
  }), []);

  const markdownStyles = useMemo(() => ({
    body: { fontSize: 16, lineHeight: 22, color: themeStyle.text },
    heading1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30, color: themeStyle.text, marginTop: 8, marginBottom: 4 },
    heading2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26, color: themeStyle.text, marginTop: 6, marginBottom: 3 },
    heading3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22, color: themeStyle.text, marginTop: 4, marginBottom: 2 },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
    list_item: { flexDirection: 'row' as const, marginVertical: 1 },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: themeStyle.border,
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 4,
      backgroundColor: 'transparent',
    },
    fence: { backgroundColor: themeStyle.codeBg, borderRadius: 8, padding: 12, marginVertical: 4 },
    code_block: { backgroundColor: themeStyle.codeBg, borderRadius: 8, padding: 12, marginVertical: 4 },
    code_inline: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      backgroundColor: themeStyle.codeBg,
      paddingHorizontal: 4,
      borderRadius: 3,
      color: themeStyle.codeText,
    },
    fence_text: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      lineHeight: 20,
      color: themeStyle.codeText,
    },
    code_text: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      lineHeight: 20,
      color: themeStyle.codeText,
    },
    strong: { fontWeight: '700' as const, color: themeStyle.text },
    em: { fontStyle: 'italic' as const, color: themeStyle.text },
    s: { textDecorationLine: 'line-through' as const, color: themeStyle.text },
    paragraph: { marginVertical: 2, color: themeStyle.text },
    link: { color: themeStyle.link, textDecorationLine: 'underline' as const },
    image: { width: '100%', height: 200, borderRadius: 8, marginVertical: 8 },
    table: { borderWidth: 1, borderColor: themeStyle.border, borderRadius: 8, marginVertical: 8, overflow: 'hidden' },
    tableRow: { flexDirection: 'row' as const, borderBottomWidth: 1, borderBottomColor: themeStyle.border },
    tableCell: { flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: themeStyle.border },
    tableCellText: { fontSize: 14, color: themeStyle.text },
    tableHeader: { flex: 1, padding: 8, backgroundColor: themeStyle.tableHeaderBg, borderRightWidth: 1, borderRightColor: themeStyle.border },
    tableHeaderText: { fontSize: 14, fontWeight: '600' as const, color: themeStyle.text },
    videoPlaceholder: {
      backgroundColor: themeStyle.videoBg,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center' as const,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: themeStyle.border,
    },
    videoText: { fontSize: 16, color: themeStyle.link, fontWeight: '600' as const },
  }), [themeStyle]);

  return (
    <Markdown
      style={markdownStyles}
      rules={rules}
      markdownit={markdownItInstance}
    >
      {content}
    </Markdown>
  );
}

/** Extract video ID and platform from URL */
function extractVideoId(url: string): { platform: string; id: string } | null {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) return { platform: 'YouTube', id: match[1] };
  }

  // Vimeo patterns
  const vimeoPattern = /vimeo\.com\/(\d+)/;
  const vimeoMatch = url.match(vimeoPattern);
  if (vimeoMatch) return { platform: 'Vimeo', id: vimeoMatch[1] };

  return null;
}

// Theme definitions
interface ThemeStyle {
  text: string;
  textSecondary: string;
  codeBg: string;
  codeText: string;
  border: string;
  link: string;
  tableHeaderBg: string;
  videoBg: string;
}

const lightTheme: ThemeStyle = {
  text: themeColors.text,
  textSecondary: themeColors.textSecondary,
  codeBg: themeColors.surface,
  codeText: themeColors.text,
  border: themeColors.border,
  link: themeColors.primary,
  tableHeaderBg: themeColors.surface,
  videoBg: themeColors.surface,
};

const darkTheme: ThemeStyle = {
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  codeBg: '#2C2C2E',
  codeText: '#FFFFFF',
  border: '#48484A',
  link: '#0A84FF',
  tableHeaderBg: '#1C1C1E',
  videoBg: '#1C1C1E',
};

const styles = StyleSheet.create({
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
