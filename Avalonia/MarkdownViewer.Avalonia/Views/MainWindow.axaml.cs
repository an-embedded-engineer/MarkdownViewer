using System.Text;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;
using Avalonia.Styling;
using MarkdownViewer.Avalonia.ViewModels;

namespace MarkdownViewer.Avalonia.Views;

public partial class MainWindow : Window
{
    private readonly string _previewDirectory = Path.Combine(
        Path.GetTempPath(),
        "MarkdownViewer.Avalonia",
        Guid.NewGuid().ToString("N"));
    private int _previewRevision;

    public MainWindow()
    {
        InitializeComponent();
        DataContextChanged += (_, _) => AttachViewModel();
    }

    private MainWindowViewModel? ViewModel => DataContext as MainWindowViewModel;

    private void AttachViewModel()
    {
        if (ViewModel is null)
        {
            return;
        }

        ViewModel.PreviewRequested -= ViewModel_OnPreviewRequested;
        ViewModel.PreviewRequested += ViewModel_OnPreviewRequested;
    }

    private async void OpenFolderButton_OnClick(object? sender, RoutedEventArgs e)
    {
        var folders = await StorageProvider.OpenFolderPickerAsync(new FolderPickerOpenOptions
        {
            Title = "Open Markdown Folder",
            AllowMultiple = false
        });

        var folderPath = folders.FirstOrDefault()?.TryGetLocalPath();
        if (!string.IsNullOrWhiteSpace(folderPath) && ViewModel is not null)
        {
            await ViewModel.OpenFolderAsync(folderPath);
        }
    }

    private void ThemeButton_OnClick(object? sender, RoutedEventArgs e)
    {
        if (ViewModel is null)
        {
            return;
        }

        ViewModel.ToggleTheme();
        global::Avalonia.Application.Current!.RequestedThemeVariant =
            ViewModel.IsDarkTheme ? ThemeVariant.Dark : ThemeVariant.Light;
    }

    private async void ReloadButton_OnClick(object? sender, RoutedEventArgs e)
    {
        if (ViewModel is not null)
        {
            await ViewModel.ReloadAsync();
        }
    }

    private async void ExplorerTree_OnSelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (ViewModel is null ||
            e.AddedItems.Count == 0 ||
            e.AddedItems[0] is not FileTreeNodeViewModel node ||
            !node.IsMarkdown)
        {
            return;
        }

        await ViewModel.OpenMarkdownAsync(node.Path);
    }

    private void ViewModel_OnPreviewRequested(object? sender, PreviewRequestedEventArgs e)
    {
        Directory.CreateDirectory(_previewDirectory);
        var previewPath = Path.Combine(_previewDirectory, "preview.html");
        File.WriteAllText(previewPath, e.Html, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

        var previewUri = new UriBuilder(new Uri(previewPath))
        {
            Query = $"revision={++_previewRevision}"
        }.Uri;
        PreviewWebView.Navigate(previewUri);
    }

    protected override void OnClosed(EventArgs e)
    {
        base.OnClosed(e);

        try
        {
            if (Directory.Exists(_previewDirectory))
            {
                Directory.Delete(_previewDirectory, recursive: true);
            }
        }
        catch (IOException)
        {
            // WebView がfile handleを解放する前に終了した場合はOSの一時領域cleanupへ委ねる。
        }
        catch (UnauthorizedAccessException)
        {
            // WebView がfile handleを解放する前に終了した場合はOSの一時領域cleanupへ委ねる。
        }
    }

    private void PreviewWebView_OnNavigationCompleted(object? sender, WebViewNavigationCompletedEventArgs e)
    {
    }

    private async void PreviewWebView_OnWebMessageReceived(object? sender, WebMessageReceivedEventArgs e)
    {
        if (ViewModel is not null && e.Body is not null)
        {
            await ViewModel.HandleWebMessageAsync(e.Body);
        }
    }
}
