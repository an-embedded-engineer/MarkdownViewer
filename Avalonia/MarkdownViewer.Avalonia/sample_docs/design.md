# Design Note

The MVP keeps the native shell simple:

1. Avalonia renders the toolbar and explorer.
2. C# reads Markdown files from the selected root.
3. Markdig converts Markdown to an HTML fragment.
4. NativeWebView displays the HTML document.

Back to [README](./README.md).
