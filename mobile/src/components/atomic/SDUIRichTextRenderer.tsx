/**
 * SDUIRichTextRenderer — Tier 2 atomic component.
 * Thin wrapper around SDUIMarkdown for server-driven rich text content.
 *
 * Handles {{expression}} variable resolution via SDUIMarkdown's built-in
 * useVariableContext + resolveExpression pipeline.
 *
 * The theme prop is accepted for API compatibility but not yet applied
 * to the underlying SDUIMarkdown renderer.
 */
import React from 'react';
import { SDUIMarkdown } from '@/components/atomic/SDUIMarkdown';

interface SDUIRichTextRendererProps {
  content?: string;
  theme?: 'light' | 'dark';
}

export function SDUIRichTextRenderer({ content, _theme }: SDUIRichTextRendererProps) {
  return <SDUIMarkdown content={content || ''} />;
}
