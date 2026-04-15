/**
 * actionEngine — recursive executor for composite SDUI actions.
 *
 * Handles chain, conditional, and delay actions by decomposing them
 * into simple actions delegated to the provided executeSimple callback.
 */
import type { SDUIAction } from '@/types/sdui';

export async function executeCompositeAction(
  action: SDUIAction,
  executeSimple: (action: SDUIAction) => Promise<void>,
  resolveCondition: (expr: string) => boolean,
): Promise<void> {
  switch (action.type) {
    case 'chain': {
      for (const child of action.actions) {
        await executeCompositeAction(child, executeSimple, resolveCondition);
      }
      return;
    }

    case 'conditional': {
      const result = resolveCondition(action.condition);
      if (result) {
        await executeCompositeAction(action.then, executeSimple, resolveCondition);
      } else if (action.else) {
        await executeCompositeAction(action.else, executeSimple, resolveCondition);
      }
      return;
    }

    case 'delay': {
      await new Promise<void>((resolve) => setTimeout(resolve, action.ms));
      await executeCompositeAction(action.action, executeSimple, resolveCondition);
      return;
    }

    default:
      await executeSimple(action);
  }
}
