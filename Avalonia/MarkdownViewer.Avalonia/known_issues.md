# Known Issues

- Linux requires WPE WebKit runtime libraries for embedded `NativeWebView`.
- Relative Markdown link navigation reloads the target document but does not scroll to a URL fragment yet.
- File tree scanning is eager. Very large repositories may need lazy loading in a later iteration.
- The viewer assumes UTF-8 Markdown files.
