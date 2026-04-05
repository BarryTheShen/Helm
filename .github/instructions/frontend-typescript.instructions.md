---
applyTo: ["mobile/**/*.ts", "mobile/**/*.tsx"]
---

# Helm Frontend — TypeScript/React Native Conventions

## Architecture

- React Native 0.83 / Expo 55 app in `mobile/`
- Expo Router file-based navigation: `app/(auth)/` and `app/(tabs)/` groups
- 7 tab screens: home, chat, modules, calendar, forms, alerts, settings
- Zustand state management: 4 stores (auth, ui, settings, tabs)
- Single shared WebSocket via `WebSocketContext`

## File Organization

- Screens: `app/(tabs)/{screen}.tsx` — one screen per tab
- Components: `src/components/` — atomic → structural → composite → sdui layers
- State: `src/stores/` — one store per concern
- Services: `src/services/` — API client, WebSocket, auth
- Types: `src/types/` — api.ts, sdui.ts, navigation.ts
- Theme: `src/theme/` — colors.ts (V1), tokens.ts (V2)

## Critical Patterns

### SDUI V2 Component Registry
New components MUST be registered in `src/renderer/componentRegistry.ts`:
1. Create component in `src/components/{tier}/` (atomic, structural, composite)
2. Add PascalCase type to `src/types/sdui.ts`
3. Register in `componentRegistry.ts` registry object
4. Component receives `{ ...props, dispatch, children? }`

### WebSocket Message Validation
`src/utils/validation.ts` uses Zod `.passthrough()` — **NEVER change this to `.strict()`**. The backend sends fields the frontend doesn't know about yet. Stripping unknown fields breaks forward compatibility.

### State Management
- `authStore` — token, serverUrl, user (persisted to SecureStore)
- `uiStore` — connection status, error banner (not persisted)
- `settingsStore` — nav mode, theme stubs (AsyncStorage — NOT applied to UI)
- `tabsStore` — hiddenTabs (reloaded from server on launch, not persisted)

### Auth Guard
`app/_layout.tsx` redirects based on token presence. No token → `/(auth)/connect`. Has token + in auth → `/(tabs)/chat`.

## Conventions

- TypeScript strict mode — no `any` unless absolutely necessary
- Functional components only, named exports
- Use `@/` path alias for imports from `src/`
- `useMemo` / `useCallback` for expensive computations (see calendar.tsx pattern)
- Stale-closure-safe WS handlers via `useRef` for handler + `useEffect` for subscription (see chat.tsx)
