# Screenshot Annotation Assistant - User Guide

A Chrome browser extension that records web page interactions and automatically generates step-by-step screenshots with annotations. Supports exporting to ZIP or PDF.

---

## 1. Getting Started

### 1.1 Installation

1. Open Chrome browser
2. Navigate to `chrome://extensions/` in the address bar
3. Enable "Developer mode" (top right corner)
4. Click "Load unpacked"
5. Select the extension folder

> After installation, the extension icon will appear in the Chrome toolbar.

### 1.2 Basic Workflow

```
Click extension icon → Click "Start Capture" → Click elements on web pages → Screenshots are saved automatically
```

---

## 2. Features

### 2.1 Capture Mode

#### Start Capture
Click "Start Capture" button to enter capture mode. Then:
- Status shows "Capturing"
- Move mouse over web page elements to see highlighting
- Click any interactive element (button, link, input, etc.) - the system automatically captures the current page

#### Pause and Resume
- Click "Pause" to pause capture (status shows "Paused")
- Click "Resume" to continue capture

#### Stop Capture
Click "Finish" button to stop capture - status returns to "Rest"

### 2.2 Screenshot Gallery

All captured screenshots are displayed in the gallery area:

| Feature | Description |
|---------|-------------|
| View | Click image to zoom in |
| Edit | Click edit icon to annotate with built-in drawing tools |
| Copy | Click copy icon to copy image to clipboard |
| Delete | Click delete icon to remove single screenshot (other screenshots renumber automatically) |
| Add Caption | Enter operation description in the text box below the image |

### 2.3 Export Options

Click "Export" dropdown button:

- **ZIP Archive**: Download all screenshots as a ZIP file
- **PDF Document**: Enter a title to generate a PDF document (one screenshot per page)

### 2.4 Settings

Click the gear icon (top right) to open settings:

#### Language
Two languages supported:
- 简体中文 (Simplified Chinese)
- English

#### Highlight Color
Choose highlight border color - 6 preset colors plus custom:

- Red `#DC2626`
- Blue `#2563EB`
- Green `#10B981`
- Yellow `#F59E0B`
- Purple `#8B5CF6`
- Custom: Click color picker to select any color

> Color settings take effect on next capture

### 2.5 Image Editor

Click the edit icon on any screenshot to open the image editor:

#### Available Tools

| Tool | Function |
|------|----------|
| Rectangle | Draw rectangular boxes |
| Arrow | Draw arrows to point at elements |
| Brush | Freehand drawing |
| Eraser | Erase annotations |
| Text | Add text labels |

#### Editor Operations

- **Save**: Click save button to overwrite original image with annotations
- **Undo**: Click undo button to revert last action
- **Clear**: Click clear button to remove all annotations

---

## 3. Interface

### 3.1 Main Interface

```
┌─────────────────────────────────┐
│  LessEffortMa          ⚙️      │
│  State: Rest                     │
├─────────────────────────────────┤
│  Preview                         │
│  ┌─────┐ ┌─────┐ ┌─────┐      │
│  │Img1 │ │Img2 │ │Img3 │      │
│  └─────┘ └─────┘ └─────┘      │
├─────────────────────────────────┤
│  [Capture]                       │
│  [Save as ▼]  [Clear]          │
└─────────────────────────────────┘
```

### 3.2 Status Indicators

| Status | Meaning |
|--------|---------|
| Rest | Not capturing |
| Capturing | Actively recording page interactions |
| Paused | Capture paused, can resume |

---

## 4. Notes

1. **Permissions**: Extension requires permission to access all web pages for element detection and screenshots
2. **Storage**: Screenshots are stored locally in Base64 format - recommended to export and clear periodically
3. **Compatibility**: Some special pages (like chrome:// pages) cannot have scripts injected

---

## 5. FAQ

**Q: Clicking elements has no response?**
A: Make sure you are in "Capturing" status and clicking on interactive elements (buttons, links, inputs, etc.)

**Q: Screenshots are blank?**
A: Some pages may disable screenshot functionality - try refreshing the page

**Q: Cannot export PDF?**
A: Make sure a PDF title is entered and there are screenshots to export

---

## 6. Technical Info

- Version: 1.3.7
- Manifest Version: 3
- Dependencies: JSZip (ZIP export), jsPDF (PDF export)
