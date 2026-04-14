# ExamBank PDF Viewer

A production-grade, modern PDF Viewer web application with a polished UI/UX similar to high-end SaaS platforms like Notion, Linear, and Google Drive.

## Features

### Core Features
- **PDF Rendering**: Uses Mozilla's PDF.js for high-quality rendering
- **Page Navigation**: Next/Previous page, jump to specific page
- **Zoom Controls**: Zoom in/out, fit to width, fit to page
- **Search**: Full-text search with result highlighting and navigation
- **Sidebar**: Page thumbnails for quick navigation
- **Dark/Light Mode**: Toggle between themes with persistence
- **Bookmarks**: Bookmark pages for quick reference
- **Drag & Drop**: Simply drag PDF files onto the viewer
- **Keyboard Shortcuts**: Comprehensive keyboard navigation

### UX Features
- Smooth transitions and animations
- Hover states for all interactive elements
- Loading indicators
- Empty state with clear call-to-action
- Toast notifications for user feedback
- Responsive design for various screen sizes

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `←` / `↑` | Previous page |
| `→` / `↓` | Next page |
| `Ctrl + F` | Open search |
| `Ctrl + +` | Zoom in |
| `Ctrl + -` | Zoom out |
| `Ctrl + 0` | Reset zoom |
| `Escape` | Close search |
| `F11` | Toggle fullscreen |

## File Structure

```
pdf/
├── index.html          # Main HTML structure
├── styles.css          # Design system and component styles
├── stateManager.js     # Global state management
├── pdfViewer.js        # PDF.js rendering logic
├── app.js              # Application controller
├── data.pdf            # Default PDF file (auto-loads on startup)
└── README.md           # This file
```

## Architecture

### Component-Based Structure

1. **StateManager** (`stateManager.js`)
   - Centralized state management
   - Reactive subscriptions
   - localStorage persistence
   - Theme management

2. **PDFViewer** (`pdfViewer.js`)
   - PDF.js integration
   - Page rendering with caching
   - Thumbnail generation
   - Text extraction and search

3. **App** (`app.js`)
   - UI event handling
   - State subscriptions
   - Keyboard shortcuts
   - Drag & drop support

### Design System

The CSS uses a comprehensive design token system:

- **Colors**: Semantic color variables for light/dark themes
- **Typography**: Inter (primary) + JetBrains Mono (code/numbers)
- **Spacing**: 4px base scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- **Radius**: Consistent border radius scale
- **Shadows**: Multiple elevation levels
- **Transitions**: Smooth, hardware-accelerated animations

## Usage

### Local Development

1. Start a local server (required for PDF.js worker):

   ```bash
   # Using Python
   python -m http.server 8080
   
   # Using Node.js (if you have npx)
   npx serve
   
   # Using PHP
   php -S localhost:8080
   ```

2. Open `http://localhost:8080` in your browser

3. The app will automatically load `data.pdf` if present

### Opening PDF Files

- **Automatic**: Place a `data.pdf` file in the root directory
- **Manual**: Click "Open PDF" button
- **Drag & Drop**: Drop a PDF file onto the viewer

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Technologies

- **PDF.js**: Mozilla's PDF rendering engine (v3.11.174)
- **Vanilla JavaScript**: No framework dependencies
- **CSS3**: Modern features including CSS variables, backdrop-filter, grid/flexbox
- **Canvas API**: High-performance PDF rendering

## Performance Optimizations

- Page rendering cancellation for smooth navigation
- Thumbnail generation in batches
- Text content preloading for fast search
- Canvas caching for rendered pages
- Debounced search input
- requestAnimationFrame for smooth animations

## Design Philosophy

This application follows enterprise-level design principles:

1. **Consistency**: Unified design tokens across all components
2. **Accessibility**: Focus states, keyboard navigation, reduced motion support
3. **Performance**: Lazy loading, caching, virtualization
4. **Maintainability**: Clean separation of concerns, modular architecture
5. **User Experience**: Intuitive controls, clear feedback, smooth interactions

## License

MIT License - Feel free to use this in your projects!

## Credits

Built with ❤️ using PDF.js by Mozilla
Design inspired by modern SaaS platforms (Notion, Linear, Google Drive)
