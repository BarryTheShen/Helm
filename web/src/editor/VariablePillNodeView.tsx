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
      data-testid="variable-pill"
      className="inline-flex max-w-fit items-center gap-0.5 px-1.5 py-px mx-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium cursor-default select-none align-baseline"
      contentEditable={false}
      draggable={false}
    >
      <span className="text-[10px]">{icon}</span>
      <span>{displayName || `${namespace}.${key}`}</span>
    </NodeViewWrapper>
  );
}
