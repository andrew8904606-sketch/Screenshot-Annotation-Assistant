# Screenshot Annotation Assistant (截图标注助手)

A Chrome extension (Manifest V3) that records web page interactions and automatically generates step-by-step screenshots with annotations. Supports exporting to ZIP or PDF.

## Features

- **One-click Capture**: Click "Start Capture" to begin recording your interactions with web pages
- **Auto Element Detection**: Automatically highlights interactive elements (buttons, links, inputs, etc.)
- **Screenshot Gallery**: View, edit, and manage captured screenshots in the popup
- **Custom Annotations**: Add custom text descriptions to each step
- **Image Editor**: Built-in image editor for drawing rectangles, arrows, text annotations
- **Export Options**: Export screenshots as ZIP archive or PDF document
- **Multi-language Support**: Supports Chinese (Simplified) and English

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right corner)
3. Click "Load unpacked"
4. Select the `browser_plugin/v1.3.7` folder

## Usage

### Start Capturing
1. Click the extension icon in Chrome toolbar
2. Click "开始捕获" (Start Capture) button
3. Navigate to any webpage - interactive elements will be highlighted
4. Click on elements you want to capture

### Manage Screenshots
- **View**: Screenshots appear in the gallery below
- **Edit**: Click the edit icon to annotate images
- **Copy**: Click the copy icon to copy to clipboard
- **Delete**: Click the delete icon to remove a screenshot
- **Caption**: Type in the text box to add/modify descriptions

### Export
- Click "导出为" (Export) dropdown
- Choose "图片压缩包" (ZIP Archive) or "PDF文档" (PDF Document)

### Settings
Click the gear icon to access settings:
- **Language**: Switch between Chinese and English
- **Annotation Color**: Choose highlight color (red, blue, green, yellow, purple, or custom)

## Technical Details

This extension uses Chrome's Manifest V3 API and consists of:

- `background.js` - Service worker for state management and screenshot capture
- `content.js` - Injected script for element detection and highlighting
- `popup.js` - Popup UI with gallery and export functionality
- `image-editor.js` - Canvas-based image annotation tool

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

