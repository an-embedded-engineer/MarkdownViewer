using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.RegularExpressions;

namespace MarkdownViewer.Avalonia.Services;

public interface IPlantUmlRenderService
{
    /// <summary>
    /// PlantUML sourceをSVGまたはエラー表示用HTMLへ変換する。
    /// </summary>
    Task<string> RenderToHtmlAsync(string source, CancellationToken cancellationToken);
}

public sealed partial class PlantUmlRenderService : IPlantUmlRenderService
{
    private static readonly TimeSpan RenderTimeout = TimeSpan.FromSeconds(10);

    private readonly IPlantUmlRuntimeResolver _runtimeResolver;

    public PlantUmlRenderService()
        : this(new PlantUmlRuntimeResolver())
    {
    }

    public PlantUmlRenderService(IPlantUmlRuntimeResolver runtimeResolver)
    {
        _runtimeResolver = runtimeResolver;
    }

    public async Task<string> RenderToHtmlAsync(string source, CancellationToken cancellationToken)
    {
        try
        {
            var options = _runtimeResolver.Resolve();
            var svg = await RenderSvgAsync(options.JarPath, NormalizeSource(source), cancellationToken);
            return $"""<div class="plantuml-diagram">{SanitizeSvg(svg)}</div>""";
        }
        catch (Exception ex) when (ex is PlantUmlRuntimeException or Win32Exception or InvalidOperationException)
        {
            return BuildErrorHtml(ex.Message);
        }
    }

    private static async Task<string> RenderSvgAsync(
        string jarPath,
        string source,
        CancellationToken cancellationToken)
    {
        using var timeout = new CancellationTokenSource(RenderTimeout);
        using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeout.Token);

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "java",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        process.StartInfo.ArgumentList.Add("-jar");
        process.StartInfo.ArgumentList.Add(jarPath);
        process.StartInfo.ArgumentList.Add("-tsvg");
        process.StartInfo.ArgumentList.Add("-pipe");

        process.Start();

        var outputTask = process.StandardOutput.ReadToEndAsync(linkedCancellation.Token);
        var errorTask = process.StandardError.ReadToEndAsync(linkedCancellation.Token);

        await process.StandardInput.WriteAsync(source.AsMemory(), linkedCancellation.Token);
        process.StandardInput.Close();

        try
        {
            await process.WaitForExitAsync(linkedCancellation.Token);
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            TryKill(process);
            throw new InvalidOperationException("PlantUML render timed out.");
        }

        var output = await outputTask;
        var error = await errorTask;
        if (process.ExitCode != 0)
        {
            var message = string.IsNullOrWhiteSpace(error)
                ? $"PlantUML exited with code {process.ExitCode}."
                : error.Trim();
            throw new InvalidOperationException(message);
        }

        if (string.IsNullOrWhiteSpace(output))
        {
            throw new InvalidOperationException("PlantUML produced empty SVG output.");
        }

        return output;
    }

    private static string NormalizeSource(string source)
    {
        var trimmed = source.Trim();
        if (StartDirectiveRegex().IsMatch(trimmed) && EndDirectiveRegex().IsMatch(trimmed))
        {
            return trimmed;
        }

        return $"@startuml{Environment.NewLine}{trimmed}{Environment.NewLine}@enduml";
    }

    private static string SanitizeSvg(string svg)
    {
        var withoutScripts = ScriptElementRegex().Replace(svg, string.Empty);
        return EventHandlerAttributeRegex().Replace(withoutScripts, string.Empty);
    }

    private static string BuildErrorHtml(string message)
    {
        var escapedMessage = HtmlEncoder.Default.Encode(message);
        return $"""<pre class="plantuml-error">PlantUML render failed: {escapedMessage}</pre>""";
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (InvalidOperationException)
        {
        }
    }

    [GeneratedRegex(@"(?im)^\s*@start\w*")]
    private static partial Regex StartDirectiveRegex();

    [GeneratedRegex(@"(?im)^\s*@end\w*")]
    private static partial Regex EndDirectiveRegex();

    [GeneratedRegex(@"(?is)<script\b[^>]*>.*?</script\s*>")]
    private static partial Regex ScriptElementRegex();

    [GeneratedRegex(@"\s+on[a-zA-Z]+\s*=\s*(""[^""]*""|'[^']*')")]
    private static partial Regex EventHandlerAttributeRegex();
}
