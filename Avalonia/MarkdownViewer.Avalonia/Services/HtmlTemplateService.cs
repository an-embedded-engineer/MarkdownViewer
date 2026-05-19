using System.Text;
using System.Text.Encodings.Web;
using Avalonia.Platform;
using MarkdownViewer.Avalonia.Models;

namespace MarkdownViewer.Avalonia.Services;

public interface IHtmlTemplateService
{
    string BuildHtmlDocument(string bodyHtml, string basePath, AppTheme theme);
}

public sealed class HtmlTemplateService : IHtmlTemplateService
{
    private readonly Lazy<string> _mermaidScript = new(LoadMermaidScript);

    public string BuildHtmlDocument(string bodyHtml, string basePath, AppTheme theme)
    {
        var baseDirectory = Directory.Exists(basePath) ? basePath : Path.GetDirectoryName(basePath) ?? basePath;
        var baseUri = new Uri(Path.GetFullPath(baseDirectory) + Path.DirectorySeparatorChar);
        var themeName = theme == AppTheme.Dark ? "dark" : "light";
        var mermaidTheme = theme == AppTheme.Dark ? "dark" : "default";
        var script = _mermaidScript.Value.Replace("</script", "<\\/script", StringComparison.OrdinalIgnoreCase);

        return $$"""
<!doctype html>
<html lang="en" class="{{themeName}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="{{HtmlEncoder.Default.Encode(baseUri.AbsoluteUri)}}">
  <style>
{{BuildCss()}}
  </style>
</head>
<body>
  <main class="markdown-body">
{{bodyHtml}}
  </main>
  <script>
{{script}}
  </script>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: '{{mermaidTheme}}', securityLevel: 'strict' });
    mermaid.run({ querySelector: '.mermaid' });

    document.addEventListener('click', function (event) {
      const link = event.target.closest('a[href]');
      if (!link) return;

      const rawHref = link.getAttribute('href') || '';
      if (rawHref.startsWith('#')) return;

      const href = link.href;
      const url = new URL(href);

      if (url.protocol === 'http:' || url.protocol === 'https:') {
        event.preventDefault();
        invokeCSharpAction(JSON.stringify({ type: 'openExternal', href: href }));
        return;
      }

      if (url.protocol === 'file:' && /\.(md|markdown)$/i.test(decodeURIComponent(url.pathname))) {
        event.preventDefault();
        invokeCSharpAction(JSON.stringify({ type: 'openMarkdown', href: href }));
      }
    });
  </script>
</body>
</html>
""";
    }

    private static string LoadMermaidScript()
    {
        using var stream = AssetLoader.Open(new Uri("avares://MarkdownViewer.Avalonia/Assets/mermaid.min.js"));
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static string BuildCss()
    {
        return """
        :root {
          color-scheme: light;
          --bg: #f7f7f8;
          --fg: #20242a;
          --muted: #5d6673;
          --border: #d9dde4;
          --code-bg: #eef1f5;
          --link: #1565c0;
          --table-head: #edf2f7;
        }

        html.dark {
          color-scheme: dark;
          --bg: #111317;
          --fg: #e6eaf0;
          --muted: #a6afbd;
          --border: #303742;
          --code-bg: #1c222b;
          --link: #80bfff;
          --table-head: #202833;
        }

        body {
          margin: 0;
          background: var(--bg);
          color: var(--fg);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          line-height: 1.62;
        }

        .markdown-body {
          box-sizing: border-box;
          max-width: 980px;
          min-height: 100vh;
          margin: 0 auto;
          padding: 32px 40px 56px;
          background: var(--bg);
        }

        h1, h2, h3, h4 {
          line-height: 1.25;
          margin: 1.6em 0 .65em;
        }

        h1 {
          padding-bottom: .35em;
          border-bottom: 1px solid var(--border);
        }

        a { color: var(--link); }
        img { max-width: 100%; height: auto; }
        blockquote {
          margin: 1em 0;
          padding: .25em 1em;
          color: var(--muted);
          border-left: 4px solid var(--border);
        }

        pre {
          overflow-x: auto;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--code-bg);
        }

        code {
          padding: .15em .35em;
          border-radius: 4px;
          background: var(--code-bg);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: .92em;
        }

        pre code {
          padding: 0;
          background: transparent;
        }

        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }

        th, td {
          border: 1px solid var(--border);
          padding: 8px 10px;
        }

        th {
          background: var(--table-head);
        }

        .mermaid {
          margin: 20px 0;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: color-mix(in srgb, var(--bg), var(--code-bg) 45%);
          overflow-x: auto;
        }
        """;
    }
}
