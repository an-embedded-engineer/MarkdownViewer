using System.Text.Json;

namespace MarkdownViewer.Avalonia.Services;

/// <summary>
/// 解決済みPlantUML runtime設定を表す。
/// </summary>
public sealed record PlantUmlRuntimeOptions(string JarPath, string? ConfigPath);

/// <summary>
/// PlantUML runtime解決時のエラー種別を表す。
/// </summary>
public enum PlantUmlRuntimeError
{
    JarNotFound,
    ConfigInvalid
}

/// <summary>
/// PlantUML runtime設定を解決できない場合の例外。
/// </summary>
public sealed class PlantUmlRuntimeException : Exception
{
    /// <summary>
    /// 例外を初期化する。
    /// </summary>
    public PlantUmlRuntimeException(PlantUmlRuntimeError error, string message)
        : base(message)
    {
        Error = error;
    }

    /// <summary>
    /// runtime解決エラーの種別。
    /// </summary>
    public PlantUmlRuntimeError Error { get; }
}

public interface IPlantUmlRuntimeResolver
{
    /// <summary>
    /// ローカルPlantUML runtime設定を解決する。
    /// </summary>
    PlantUmlRuntimeOptions Resolve();
}

public sealed class PlantUmlRuntimeResolver : IPlantUmlRuntimeResolver
{
    private const string ConfigFileName = "plantuml.config.json";
    private const string JarFileName = "plantuml.jar";

    public PlantUmlRuntimeOptions Resolve()
    {
        foreach (var directory in GetRuntimeDirectories())
        {
            var configPath = Path.Combine(directory, ConfigFileName);
            if (File.Exists(configPath))
            {
                return ResolveFromConfig(configPath);
            }

            var jarPath = Path.Combine(directory, JarFileName);
            if (File.Exists(jarPath))
            {
                return new PlantUmlRuntimeOptions(Path.GetFullPath(jarPath), null);
            }
        }

        throw new PlantUmlRuntimeException(
            PlantUmlRuntimeError.JarNotFound,
            "PlantUML runtime is not configured. Place plantuml.jar next to the executable or set plantUmlJarPath in plantuml.config.json.");
    }

    private static PlantUmlRuntimeOptions ResolveFromConfig(string configPath)
    {
        PlantUmlRuntimeConfig? config;
        try
        {
            var json = File.ReadAllText(configPath);
            config = JsonSerializer.Deserialize<PlantUmlRuntimeConfig>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            throw new PlantUmlRuntimeException(
                PlantUmlRuntimeError.ConfigInvalid,
                $"Failed to read PlantUML config: {ex.Message}");
        }

        if (string.IsNullOrWhiteSpace(config?.PlantUmlJarPath))
        {
            throw new PlantUmlRuntimeException(
                PlantUmlRuntimeError.ConfigInvalid,
                "PlantUML config must contain plantUmlJarPath.");
        }

        var configDirectory = Path.GetDirectoryName(configPath) ?? Directory.GetCurrentDirectory();
        var jarPath = Path.IsPathRooted(config.PlantUmlJarPath)
            ? config.PlantUmlJarPath
            : Path.Combine(configDirectory, config.PlantUmlJarPath);
        var fullJarPath = Path.GetFullPath(jarPath);

        if (!File.Exists(fullJarPath))
        {
            throw new PlantUmlRuntimeException(
                PlantUmlRuntimeError.JarNotFound,
                $"PlantUML jar was not found: {fullJarPath}");
        }

        return new PlantUmlRuntimeOptions(fullJarPath, Path.GetFullPath(configPath));
    }

    private static IEnumerable<string> GetRuntimeDirectories()
    {
        var directories = new[]
        {
            Directory.GetCurrentDirectory(),
            AppContext.BaseDirectory
        };

        return directories
            .Where(static directory => !string.IsNullOrWhiteSpace(directory))
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private sealed class PlantUmlRuntimeConfig
    {
        public string? PlantUmlJarPath { get; init; }
    }
}
