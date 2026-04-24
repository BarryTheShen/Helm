/**
 * Tests for RichTextRendererComponent
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { RichTextRendererComponent } from '../RichTextRendererComponent';

describe('RichTextRendererComponent', () => {
  it('renders basic markdown with headings', () => {
    const markdown = `# Heading 1
## Heading 2
### Heading 3

Regular paragraph text.`;

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText('Heading 1')).toBeTruthy();
    expect(getByText('Heading 2')).toBeTruthy();
    expect(getByText('Heading 3')).toBeTruthy();
    expect(getByText('Regular paragraph text.')).toBeTruthy();
  });

  it('renders bold and italic text', () => {
    const markdown = 'This is **bold** and this is *italic* text.';

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText(/bold/)).toBeTruthy();
    expect(getByText(/italic/)).toBeTruthy();
  });

  it('renders bulleted lists', () => {
    const markdown = `- Item 1
- Item 2
- Item 3`;

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText('Item 1')).toBeTruthy();
    expect(getByText('Item 2')).toBeTruthy();
    expect(getByText('Item 3')).toBeTruthy();
  });

  it('renders numbered lists', () => {
    const markdown = `1. First item
2. Second item
3. Third item`;

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText('First item')).toBeTruthy();
    expect(getByText('Second item')).toBeTruthy();
    expect(getByText('Third item')).toBeTruthy();
  });

  it('renders inline code', () => {
    const markdown = 'Use the `console.log()` function.';

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText(/console.log/)).toBeTruthy();
  });

  it('renders code blocks', () => {
    const markdown = `\`\`\`javascript
function hello() {
  console.log("Hello World");
}
\`\`\``;

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText(/function hello/)).toBeTruthy();
  });

  it('renders blockquotes', () => {
    const markdown = '> This is a quote';

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText('This is a quote')).toBeTruthy();
  });

  it('renders links', () => {
    const markdown = '[Click here](https://example.com)';

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText('Click here')).toBeTruthy();
  });

  it('handles dark theme', () => {
    const markdown = '# Dark Theme Test';

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} theme="dark" />
    );

    expect(getByText('Dark Theme Test')).toBeTruthy();
  });

  it('shows error for invalid content', () => {
    const { getByText } = render(
      <RichTextRendererComponent content={null as any} />
    );

    expect(getByText('Invalid markdown content')).toBeTruthy();
  });

  it('renders complex markdown with multiple elements', () => {
    const markdown = `# Article Title

This is a **bold** introduction with *italic* emphasis.

## Features

- Feature 1
- Feature 2
- Feature 3

### Code Example

\`\`\`javascript
const greeting = "Hello World";
console.log(greeting);
\`\`\`

> Important note: This is a blockquote.

Visit [our website](https://example.com) for more info.`;

    const { getByText } = render(
      <RichTextRendererComponent content={markdown} />
    );

    expect(getByText('Article Title')).toBeTruthy();
    expect(getByText(/bold/)).toBeTruthy();
    expect(getByText('Features')).toBeTruthy();
    expect(getByText('Feature 1')).toBeTruthy();
    expect(getByText('Code Example')).toBeTruthy();
    expect(getByText(/const greeting/)).toBeTruthy();
    expect(getByText(/Important note/)).toBeTruthy();
    expect(getByText('our website')).toBeTruthy();
  });
});
