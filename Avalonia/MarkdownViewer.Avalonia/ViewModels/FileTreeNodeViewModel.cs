using System.Collections.ObjectModel;
using MarkdownViewer.Avalonia.Models;

namespace MarkdownViewer.Avalonia.ViewModels;

public sealed class FileTreeNodeViewModel : ViewModelBase
{
    public FileTreeNodeViewModel(FileTreeNode node)
    {
        Name = node.Name;
        Path = node.Path;
        RelativePath = node.RelativePath;
        Type = node.Type;
        Children = new ObservableCollection<FileTreeNodeViewModel>(
            node.Children.Select(child => new FileTreeNodeViewModel(child)));
    }

    public string Name { get; }

    public string Path { get; }

    public string RelativePath { get; }

    public FileNodeType Type { get; }

    public ObservableCollection<FileTreeNodeViewModel> Children { get; }

    public bool IsMarkdown => Type == FileNodeType.Markdown;

    public string Icon => Type switch
    {
        FileNodeType.Directory => ">",
        FileNodeType.Markdown => "#",
        FileNodeType.Image => "I",
        _ => "."
    };
}
