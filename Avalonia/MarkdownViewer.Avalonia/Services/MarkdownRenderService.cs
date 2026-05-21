using System.Text.Encodings.Web;
using System.Text.RegularExpressions;
using Markdig;

namespace MarkdownViewer.Avalonia.Services;

public interface IMarkdownRenderService
{
    /// <summary>
    /// Markdown本文をプレビュー用HTML fragmentへ変換する。
    /// </summary>
    Task<string> RenderToHtmlFragmentAsync(string markdown, CancellationToken cancellationToken);
}

public sealed partial class MarkdownRenderService : IMarkdownRenderService
{
    private readonly IPlantUmlRenderService _plantUmlRenderService;
    private readonly MarkdownPipeline _pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .Build();

    public MarkdownRenderService()
        : this(new PlantUmlRenderService())
    {
    }

    public MarkdownRenderService(IPlantUmlRenderService plantUmlRenderService)
    {
        _plantUmlRenderService = plantUmlRenderService;
    }

    public async Task<string> RenderToHtmlFragmentAsync(string markdown, CancellationToken cancellationToken)
    {
        var diagramBlocks = new List<DiagramBlock>();
        var markdownWithPlaceholders = DiagramFenceRegex().Replace(markdown, match =>
        {
            var language = match.Groups["language"].Value.ToLowerInvariant();
            var diagramType = language == "mermaid" ? DiagramType.Mermaid : DiagramType.PlantUml;
            var placeholder = $"DIAGRAM_BLOCK_{diagramBlocks.Count:D4}";
            diagramBlocks.Add(new DiagramBlock(diagramType, match.Groups["code"].Value.Trim()));
            return Environment.NewLine + placeholder + Environment.NewLine;
        });

        var html = Markdown.ToHtml(markdownWithPlaceholders, _pipeline);

        for (var index = 0; index < diagramBlocks.Count; index++)
        {
            var placeholder = $"DIAGRAM_BLOCK_{index:D4}";
            var diagramHtml = await RenderDiagramAsync(diagramBlocks[index], cancellationToken);
            html = html
                .Replace($"<p>{placeholder}</p>", diagramHtml, StringComparison.Ordinal)
                .Replace(placeholder, diagramHtml, StringComparison.Ordinal);
        }

        return html;
    }

    private Task<string> RenderDiagramAsync(DiagramBlock diagramBlock, CancellationToken cancellationToken)
    {
        if (diagramBlock.Type == DiagramType.PlantUml)
        {
            return _plantUmlRenderService.RenderToHtmlAsync(diagramBlock.Code, cancellationToken);
        }

        var escapedCode = HtmlEncoder.Default.Encode(diagramBlock.Code);
        return Task.FromResult($"""<div class="mermaid">{escapedCode}</div>""");
    }

    [GeneratedRegex(@"(?ms)^```[ \t]*(?<language>mermaid|plantuml|puml)[^\r\n]*\r?\n(?<code>.*?)\r?\n```[ \t]*$")]
    private static partial Regex DiagramFenceRegex();

    private enum DiagramType
    {
        Mermaid,
        PlantUml
    }

    private sealed record DiagramBlock(DiagramType Type, string Code);
}
