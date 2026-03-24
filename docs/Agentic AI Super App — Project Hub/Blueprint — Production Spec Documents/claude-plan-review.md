# Plan Review — Helm Mobile Frontend

**Reviewer:** Claude Sonnet 4.6 subagent
**VERDICT: Approved with notes**

The plan is well-structured and covers the critical path. Section ordering is correct, research doc is actionable, TDD stubs mirror implementation sections. Several gaps need addressing.

---

## STRENGTHS

1. Section dependency order is correct — no circular dependencies
2. Research doc backend bug workarounds (metadata_json, is_all_day, refresh 500) are directly actionable
3. WebSocket design is sound — reconnect logic, close code handling, heartbeat, AppState integration
4. Token storage correctly uses expo-secure-store; explicitly avoids Zustand persist middleware for tokens
5. TDD stubs are structurally sound and cover streaming state machine edge cases

---

## CRITICAL CONCERNS (addressed in plan revision)

**C1. Tab layout `app/(main)/_layout.tsx` not fully specified.**
Referenced across sections but never given its own "What to Build" block. Unread badge wiring on Alerts tab is undefined.

**C2. No error boundary specified.**
A malformed server payload that passes Zod but causes a render error will crash the app. Need a React error boundary wrapping SDUI renderer.

**C3. AppState WebSocket reconnect is mentioned but not placed in a section.**
Needs explicit placement — belongs in Section 6.

**C4. Pull-to-refresh not assigned to a section.**
Spec requires pull-to-refresh on Calendar, Alerts, Forms. No section owns this.

**C5. Module Center `app/(main)/module-center.tsx` has no "What to Build" block.**
Listed in folder structure, screen exists, but implementation is not described.

**C6. Typing indicator specifics not defined.**
Interview said animated dots before first token — plan mentions it but doesn't describe the component.

**C7. Token refresh flow not described.**
Backend has `/auth/refresh`. Plan doesn't address what happens when the session token expires mid-session.

---

## MODERATE CONCERNS

**M1. TDD Section 5 stubs weak on API client.**
Add stubs for: login with wrong credentials, network timeout, malformed JSON response, Authorization header format.

**M2. Calendar timezone not addressed.**
All timestamps include timezone offset. Plan should specify to use `date-fns` with explicit timezone parsing.

**M3. FormView date/datetime picker not specified.**
React Native has no native date picker in Expo managed workflow — needs `@react-native-community/datetimepicker` or `expo-datetime-picker`.
