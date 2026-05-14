/**
 * SDUIRichTextRenderer — Tier 2 atomic component.
 * Wrapper around SDUIText (markdown-based) for server-driven rich text content.
 *
 * Handles {{expression}} variable resolution via SDUIText's built-in
 * useVariableContext + resolveExpression pipeline.
 */
import React from 'react';
import { SDUIText } from '@/components/atomic/SDUIText';

interface SDUIRichTextRendererProps {
  content?: string;
  theme?: 'light' | 'dark';
}

export function SDUIRichTextRenderer({ content, theme: _theme }: SDUIRichTextRendererProps) {
  return <SDUIText content={content || ''} />;
}
