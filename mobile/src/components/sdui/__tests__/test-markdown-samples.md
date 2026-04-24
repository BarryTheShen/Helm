# Rich Text Renderer Test Samples

This file contains comprehensive markdown samples for testing the RichTextRendererComponent.

## Sample 1: Basic Formatting

# Heading 1
## Heading 2
### Heading 3

This is a paragraph with **bold text**, *italic text*, and ~~strikethrough text~~.

You can also use `inline code` within sentences.

## Sample 2: Lists

### Bulleted List
- First item
- Second item
- Third item with **bold**
- Fourth item with *italic*

### Numbered List
1. First numbered item
2. Second numbered item
3. Third numbered item
4. Fourth numbered item

## Sample 3: Code Blocks

### JavaScript Code
```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
  return true;
}

const result = greet("World");
```

### Python Code
```python
def calculate_sum(a, b):
    return a + b

result = calculate_sum(5, 10)
print(f"Result: {result}")
```

## Sample 4: Blockquotes

> This is a simple blockquote.

> This is a blockquote with **bold** and *italic* text.

> Multi-line blockquote
> continues here
> and here.

## Sample 5: Links

Visit [Google](https://google.com) for search.

Check out [GitHub](https://github.com) for code.

Read more at [our documentation](https://example.com/docs).

## Sample 6: Images

![Sample Image](https://via.placeholder.com/600x400)

![Another Image](https://via.placeholder.com/800x600)

## Sample 7: Video Embeds

### YouTube Video
![video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

### Vimeo Video
![video](https://vimeo.com/123456789)

### Iframe Embed
<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>

## Sample 8: Tables

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1 A  | Row 1 B  | Row 1 C  |
| Row 2 A  | Row 2 B  | Row 2 C  |
| Row 3 A  | Row 3 B  | Row 3 C  |

| Name     | Age | City        |
|----------|-----|-------------|
| Alice    | 30  | New York    |
| Bob      | 25  | Los Angeles |
| Charlie  | 35  | Chicago     |

## Sample 9: Mixed Content

# Article: Getting Started with React Native

React Native is a **powerful framework** for building mobile applications using *JavaScript* and *React*.

## Key Features

- Cross-platform development
- Native performance
- Hot reloading
- Large ecosystem

## Installation

To install React Native, run:

```bash
npm install -g react-native-cli
react-native init MyProject
```

## Code Example

```javascript
import React from 'react';
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View>
      <Text>Hello, React Native!</Text>
    </View>
  );
}
```

> **Note:** Make sure you have Node.js installed before proceeding.

For more information, visit the [official documentation](https://reactnative.dev).

## Sample 10: Complex Nested Content

### Project Overview

This project demonstrates the use of **markdown rendering** in a *React Native* application.

#### Features Implemented

1. **Text Formatting**
   - Bold, italic, strikethrough
   - Inline code
   - Links

2. **Block Elements**
   - Headings (H1-H3)
   - Paragraphs
   - Lists (ordered and unordered)
   - Code blocks
   - Blockquotes

3. **Media**
   - Images
   - Video embeds (YouTube, Vimeo)

4. **Tables**
   - Multi-column tables
   - Header rows
   - Data cells

#### Technical Details

The component uses `react-native-markdown-display` library with custom rules for:

```typescript
interface CustomRules {
  video: VideoRenderer;
  image: ImageRenderer;
  link: LinkRenderer;
  table: TableRenderer;
}
```

> This ensures full compatibility with standard markdown syntax while adding mobile-specific enhancements.

#### Resources

- [React Native Docs](https://reactnative.dev)
- [Markdown Guide](https://www.markdownguide.org)
- [GitHub Repository](https://github.com/example/repo)

---

**End of Test Samples**
