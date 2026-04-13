/**
 * Action Dispatcher — handles SDUI actions from user interactions.
 *
 * This is the bridge between Keel's rendered UI and your app logic.
 * SDUIPageRenderer calls `onAction(action)` when users tap buttons,
 * submit forms, etc. Your dispatcher decides what to do.
 */
import type { SDUIAction } from '@keel/protocol';

/** Log of dispatched actions (useful for testing) */
export const actionLog: SDUIAction[] = [];

/**
 * Handle an SDUI action. In a real app you'd wire this to
 * React Navigation, your WebSocket connection, Linking, etc.
 */
export function handleAction(action: SDUIAction): void {
  actionLog.push(action);

  switch (action.type) {
    case 'navigate':
      console.log(`[NAV] → ${action.screen}`, action.params);
      break;

    case 'go_back':
      console.log('[NAV] ← back');
      break;

    case 'open_url':
      console.log(`[URL] Opening: ${action.url}`);
      // In real app: Linking.openURL(action.url)
      break;

    case 'copy_text':
      console.log(`[COPY] "${action.text}"`);
      // In real app: Clipboard.setString(action.text)
      break;

    case 'send_to_agent':
      console.log(`[AGENT] Message: "${action.message}"`);
      // In real app: ws.send(JSON.stringify({ type: 'chat_message', content: action.message }))
      break;

    case 'server_action':
      console.log(`[SERVER] ${action.function}`, action.params);
      // In real app: call your backend action registry
      break;

    case 'api_call':
      console.log(`[API] ${action.method} ${action.path}`, action.body);
      break;

    case 'dismiss':
      console.log('[NAV] dismiss');
      break;

    default:
      console.log('[ACTION] Unhandled:', action);
  }
}

/** Reset the action log (for testing) */
export function clearActionLog(): void {
  actionLog.length = 0;
}
