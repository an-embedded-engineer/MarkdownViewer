using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using Markdig;

namespace MarkdownViewer.Avalonia.Services;

public interface IMarkdownRenderService
{
    string RenderToHtmlFragment(string markdown);
}

public sealed partial class MarkdownRenderService : IMarkdownRenderService
{
    private readonly MarkdownPipeline _pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .Build();

    public string RenderToHtmlFragment(string markdown)
    {
        var mermaidBlocks = new List<string>();
        var markdownWithPlaceholders = MermaidFenceRegex().Replace(markdown, match =>
        {
            var placeholder = $"MERMAID_BLOCK_{mermaidBlocks.Count:D4}";
            mermaidBlocks.Add(match.Groups["code"].Value.Trim());
            return Environment.NewLine + placeholder + Environment.NewLine;
        });

        var html = Markdown.ToHtml(markdownWithPlaceholders, _pipeline);

        for (var index = 0; index < mermaidBlocks.Count; index++)
        {
            var placeholder = $"MERMAID_BLOCK_{index:D4}";
            var escapedCode = HtmlEncoder.Default.Encode(mermaidBlocks[index]);
            var mermaidHtml = $"""<div class="mermaid">{escapedCode}</div>""";
            html = html
                .Replace($"<p>{placeholder}</p>", mermaidHtml, StringComparison.Ordinal)
                .Replace(placeholder, mermaidHtml, StringComparison.Ordinal);
        }

        return html;
    }

    [GeneratedRegex(@"(?ms)^```[ \t]*mermaid[ \t]*\r?\n(?<code>.*?)\r?\n```[ \t]*$")]
    private static partial Regex MermaidFenceRegex();
}
