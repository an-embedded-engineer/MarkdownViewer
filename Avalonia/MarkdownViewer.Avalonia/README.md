# Markdown Viewer Avalonia MVP

Avalonia UI + C# + NativeWebView based read-only Markdown viewer.

## Requirements

- .NET SDK 10.0 or newer for the current template output
- macOS: WKWebView is provided by the OS
- Windows: WebView2 runtime is required
- Linux: WPE WebKit runtime libraries are required by `NativeWebView`

## Run

```bash
DOTNET_CLI_HOME=/private/tmp/codex_dotnet_home dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
DOTNET_CLI_HOME=/private/tmp/codex_dotnet_home dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
```

## Implemented MVP Scope

- Open Folder via Avalonia `StorageProvider`
- Explorer-style tree for directories, `.md`, `.markdown`, and image files
- Markdown rendering via Markdig
- Mermaid code block rendering via bundled `Assets/mermaid.min.js`
- Light/Dark theme toggle for both Avalonia UI and rendered Markdown
- Relative image resolution through an HTML `<base>` tag
- Relative Markdown link navigation through WebView-to-C# messages
- External HTTP/HTTPS links opened with the OS default browser

## Notes

Use `sample_docs/README.md` as the first manual smoke test folder.
