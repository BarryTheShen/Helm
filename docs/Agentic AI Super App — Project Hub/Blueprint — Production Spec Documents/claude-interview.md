# Interview Transcript — Helm Frontend Planning

## Q1: Default navigation mode

**Q:** The spec defines two navigation modes: bottom tab bar and sidebar drawer. Which should be the default at first launch?

**A:** Bottom tab bar — standard iOS pattern, tabs always visible. User can switch to sidebar in Settings.

## Q2: First-launch setup screen

**Q:** The spec mentions a 'Setup' screen on first launch to choose a template. Is this needed for MVP?

**A:** Skip template setup — go straight to chat after login. Connect → login → chat.

## Q3: Offline / unreachable backend at launch

**Q:** When the backend is unreachable at launch, what should the app do?

**A:** Show error banner and retry button. Display last-known module state (if any cached) with an offline banner and manual retry.

## Q4: Chat streaming UX — pre-token indicator

**Q:** While the AI is generating a response, should the app show a typing indicator before the first token arrives?

**A:** Yes — animated dots until first token. Show a '...' typing indicator from send until the first token arrives, then switch to streaming text.

## Q5: Tool call display in chat

**Q:** Tool call events (tool_call_start / tool_call_complete) appear in the chat stream. How should these look?

**A:** Expandable detail card — collapsible card showing tool name + result summary, user can tap to expand.

## Q6: Calendar views in MVP

**Q:** Which calendar views should be in MVP?

**A:** Month + Day only. Month overview to see events, tap a day to see day timeline.

## Q7: Settings layout

**Q:** Should agent API key entry happen inside the main Settings sheet or a dedicated screen?

**A:** Single Settings screen with sections — one scrollable screen with sections: Connection, Agent Config, Navigation, About.
