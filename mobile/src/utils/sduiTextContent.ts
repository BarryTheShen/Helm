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

/** Convert single newlines to markdown hard breaks. */
export function markdownWithHardBreaks(content: string): string {
  return content.replace(/(?<!\n)\n(?!\n)/g, '  \n');
}
