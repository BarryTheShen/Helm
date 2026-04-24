#!/bin/bash

# Variable Pill Editor - Installation Script
# Run this script to install TipTap dependencies and verify the setup

set -e

echo "=========================================="
echo "Variable Pill Editor - Installation"
echo "=========================================="
echo ""

# Navigate to web directory
cd "$(dirname "$0")"

echo "📦 Installing TipTap dependencies..."
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder

echo ""
echo "✅ Dependencies installed successfully!"
echo ""

echo "🔍 Verifying installation..."
if npm list @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder > /dev/null 2>&1; then
    echo "✅ All TipTap packages are installed"
else
    echo "⚠️  Warning: Some packages may not be installed correctly"
    echo "   Run 'npm list @tiptap/react' to check"
fi

echo ""
echo "📝 Files created:"
echo "   - src/editor/VariablePillExtension.ts"
echo "   - src/editor/VariablePillNodeView.tsx"
echo "   - src/editor/PillEditor.tsx"
echo "   - src/editor/pill-editor.css"
echo "   - src/pages/PillEditorTestPage.tsx"
echo ""

echo "📝 Files modified:"
echo "   - src/editor/VariableInput.tsx (now uses PillEditor)"
echo "   - package.json (added TipTap dependencies)"
echo ""

echo "🧪 Testing instructions:"
echo "   1. Start dev server: npm run dev"
echo "   2. Navigate to Editor page"
echo "   3. Add a Text component"
echo "   4. Type @ in the text field"
echo "   5. Select a variable from the picker"
echo "   6. Verify pill appears as blue rounded box"
echo ""

echo "📚 Documentation:"
echo "   - PILL_EDITOR_TESTING.md - Comprehensive testing guide"
echo "   - PILL_IMPLEMENTATION_SUMMARY.md - Implementation details"
echo "   - src/editor/PILL_EDITOR_QUICK_REFERENCE.ts - Developer reference"
echo ""

echo "🚀 Ready to test! Run 'npm run dev' to start the development server."
echo ""
