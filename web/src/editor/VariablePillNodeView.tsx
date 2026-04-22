import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

const NAMESPACE_ICONS: Record<string, string> = {
  user: '👤',
  self: '🔄',
  custom: '⚙️',
  env: '🌍',
  component: '🧩',
  connection: '🔗',
  data: '📊',
};

export function VariablePillNodeView({ node }: NodeViewProps) {
  const { namespace, key, displayName } = node.attrs;
  const icon = NAMESPACE_ICONS[namespace] || '📌';

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium cursor-default select-none"
      contentEditable={false}
      draggable={false}
    >
      <span className="text-[10px]">{icon}</span>
      <span>{displayName || `${namespace}.${key}`}</span>
    </NodeViewWrapper>
  );
}
