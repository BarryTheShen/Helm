<!-- PROJECT_CONFIG
runtime: typescript-npm
test_command: npm test
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-scaffold
section-02-types-validation
section-03-auth-store
section-04-ui-settings-stores
section-05-services-auth-api
section-06-websocket-service
section-07-auth-screens
section-08-chat-screen
section-09-calendar-forms-alerts
section-10-settings-screen
section-11-sdui-theme
END_MANIFEST -->

# Implementation Sections — Helm Mobile Frontend

| Section | Depends On | Required |
|---------|------------|----------|
| section-01-scaffold | — | Yes |
| section-02-types-validation | 01 | Yes |
| section-03-auth-store | 01, 02 | Yes |
| section-04-ui-settings-stores | 01, 02 | Yes |
| section-05-services-auth-api | 01, 02, 03 | Yes |
| section-06-websocket-service | 04, 05 | Yes |
| section-07-auth-screens | 03, 05 | Yes |
| section-08-chat-screen | 04, 06 | Yes |
| section-09-calendar-forms-alerts | 04, 05 | Yes |
| section-10-settings-screen | 03, 04, 05 | Yes |
| section-11-sdui-theme | 02 | Yes |

## Execution Order

1. section-01-scaffold (no deps)
2. section-02-types-validation (after 01)
3. section-03-auth-store, section-04-ui-settings-stores, section-11-sdui-theme (parallel after 02)
4. section-05-services-auth-api (after 03)
5. section-06-websocket-service (after 04, 05)
6. section-07-auth-screens, section-09-calendar-forms-alerts, section-10-settings-screen (parallel after 05)
7. section-08-chat-screen (after 06)

## Section Summaries

### section-01-scaffold
Expo app creation, package installation, folder structure, tsconfig, app.json, babel.config.

### section-02-types-validation
TypeScript types in `src/types/` and Zod validators in `src/utils/validation.ts`.

### section-03-auth-store
Zustand `authStore` with SecureStore persistence for token and serverUrl.

### section-04-ui-settings-stores
Zustand `uiStore` (chat history, streaming state, calendar/form/notification data) and `settingsStore` (navMode, defaultScreen, agentConfig).

### section-05-services-auth-api
`src/services/auth.ts` (SecureStore helpers) and `src/services/api.ts` (typed REST client).

### section-06-websocket-service
`src/services/websocket.ts` — reconnecting WebSocket state machine, message dispatch, heartbeat.

### section-07-auth-screens
`app/_layout.tsx` (auth guard), `app/(auth)/connect.tsx`, `app/(auth)/login.tsx`.

### section-08-chat-screen
`app/(main)/chat.tsx` — streaming chat with typing indicator, tool call cards, embedded SDUI components.

### section-09-calendar-forms-alerts
`app/(main)/calendar.tsx`, `app/(main)/forms.tsx`, `app/(main)/alerts.tsx` + their SDUI components.

### section-10-settings-screen
`app/(main)/module-center.tsx` and `app/settings.tsx` — settings screen with server, agent, navigation, about sections.

### section-11-sdui-theme
`src/theme/`, `src/components/common/`, `src/components/sdui/SDUIRenderer.tsx`, `FallbackView.tsx`.
