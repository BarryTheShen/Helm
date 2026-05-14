/**
 * SDUIText — Tier 2 atomic component.
 * Rich markdown content with support for simple text styling.
 * Merged from old SDUIText (plain) + SDUIMarkdown functionality.
 * Now uses react-native-markdown-display for rendering.
 */
import React from 'react';
import { Text, View, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { resolveColor } from '@/theme/tokens';
import { useVariableContext } from '@/hooks/useVariableContext';
import { resolveExpression } from '@/utils/variableResolver';

interface SDUITextProps {
  content: string;
  variant?: 'heading' | 'body' | 'caption';
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  selectable?: boolean;
}

const variantStyles = {
  heading: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};

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

/** Check if content is simple (no markdown syntax) — if so, render as plain Text */
function isPlainText(content: string): boolean {
  return !/[#*_`\[\]!>-]/.test(content) && !content.includes('\n');
}

export function SDUIText({
  content,
  variant = 'body',
  fontSize,
  fontWeight,
  color,
  bold,
  italic,
  align,
  numberOfLines,
  selectable,
}: SDUITextProps) {
  const variableContext = useVariableContext();
  const resolvedContent = resolveExpression(content || '', variableContext);

  const base = variantStyles[variant] ?? variantStyles.body;

  // If content is simple text, render as a plain RN Text for performance
  if (isPlainText(resolvedContent)) {
    const textDecorations: string[] = [];
    const textStyle: any = [
      base,
      { color: resolveColor(color, '#000000') },
      fontSize ? { fontSize, lineHeight: fontSize * 1.3 } : null,
      bold && { fontWeight: '700' },
      fontWeight ? { fontWeight } : null,
      italic && { fontStyle: 'italic' },
      align && { textAlign: align },
    ];

    return (
      <Text
        style={textStyle}
        numberOfLines={numberOfLines}
        selectable={selectable}
      >
        {resolvedContent}
      </Text>
    );
  }

  // Rich content: render through markdown
  const mergedStyles: any = {
    ...markdownStyles,
    body: {
      ...markdownStyles.body,
      ...base,
      color: resolveColor(color, '#000'),
      ...(fontSize ? { fontSize, lineHeight: fontSize * 1.3 } : {}),
      ...(bold ? { fontWeight: '700' } : {}),
      ...(fontWeight ? { fontWeight } : {}),
      ...(italic ? { fontStyle: 'italic' } : {}),
      ...(align ? { textAlign: align } : {}),
    },
  };

  return (
    <View style={align ? { alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' } : undefined}>
      <Markdown style={mergedStyles} mergeStyle={true}>
        {resolvedContent}
      </Markdown>
    </View>
  );
}
