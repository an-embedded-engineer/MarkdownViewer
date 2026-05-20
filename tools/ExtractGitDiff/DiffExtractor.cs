using System.IO.Compression;
using System.Text;

namespace ExtractGitDiff;

/// <summary>コミット範囲の解決、変更ファイル取得、差分抽出を行うサービス。</summary>
public static class DiffExtractor
{
    private static readonly Dictionary<string, FileChangeStatus> StatusMap = new()
    {
        ["A"] = FileChangeStatus.Added,
        ["M"] = FileChangeStatus.Modified,
        ["D"] = FileChangeStatus.Deleted,
    };

    /// <summary>設定に基づきコミットSHA範囲を解決する。</summary>
    public static (string StartSha, string EndSha) ResolveCommitRange(ExtractConfig config)
    {
        return config.RangeSpec switch
        {
            DateRange dr => ResolveDateRange(dr),
            CommitRange cr => ResolveCommitRangeSpec(cr),
            _ => throw new InvalidOperationException("Unknown range spec type"),
        };
    }

    /// <summary>日付範囲からコミットSHA範囲を解決する。</summary>
    private static (string StartSha, string EndSha) ResolveDateRange(DateRange dateRange)
    {
        var output = GitRunner.Run(
            "log", "--format=%H", "--reverse",
            $"--since={dateRange.DateFrom}",
            $"--until={dateRange.DateTo}");

        var lines = output.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0)
        {
            Console.Error.WriteLine(
                $"ERROR: No commits found in date range: {dateRange.DateFrom} to {dateRange.DateTo}");
            Environment.Exit(1);
        }

        return (lines[0], lines[^1]);
    }

    /// <summary>コミットID範囲を検証してSHAを返す。</summary>
    private static (string StartSha, string EndSha) ResolveCommitRangeSpec(CommitRange commitRange)
    {
        string startSha;
        try
        {
            startSha = GitRunner.ValidateCommit(commitRange.CommitFrom);
        }
        catch (GitCommandException)
        {
            Console.Error.WriteLine($"ERROR: Invalid start commit: {commitRange.CommitFrom}");
            Environment.Exit(1);
            return default; // 到達不能だがコンパイラ用
        }

        string endSha;
        try
        {
            endSha = GitRunner.ValidateCommit(commitRange.CommitTo);
        }
        catch (GitCommandException)
        {
            Console.Error.WriteLine($"ERROR: Invalid end commit: {commitRange.CommitTo}");
            Environment.Exit(1);
            return default;
        }

        return (startSha, endSha);
    }

    /// <summary>範囲内のコミット一覧を取得する。</summary>
    public static List<CommitInfo> GetCommitList(string startSha, string endSha)
    {
        var hasParent = GitRunner.CheckHasParent(startSha);
        var rangeSpec = hasParent ? $"{startSha}^..{endSha}" : $"{startSha}..{endSha}";

        var output = GitRunner.Run("log", "--format=%H\t%s", "--reverse", rangeSpec);
        var commits = new List<CommitInfo>();

        // 親なしの場合、start_sha自体を先頭に追加
        if (!hasParent)
        {
            var startOutput = GitRunner.Run("log", "--format=%H\t%s", "-1", startSha).Trim();
            if (!string.IsNullOrEmpty(startOutput))
            {
                var parts = startOutput.Split('\t', 2);
                commits.Add(new CommitInfo(parts[0], parts.Length > 1 ? parts[1] : ""));
            }
        }

        foreach (var line in output.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t', 2);
            commits.Add(new CommitInfo(parts[0], parts.Length > 1 ? parts[1] : ""));
        }

        return commits;
    }

    /// <summary>範囲内で変更されたファイル一覧を取得する。</summary>
    public static List<ChangedFile> GetChangedFiles(string startSha, string endSha)
    {
        var hasParent = GitRunner.CheckHasParent(startSha);
        var diffFrom = hasParent ? $"{startSha}^" : startSha;

        var output = GitRunner.Run("diff", "--name-status", "--diff-filter=ADM", diffFrom, endSha);
        var files = new List<ChangedFile>();

        foreach (var line in output.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t', 2);
            if (parts.Length < 2) continue;

            var statusChar = parts[0].Trim();
            var filePath = parts[1].Trim();

            if (StatusMap.TryGetValue(statusChar, out var status))
            {
                files.Add(new ChangedFile(filePath, status));
            }
        }

        return files;
    }

    /// <summary>ディレクトリ・拡張子でフィルタする。</summary>
    public static List<ChangedFile> FilterFiles(List<ChangedFile> files, ExtractConfig config)
    {
        var filtered = new List<ChangedFile>();

        foreach (var f in files)
        {
            // ディレクトリフィルタ
            if (config.Dirs.Count > 0)
            {
                var matched = config.Dirs.Any(d =>
                    f.Path == d || f.Path.StartsWith(d.TrimEnd('/') + "/", StringComparison.Ordinal));
                if (!matched) continue;
            }

            // 拡張子フィルタ
            if (config.Extensions.Count > 0)
            {
                var extMatched = config.Extensions.Any(ext =>
                    f.Path.EndsWith(ext, StringComparison.Ordinal));
                if (!extMatched) continue;
            }

            filtered.Add(f);
        }

        return filtered;
    }

    /// <summary>ファイルごとの追加・削除行数を取得する。</summary>
    public static Dictionary<string, DiffStat> GetDiffStats(
        string startSha, string endSha, List<ChangedFile> files)
    {
        var hasParent = GitRunner.CheckHasParent(startSha);
        var diffFrom = hasParent ? $"{startSha}^" : startSha;

        var output = GitRunner.Run("diff", "--numstat", diffFrom, endSha);
        var fileSet = new HashSet<string>(files.Select(f => f.Path));
        var stats = new Dictionary<string, DiffStat>();

        foreach (var line in output.Trim().Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t', 3);
            if (parts.Length < 3) continue;

            var path = parts[2];
            if (!fileSet.Contains(path)) continue;

            // バイナリファイルは "-" で表示される
            var added = parts[0] == "-" ? 0 : int.Parse(parts[0]);
            var deleted = parts[1] == "-" ? 0 : int.Parse(parts[1]);
            stats[path] = new DiffStat(path, added, deleted);
        }

        return stats;
    }

    /// <summary>出力ディレクトリを初期化する。ツールが生成するファイルのみ削除する。</summary>
    public static void PrepareOutputDir(string outputDir)
    {
        Directory.CreateDirectory(outputDir);

        var diffDir = Path.Combine(outputDir, "diff");
        var diffZipPath = Path.Combine(outputDir, "diff.zip");
        var reportPath = Path.Combine(outputDir, "report.md");

        if (Directory.Exists(diffDir))
        {
            Directory.Delete(diffDir, recursive: true);
        }

        if (File.Exists(diffZipPath))
        {
            File.Delete(diffZipPath);
        }

        if (File.Exists(reportPath))
        {
            File.Delete(reportPath);
        }
    }

    /// <summary>before/afterのファイルを出力ディレクトリに保存する。</summary>
    public static void ExtractFileVersions(
        List<ChangedFile> files, string startSha, string endSha, string outputDir)
    {
        var beforeDir = Path.Combine(outputDir, "diff", "before");
        var afterDir = Path.Combine(outputDir, "diff", "after");

        var hasParent = GitRunner.CheckHasParent(startSha);
        var beforeRef = hasParent ? $"{startSha}^" : startSha;

        foreach (var f in files)
        {
            // before側（削除・変更ファイル）
            if (f.Status is FileChangeStatus.Deleted or FileChangeStatus.Modified)
            {
                var content = GitRunner.TryRunBytes("show", $"{beforeRef}:{f.Path}");
                if (content is not null)
                {
                    var beforePath = Path.Combine(beforeDir, f.Path);
                    Directory.CreateDirectory(Path.GetDirectoryName(beforePath)!);
                    File.WriteAllBytes(beforePath, content);
                }
                else
                {
                    Console.Error.WriteLine($"WARNING: Failed to get before version: {f.Path}");
                }
            }

            // after側（追加・変更ファイル）
            if (f.Status is FileChangeStatus.Added or FileChangeStatus.Modified)
            {
                var content = GitRunner.TryRunBytes("show", $"{endSha}:{f.Path}");
                if (content is not null)
                {
                    var afterPath = Path.Combine(afterDir, f.Path);
                    Directory.CreateDirectory(Path.GetDirectoryName(afterPath)!);
                    File.WriteAllBytes(afterPath, content);
                }
                else
                {
                    Console.Error.WriteLine($"WARNING: Failed to get after version: {f.Path}");
                }
            }
        }
    }

    /// <summary>unified diff ファイルを生成する。</summary>
    public static void GenerateDiffs(List<ChangedFile> files, string outputDir)
    {
        var diffDir = Path.Combine(outputDir, "diff");
        var beforeDir = Path.Combine(diffDir, "before");
        var afterDir = Path.Combine(diffDir, "after");

        foreach (var f in files)
        {
            var beforePath = Path.Combine(beforeDir, f.Path);
            var afterPath = Path.Combine(afterDir, f.Path);

            var beforeLines = File.Exists(beforePath)
                ? ReadTextOrBinaryPlaceholder(beforePath)
                : Array.Empty<string>();
            var afterLines = File.Exists(afterPath)
                ? ReadTextOrBinaryPlaceholder(afterPath)
                : Array.Empty<string>();

            var diffText = UnifiedDiff.Generate(
                beforeLines, afterLines,
                $"a/{f.Path}", $"b/{f.Path}");

            if (!string.IsNullOrEmpty(diffText))
            {
                var diffPath = Path.Combine(diffDir, f.Path + ".diff");
                Directory.CreateDirectory(Path.GetDirectoryName(diffPath)!);
                File.WriteAllText(diffPath, diffText, Encoding.UTF8);
            }
        }
    }

    /// <summary>テキストファイルを行配列で返す。バイナリならプレースホルダを返す。</summary>
    private static string[] ReadTextOrBinaryPlaceholder(string path)
    {
        try
        {
            var bytes = File.ReadAllBytes(path);
            // NULLバイトを含む場合はバイナリとみなす
            if (Array.IndexOf(bytes, (byte)0) >= 0)
            {
                return ["(Binary file)"];
            }

            return Encoding.UTF8.GetString(bytes).Split('\n');
        }
        catch
        {
            return ["(Binary file)"];
        }
    }

    /// <summary>diffディレクトリをzip化し、展開ディレクトリを削除する。</summary>
    public static void ArchiveDiffDir(string outputDir)
    {
        var diffDir = Path.Combine(outputDir, "diff");
        if (!Directory.Exists(diffDir))
        {
            Console.Error.WriteLine($"WARNING: Diff directory does not exist: {diffDir}");
            return;
        }

        var diffZipPath = Path.Combine(outputDir, "diff.zip");
        using (var archive = ZipFile.Open(diffZipPath, ZipArchiveMode.Create))
        {
            foreach (var filePath in Directory.EnumerateFiles(diffDir, "*", SearchOption.AllDirectories))
            {
                var relativePath = Path.GetRelativePath(outputDir, filePath)
                    .Replace(Path.DirectorySeparatorChar, '/');
                archive.CreateEntryFromFile(filePath, relativePath, CompressionLevel.Optimal);
            }
        }

        Directory.Delete(diffDir, recursive: true);
    }
}
