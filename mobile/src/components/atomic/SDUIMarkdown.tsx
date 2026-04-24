/**
 * SDUIMarkdown — Tier 2 atomic component.
 * Rich formatted content blocks using react-native-markdown-display.
 * Applies theme color tokens to all markdown elements.
 */
import React from 'react';
import { Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useVariableContext } from '@/hooks/useVariableContext';
import { resolveExpression } from '@/utils/variableResolver';

interface SDUIMarkdownProps {
  content: string;
}

const markdownStyles = {
  body: { fontSize: 16, lineHeight: 22, color: '#000' },
  heading1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30, color: '#000', marginTop: 8, marginBottom: 4 },
  heading2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26, color: '#000', marginTop: 6, marginBottom: 3 },
  heading3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22, color: '#000', marginTop: 4, marginBottom: 2 },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { flexDirection: 'row' as const, marginVertical: 1 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#C6C6C8',
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 4,
    backgroundColor: 'transparent',
  },
  blockquote_text: { fontSize: 16, lineHeight: 22, color: '#8E8E93', fontStyle: 'italic' as const },
  fence: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 12, marginVertical: 4 },
  code_block: { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 12, marginVertical: 4 },
  code_inline: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  fence_text: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  code_text: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  strong: { fontWeight: '700' as const },
  em: { fontStyle: 'italic' as const },
  s: { textDecorationLine: 'line-through' as const },
  paragraph: { marginVertical: 2 },
};

export function SDUIMarkdown({ content }: SDUIMarkdownProps) {
  const variableContext = useVariableContext();
  const resolvedContent = resolveExpression(content || '', variableContext);

  return (
    <Markdown style={markdownStyles}>
      {resolvedContent}
    </Markdown>
  );
}
