using ExtractGitDiff;

/// <summary>gitコミット履歴から指定範囲の差分を抽出するCLIツール。</summary>
return Run(args);

static int Run(string[] args)
{
    // 引数パース
    string? dateFrom = null, dateTo = null;
    string? commitFrom = null, commitTo = null;
    var dirs = new List<string>();
    var extensions = new List<string>();
    var outputDir = "output/git_diff";

    for (var i = 0; i < args.Length; i++)
    {
        switch (args[i])
        {
            case "--date-from" when i + 1 < args.Length:
                dateFrom = args[++i];
                break;
            case "--date-to" when i + 1 < args.Length:
                dateTo = args[++i];
                break;
            case "--commit-from" when i + 1 < args.Length:
                commitFrom = args[++i];
                break;
            case "--commit-to" when i + 1 < args.Length:
                commitTo = args[++i];
                break;
            case "--dirs" or "-d":
                while (i + 1 < args.Length && !args[i + 1].StartsWith('-'))
                {
                    dirs.Add(args[++i]);
                }

                break;
            case "--extensions" or "-e":
                while (i + 1 < args.Length && !args[i + 1].StartsWith('-'))
                {
                    extensions.Add(args[++i]);
                }

                break;
            case "--output" or "-o" when i + 1 < args.Length:
                outputDir = args[++i];
                break;
            case "--help" or "-h":
                PrintUsage();
                return 0;
            default:
                Console.Error.WriteLine($"ERROR: Unknown argument: {args[i]}");
                PrintUsage();
                return 1;
        }
    }

    // バリデーション
    var hasDate = dateFrom is not null || dateTo is not null;
    var hasCommit = commitFrom is not null || commitTo is not null;

    if (hasDate && hasCommit)
    {
        Console.Error.WriteLine("ERROR: Cannot specify both date range and commit range");
        return 1;
    }

    if (!hasDate && !hasCommit)
    {
        Console.Error.WriteLine(
            "ERROR: Must specify either date range (--date-from/--date-to) " +
            "or commit range (--commit-from/--commit-to)");
        PrintUsage();
        return 1;
    }

    IRangeSpec rangeSpec;
    if (hasDate)
    {
        if (dateFrom is null || dateTo is null)
        {
            Console.Error.WriteLine("ERROR: Both --date-from and --date-to are required");
            return 1;
        }

        rangeSpec = new DateRange(dateFrom, dateTo);
    }
    else
    {
        if (commitFrom is null || commitTo is null)
        {
            Console.Error.WriteLine("ERROR: Both --commit-from and --commit-to are required");
            return 1;
        }

        rangeSpec = new CommitRange(commitFrom, commitTo);
    }

    var config = new ExtractConfig(rangeSpec, dirs, extensions, outputDir);

    try
    {
        // コミット範囲を解決
        var (startSha, endSha) = DiffExtractor.ResolveCommitRange(config);
        Console.WriteLine($"INFO: Commit range: {startSha[..8]}..{endSha[..8]}");

        // コミット一覧取得
        var commits = DiffExtractor.GetCommitList(startSha, endSha);
        Console.WriteLine($"INFO: Found {commits.Count} commits");

        // 変更ファイル取得
        var allFiles = DiffExtractor.GetChangedFiles(startSha, endSha);
        var files = DiffExtractor.FilterFiles(allFiles, config);
        Console.WriteLine($"INFO: Found {allFiles.Count} changed files ({files.Count} after filter)");

        if (files.Count == 0)
        {
            Console.WriteLine("INFO: No files to process");
            return 0;
        }

        // 出力ディレクトリ準備
        DiffExtractor.PrepareOutputDir(config.OutputDir);

        // ファイル抽出
        DiffExtractor.ExtractFileVersions(files, startSha, endSha, config.OutputDir);

        // 差分生成
        DiffExtractor.GenerateDiffs(files, config.OutputDir);

        // 差分行数統計取得
        var diffStats = DiffExtractor.GetDiffStats(startSha, endSha, files);

        // レポート生成
        ReportGenerator.GenerateReport(commits, files, startSha, endSha, config.OutputDir, diffStats);

        // diff成果物を圧縮し、展開ディレクトリは残さない
        DiffExtractor.ArchiveDiffDir(config.OutputDir);

        Console.WriteLine($"INFO: Output written to: {config.OutputDir}");
        return 0;
    }
    catch (GitCommandException e)
    {
        Console.Error.WriteLine($"ERROR: Git command failed: {e.StdErr}");
        return 1;
    }
    catch (Exception e)
    {
        Console.Error.WriteLine($"ERROR: Fatal error: {e.Message}");
        return 1;
    }
}

static void PrintUsage()
{
    Console.WriteLine("""
        Usage: dotnet run --project tools/ExtractGitDiff -- [OPTIONS]

        Extract git diffs for a specified range of commits.

        Date range:
          --date-from DATE    Start date (ISO format, e.g. 2024-01-01)
          --date-to DATE      End date (ISO format, e.g. 2024-02-01)

        Commit range:
          --commit-from ID    Start commit ID (inclusive)
          --commit-to ID      End commit ID (inclusive)

        Options:
          --dirs, -d DIRS         Target directories to filter (e.g. src tests)
          --extensions, -e EXTS   File extensions to filter (e.g. .cs .json)
          --output, -o DIR        Output directory (default: output/git_diff)
          --help, -h              Show this help message

        Examples:
          dotnet run --project tools/ExtractGitDiff -- --date-from 2024-01-01 --date-to 2024-02-01
          dotnet run --project tools/ExtractGitDiff -- --commit-from abc1234 --commit-to def5678
          dotnet run --project tools/ExtractGitDiff -- --date-from 2024-01-01 --date-to 2024-02-01 -d src tests -e .cs
        """);
}
