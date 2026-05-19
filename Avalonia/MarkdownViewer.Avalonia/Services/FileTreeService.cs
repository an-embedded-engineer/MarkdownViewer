using MarkdownViewer.Avalonia.Models;

namespace MarkdownViewer.Avalonia.Services;

public interface IFileTreeService
{
    Task<FileTreeNode> ScanAsync(string rootPath, CancellationToken cancellationToken);
}

public sealed class FileTreeService : IFileTreeService
{
    private static readonly HashSet<string> ExcludedDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        ".git",
        "node_modules",
        "bin",
        "obj",
        "target",
        ".venv",
        "__pycache__"
    };

    private static readonly HashSet<string> MarkdownExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".md",
        ".markdown"
    };

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".svg",
        ".bmp"
    };

    public Task<FileTreeNode> ScanAsync(string rootPath, CancellationToken cancellationToken)
    {
        var normalizedRoot = Path.GetFullPath(rootPath);

        return Task.Run(() => BuildNode(normalizedRoot, normalizedRoot, cancellationToken), cancellationToken);
    }

    private static FileTreeNode BuildNode(string path, string rootPath, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var directoryInfo = new DirectoryInfo(path);
        var children = new List<FileTreeNode>();

        IEnumerable<DirectoryInfo> directories = [];
        IEnumerable<FileInfo> files = [];

        try
        {
            directories = directoryInfo.EnumerateDirectories()
                .Where(directory => !ExcludedDirectories.Contains(directory.Name));
            files = directoryInfo.EnumerateFiles();
        }
        catch (UnauthorizedAccessException)
        {
        }
        catch (IOException)
        {
        }

        foreach (var directory in directories.OrderBy(directory => directory.Name, StringComparer.CurrentCultureIgnoreCase))
        {
            children.Add(BuildNode(directory.FullName, rootPath, cancellationToken));
        }

        foreach (var file in files.Select(file => ToFileNode(file, rootPath)).Where(node => node is not null).Cast<FileTreeNode>())
        {
            children.Add(file);
        }

        return new FileTreeNode
        {
            Name = directoryInfo.Name,
            Path = directoryInfo.FullName,
            RelativePath = Path.GetRelativePath(rootPath, directoryInfo.FullName),
            Type = FileNodeType.Directory,
            Children = children
                .OrderBy(node => GetSortRank(node.Type))
                .ThenBy(node => node.Name, StringComparer.CurrentCultureIgnoreCase)
                .ToList()
        };
    }

    private static FileTreeNode? ToFileNode(FileInfo file, string rootPath)
    {
        var extension = file.Extension;
        var type = MarkdownExtensions.Contains(extension)
            ? FileNodeType.Markdown
            : ImageExtensions.Contains(extension)
                ? FileNodeType.Image
                : FileNodeType.Other;

        if (type == FileNodeType.Other)
        {
            return null;
        }

        return new FileTreeNode
        {
            Name = file.Name,
            Path = file.FullName,
            RelativePath = Path.GetRelativePath(rootPath, file.FullName),
            Type = type
        };
    }

    private static int GetSortRank(FileNodeType type)
    {
        return type switch
        {
            FileNodeType.Directory => 0,
            FileNodeType.Markdown => 1,
            FileNodeType.Image => 2,
            _ => 3
        };
    }
}
