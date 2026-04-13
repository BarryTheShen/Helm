/**
 * SDUIText — Tier 2 atomic component.
 * UI labels, headers, timestamps. Precise single-style text positioned by Flexbox.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { resolveColor } from '../../theme/tokens';

interface SDUITextProps {
  content: string;
  variant?: 'heading' | 'body' | 'caption';
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  selectable?: boolean;
}

const variantStyles = {
  heading: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};

export function SDUIText({
  content,
  variant = 'body',
  fontSize,
  fontWeight,
  color,
  bold,
  italic,
  underline,
  strikethrough,
  align,
  numberOfLines,
  selectable,
}: SDUITextProps) {
  const base = variantStyles[variant] ?? variantStyles.body;
  const textDecorations: string[] = [];
  if (underline) textDecorations.push('underline');
  if (strikethrough) textDecorations.push('line-through');

  return (
    <Text
      style={[
        base,
        { color: resolveColor(color, '#000000') },
        fontSize ? { fontSize, lineHeight: fontSize * 1.3 } : null,
        bold && { fontWeight: '700' },
        fontWeight ? { fontWeight: fontWeight as any } : null,
        italic && { fontStyle: 'italic' },
        textDecorations.length > 0 && { textDecorationLine: textDecorations.join(' ') as any },
        align && { textAlign: align },
      ]}
      numberOfLines={numberOfLines}
      selectable={selectable}
    >
      {content}
    </Text>
  );
}
