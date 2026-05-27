/**
 * Shared text/markdown content helpers for SDUI preview renderers.
 * FF4-TEXT-002: plain multiline text must preserve Enter-key newlines.
 * FF4-VAR-001: variable resolution happens before markdown detection.
 */

/** Detect markdown syntax without treating mid-word hyphens as list markers. */
export function hasMarkdownSyntax(content: string): boolean {
  if (!content) return false;
  if (/^#{1,6}\s/m.test(content)) return true;
  if (/^>\s/m.test(content)) return true;
  if (/^[-*+]\s/m.test(content)) return true;
  if (/^\d+\.\s/m.test(content)) return true;
  if (/\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`/.test(content)) return true;
  if (/\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)/.test(content)) return true;
  return false;
}

/** Convert single newlines to markdown hard breaks for ReactMarkdown. */
export function markdownWithHardBreaks(content: string): string {
  return content.replace(/(?<!\n)\n(?!\n)/g, '  \n');
}
