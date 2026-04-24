# RichTextRenderer Component

A read-only markdown renderer for the Helm mobile app using `react-native-markdown-display`.

## Usage

### In SDUI JSON (Backend)

```json
{
  "type": "RichText",
  "id": "article-content",
  "props": {
    "content": "# Article Title\n\nThis is **bold** and *italic* text.",
    "theme": "light"
  }
}
```

### In React Native (Direct)

```typescript
import { RichTextRendererComponent } from '@/components/sdui/RichTextRendererComponent';

<RichTextRendererComponent
  content="# Hello World\n\nThis is **markdown**."
  theme="light"
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `content` | `string` | Yes | - | Markdown content to render |
| `theme` | `'light' \| 'dark'` | No | `'light'` | Color theme |
| `dispatch` | `ActionDispatcher` | No | - | Action dispatcher (not used currently) |

## Supported Markdown Features

### Text Formatting
```markdown
**bold text**
*italic text*
~~strikethrough~~
`inline code`
```

### Headings
```markdown
# Heading 1
## Heading 2
### Heading 3
```

### Lists
```markdown
- Bulleted item 1
- Bulleted item 2

1. Numbered item 1
2. Numbered item 2
```

### Code Blocks
````markdown
```javascript
function hello() {
  console.log("Hello World");
}
```
````

### Blockquotes
```markdown
> This is a quote
> It can span multiple lines
```

### Links
```markdown
[Link text](https://example.com)
```

### Images
```markdown
![Alt text](https://example.com/image.jpg)
```

### Tables
```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Video Embeds
```markdown
![video](https://www.youtube.com/watch?v=VIDEO_ID)
![video](https://vimeo.com/VIDEO_ID)
<iframe src="https://www.youtube.com/embed/VIDEO_ID"></iframe>
```

**Note:** Videos render as clickable placeholders that open in the browser.

## Theme Support

### Light Theme (Default)
- Uses colors from `@/theme/tokens`
- Black text on white background
- Light gray code blocks

### Dark Theme
- White text on black background
- Dark gray code blocks
- Blue links

## Examples

### Article Content
```typescript
const articleMarkdown = `
# Getting Started with React Native

React Native is a **powerful framework** for building mobile apps.

## Key Features

- Cross-platform development
- Native performance
- Hot reloading

## Installation

\`\`\`bash
npm install -g react-native-cli
\`\`\`

For more info, visit [React Native](https://reactnative.dev).
`;

<RichTextRendererComponent content={articleMarkdown} />
```

### Documentation Page
```typescript
const docsMarkdown = `
# API Reference

## Authentication

Use the \`authenticate()\` function:

\`\`\`javascript
const token = await authenticate(username, password);
\`\`\`

> **Warning:** Store tokens securely.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Login user |
| POST | /auth/logout | Logout user |
`;

<RichTextRendererComponent content={docsMarkdown} theme="dark" />
```

## Performance

The component uses `useMemo` to optimize:
- Theme style calculations
- Markdown-it instance creation
- Custom render rules

## Limitations

1. **Video Embeds**: Renders as clickable placeholders (no embedded player)
2. **Wide Tables**: May overflow on small screens
3. **Image Loading**: No loading states or error placeholders

## Testing

See test files:
- `__tests__/RichTextRendererComponent.test.tsx` - Unit tests
- `__tests__/test-markdown-samples.md` - Test samples
- `__tests__/RichTextRendererDemo.tsx` - Interactive demo

## Registry

Registered in `componentRegistry.ts` as:
- Type: `RichText`
- Component: `RichTextRendererComponent`

## Web Admin

Available in the component picker:
- Category: Composite
- Display Name: "Rich Text Renderer"
- Icon: 📝
