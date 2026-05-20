using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Text.Json;
using CommunityToolkit.Mvvm.ComponentModel;
using MarkdownViewer.Avalonia.Models;
using MarkdownViewer.Avalonia.Services;

namespace MarkdownViewer.Avalonia.ViewModels;

public sealed class PreviewRequestedEventArgs(string html) : EventArgs
{
    public string Html { get; } = html;
}

public partial class MainWindowViewModel : ViewModelBase
{
    private readonly IFileTreeService _fileTreeService;
    private readonly IMarkdownRenderService _markdownRenderService;
    private readonly IHtmlTemplateService _htmlTemplateService;
    private CancellationTokenSource? _scanCancellation;
    private string? _currentBodyHtml;

    public MainWindowViewModel()
        : this(new FileTreeService(), new MarkdownRenderService(), new HtmlTemplateService())
    {
    }

    public MainWindowViewModel(
        IFileTreeService fileTreeService,
        IMarkdownRenderService markdownRenderService,
        IHtmlTemplateService htmlTemplateService)
    {
        _fileTreeService = fileTreeService;
        _markdownRenderService = markdownRenderService;
        _htmlTemplateService = htmlTemplateService;
    }

    public event EventHandler<PreviewRequestedEventArgs>? PreviewRequested;

    public ObservableCollection<FileTreeNodeViewModel> FileTree { get; } = [];

    [ObservableProperty]
    private string? _rootPath;

    [ObservableProperty]
    private string? _currentPath;

    [ObservableProperty]
    private string _statusMessage = "Open a folder to start browsing Markdown files.";

    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private bool _isDarkTheme;

    public AppTheme Theme => IsDarkTheme ? AppTheme.Dark : AppTheme.Light;

    public async Task OpenFolderAsync(string rootPath)
    {
        RootPath = Path.GetFullPath(rootPath);
        StatusMessage = "Scanning folder...";
        IsBusy = true;
        FileTree.Clear();

        _scanCancellation?.Cancel();
        _scanCancellation = new CancellationTokenSource();

        try
        {
            var rootNode = await _fileTreeService.ScanAsync(RootPath, _scanCancellation.Token);
            FileTree.Add(new FileTreeNodeViewModel(rootNode));
            StatusMessage = RootPath;

            var readme = FindFirstMarkdown(rootNode, preferReadme: true);
            if (readme is not null)
            {
                await OpenMarkdownAsync(readme.Path);
            }
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            StatusMessage = $"Failed to scan folder: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task ReloadAsync()
    {
        if (RootPath is null)
        {
            return;
        }

        var currentPath = CurrentPath;
        await OpenFolderAsync(RootPath);

        if (currentPath is not null && File.Exists(currentPath))
        {
            await OpenMarkdownAsync(currentPath);
        }
    }

    public async Task OpenMarkdownAsync(string path)
    {
        if (!IsMarkdownPath(path) || RootPath is null || !IsInsideRoot(path))
        {
            return;
        }

        try
        {
            var markdown = await File.ReadAllTextAsync(path);
            var bodyHtml = await _markdownRenderService.RenderToHtmlFragmentAsync(markdown, CancellationToken.None);
            var documentHtml = _htmlTemplateService.BuildHtmlDocument(bodyHtml, path, Theme);

            CurrentPath = path;
            _currentBodyHtml = bodyHtml;
            StatusMessage = Path.GetRelativePath(RootPath, path);
            PreviewRequested?.Invoke(this, new PreviewRequestedEventArgs(documentHtml));
        }
        catch (Exception ex)
        {
            StatusMessage = $"Failed to open Markdown: {ex.Message}";
        }
    }

    public void ToggleTheme()
    {
        IsDarkTheme = !IsDarkTheme;

        if (CurrentPath is not null && _currentBodyHtml is not null)
        {
            var documentHtml = _htmlTemplateService.BuildHtmlDocument(_currentBodyHtml, CurrentPath, Theme);
            PreviewRequested?.Invoke(this, new PreviewRequestedEventArgs(documentHtml));
        }
    }

    public async Task HandleWebMessageAsync(string messageBody)
    {
        using var document = JsonDocument.Parse(messageBody);
        var root = document.RootElement;

        if (!root.TryGetProperty("type", out var typeProperty) ||
            !root.TryGetProperty("href", out var hrefProperty))
        {
            return;
        }

        var type = typeProperty.GetString();
        var href = hrefProperty.GetString();
        if (string.IsNullOrWhiteSpace(type) || string.IsNullOrWhiteSpace(href))
        {
            return;
        }

        if (type == "openExternal" && Uri.TryCreate(href, UriKind.Absolute, out var externalUri))
        {
            OpenExternalUri(externalUri);
            return;
        }

        if (type == "openMarkdown" &&
            Uri.TryCreate(href, UriKind.Absolute, out var fileUri) &&
            fileUri.IsFile)
        {
            await OpenMarkdownAsync(fileUri.LocalPath);
        }
    }

    private static void OpenExternalUri(Uri uri)
    {
        using var _ = Process.Start(new ProcessStartInfo(uri.AbsoluteUri)
        {
            UseShellExecute = true
        });
    }

    private bool IsInsideRoot(string path)
    {
        if (RootPath is null)
        {
            return false;
        }

        var normalizedRoot = Path.GetFullPath(RootPath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var normalizedPath = Path.GetFullPath(path);
        return normalizedPath.StartsWith(normalizedRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ||
               string.Equals(normalizedPath, normalizedRoot, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsMarkdownPath(string path)
    {
        var extension = Path.GetExtension(path);
        return string.Equals(extension, ".md", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(extension, ".markdown", StringComparison.OrdinalIgnoreCase);
    }

    private static FileTreeNode? FindFirstMarkdown(FileTreeNode root, bool preferReadme)
    {
        var markdownNodes = Flatten(root).Where(node => node.Type == FileNodeType.Markdown).ToList();

        if (preferReadme)
        {
            var readme = markdownNodes.FirstOrDefault(node =>
                string.Equals(node.Name, "README.md", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(node.Name, "README.markdown", StringComparison.OrdinalIgnoreCase));
            if (readme is not null)
            {
                return readme;
            }
        }

        return markdownNodes.FirstOrDefault();
    }

    private static IEnumerable<FileTreeNode> Flatten(FileTreeNode node)
    {
        yield return node;

        foreach (var child in node.Children.SelectMany(Flatten))
        {
            yield return child;
        }
    }
}
