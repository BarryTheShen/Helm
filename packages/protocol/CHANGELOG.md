# Changelog

## 0.1.0 (2026-04-14)

Initial release.

- SDUI V2 page/row/cell/component type definitions
- 14 built-in component types (Text, Markdown, Button, Image, TextInput, Icon, Divider, Container, CalendarModule, ChatModule, NotesModule, InputBar, Form, ScreenOptions)
- Action types: navigate, server_action, form_submit, select_screen, update_component, send_to_agent, open_url, copy_text, api_call, dismiss, go_back
- Zod validation schemas for pages, components, forms, WebSocket messages
- `isSDUIPage()` type guard
