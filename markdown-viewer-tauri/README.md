# Markdown Viewer Tauri

Tauri v2 + React + TypeScript implementation of the Markdown Viewer MVP.

## Features

- Open a folder with the native folder picker.
- Browse directories, Markdown files, and image files in a VS Code style explorer.
- Render `.md` and `.markdown` files with GitHub Flavored Markdown basics.
- Render Mermaid fenced code blocks.
- Switch between light and dark themes.
- Display relative images through Tauri's asset protocol.
- Navigate relative Markdown links inside the app.
- Open external `http` and `https` links in the system browser.

## Development

```sh
npm install
npm run tauri dev
```

Useful checks:

```sh
npm run build
cd src-tauri
cargo check
```

## Notes

- The app skips `.git`, `node_modules`, `bin`, `obj`, `target`, `.venv`, and `__pycache__` while scanning folders.
- Full-text search, split view, tab persistence/reorder, file watching, and packaging are outside this MVP.
- Markdown files open in a horizontally scrollable TabStrip. Selecting an already-open file activates its tab; Reload refreshes only the active tab.
- Local images use the Tauri asset protocol. The current MVP allows a broad asset scope so arbitrary selected folders can display relative images.
