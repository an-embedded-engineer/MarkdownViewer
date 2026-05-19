namespace MarkdownViewer.Avalonia.Models;

public sealed class FileTreeNode
{
    public required string Name { get; init; }

    public required string Path { get; init; }

    public required string RelativePath { get; init; }

    public required FileNodeType Type { get; init; }

    public List<FileTreeNode> Children { get; init; } = [];
}
