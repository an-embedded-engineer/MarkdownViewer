using System.Text;
using System.Text.RegularExpressions;

namespace ExtractGitDiff;

/// <summary>レポートおよび分析データを生成するサービス。</summary>
public static partial class ReportGenerator
{
    /// <summary>
    /// コミットメッセージから課題IDを抽出するパターン。
    /// 例: m1, m2, H-1, H-2, C-2026-003, S-DA-006, S-SCENARIO-001, GUI-DA-003, GUI-IMP-001, #123
    /// </summary>
    [GeneratedRegex(
        @"(?:(?:[A-Z]+-)?[A-Z]+-\d+(?:-\d+)?)|(?:m\d+)|(?:#\d+)",
        RegexOptions.IgnoreCase)]
    private static partial Regex IssueIdPattern();

    /// <summary>コミット種別プレフィックスパターン。</summary>
    [GeneratedRegex(
        @"^(feat|fix|refactor|docs|style|test|chore|perf|ci|build|revert)(?:\(.+?\))?:",
        RegexOptions.IgnoreCase)]
    private static partial Regex CommitTypePattern();

    /// <summary>コミットメッセージから課題IDを抽出し、ID→コミットリストのマップを返す。</summary>
    public static Dictionary<string, List<CommitInfo>> ExtractIssueIds(List<CommitInfo> commits)
    {
        var issueMap = new Dictionary<string, List<CommitInfo>>();

        foreach (var commit in commits)
        {
            var matches = IssueIdPattern().Matches(commit.Message);
            foreach (Match match in matches)
            {
                var issueId = match.Value;
                if (!issueMap.TryGetValue(issueId, out var list))
                {
                    list = [];
                    issueMap[issueId] = list;
                }

                list.Add(commit);
            }
        }

        return issueMap;
    }

    /// <summary>コミットメッセージのプレフィックスで種別を分類する。</summary>
    public static Dictionary<string, int> ClassifyCommitTypes(List<CommitInfo> commits)
    {
        var typeCounts = new Dictionary<string, int>();

        foreach (var commit in commits)
        {
            var match = CommitTypePattern().Match(commit.Message);
            var commitType = match.Success ? match.Groups[1].Value.ToLowerInvariant() : "other";

            typeCounts[commitType] = typeCounts.GetValueOrDefault(commitType) + 1;
        }

        return typeCounts;
    }

    /// <summary>ディレクトリ単位でA/M/Dファイル数を集計する。</summary>
    public static Dictionary<string, Dictionary<string, int>> AggregateByDirectory(
        List<ChangedFile> files, int depth = 2)
    {
        var dirStats = new Dictionary<string, Dictionary<string, int>>();

        foreach (var f in files)
        {
            var parts = f.Path.Split('/');
            var dirKey = parts.Length > depth
                ? string.Join("/", parts.Take(depth))
                : parts.Length > 1
                    ? string.Join("/", parts.Take(parts.Length - 1))
                    : ".";

            if (!dirStats.TryGetValue(dirKey, out var counts))
            {
                counts = new Dictionary<string, int>
                {
                    ["A"] = 0, ["M"] = 0, ["D"] = 0, ["total"] = 0,
                };
                dirStats[dirKey] = counts;
            }

            var statusChar = f.Status switch
            {
                FileChangeStatus.Added => "A",
                FileChangeStatus.Modified => "M",
                FileChangeStatus.Deleted => "D",
                _ => "?",
            };

            counts[statusChar]++;
            counts["total"]++;
        }

        return dirStats;
    }

    /// <summary>report.mdを生成する。</summary>
    public static void GenerateReport(
        List<CommitInfo> commits,
        List<ChangedFile> files,
        string startSha,
        string endSha,
        string outputDir,
        Dictionary<string, DiffStat> diffStats)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Git Diff Report");
        sb.AppendLine();
        sb.AppendLine("## Artifacts");
        sb.AppendLine();
        sb.AppendLine("- Unified diff archive: [diff.zip](diff.zip)");
        sb.AppendLine("- `diff.zip` を同じディレクトリで展開すると、以下の `diff/...` リンクを参照できる");
        sb.AppendLine();

        // 範囲情報
        sb.AppendLine("## Range");
        sb.AppendLine();
        sb.AppendLine($"- From: `{startSha[..8]}`");
        sb.AppendLine($"- To: `{endSha[..8]}`");
        sb.AppendLine();

        // サマリー統計
        var totalAdded = diffStats.Values.Sum(s => s.Added);
        var totalDeleted = diffStats.Values.Sum(s => s.Deleted);
        var addedFiles = files.Count(f => f.Status == FileChangeStatus.Added);
        var modifiedFiles = files.Count(f => f.Status == FileChangeStatus.Modified);
        var deletedFiles = files.Count(f => f.Status == FileChangeStatus.Deleted);

        sb.AppendLine("## Summary");
        sb.AppendLine();
        sb.AppendLine($"- Commits: **{commits.Count}**");
        sb.AppendLine(
            $"- Files changed: **{files.Count}** " +
            $"(Added: {addedFiles}, Modified: {modifiedFiles}, Deleted: {deletedFiles})");
        sb.AppendLine($"- Lines: **+{totalAdded}** / **-{totalDeleted}**");
        sb.AppendLine();

        // コミット種別分布
        var typeCounts = ClassifyCommitTypes(commits);
        sb.AppendLine("## Commit Types");
        sb.AppendLine();
        sb.AppendLine("| Type | Count |");
        sb.AppendLine("|------|-------|");
        foreach (var (ctype, count) in typeCounts.OrderByDescending(kv => kv.Value))
        {
            sb.AppendLine($"| {ctype} | {count} |");
        }

        sb.AppendLine();

        // 課題ID別コミット
        var issueMap = ExtractIssueIds(commits);
        if (issueMap.Count > 0)
        {
            sb.AppendLine("## Issue / Ticket References");
            sb.AppendLine();
            sb.AppendLine("| Issue ID | Commits | Messages (first) |");
            sb.AppendLine("|----------|---------|-------------------|");
            foreach (var (issueId, issueCommits) in issueMap.OrderBy(kv => kv.Key))
            {
                var firstMsg = issueCommits[0].Message.Length > 80
                    ? issueCommits[0].Message[..80]
                    : issueCommits[0].Message;
                sb.AppendLine($"| {issueId} | {issueCommits.Count} | {firstMsg} |");
            }

            sb.AppendLine();
        }

        // ディレクトリ別変更集計
        var dirAgg = AggregateByDirectory(files);
        sb.AppendLine("## Changes by Directory");
        sb.AppendLine();
        sb.AppendLine("| Directory | Added | Modified | Deleted | Total |");
        sb.AppendLine("|-----------|-------|----------|---------|-------|");
        foreach (var (dirPath, counts) in dirAgg.OrderByDescending(kv => kv.Value["total"]))
        {
            sb.AppendLine(
                $"| `{dirPath}` | {counts["A"]} | {counts["M"]} | {counts["D"]} " +
                $"| {counts["total"]} |");
        }

        sb.AppendLine();

        // コミット一覧
        sb.AppendLine($"## Commits ({commits.Count})");
        sb.AppendLine();
        sb.AppendLine("| # | Issue ID | Commit | Message |");
        sb.AppendLine("|---|----------|--------|--------|");
        var prevIdsStr = "";
        for (var i = 0; i < commits.Count; i++)
        {
            var commit = commits[i];
            var ids = IssueIdPattern().Matches(commit.Message)
                .Select(m => m.Value)
                .ToList();
            var idsStr = ids.Count > 0 ? string.Join(", ", ids) : "";
            var displayIds = idsStr != prevIdsStr ? idsStr : "";
            prevIdsStr = idsStr;
            sb.AppendLine($"| {i + 1} | {displayIds} | `{commit.CommitId[..8]}` | {commit.Message} |");
        }

        sb.AppendLine();

        // 変更ファイル一覧（ツリー形式）
        sb.AppendLine($"## Changed Files ({files.Count})");
        sb.AppendLine();
        RenderFileTree(sb, files, diffStats);
        sb.AppendLine();

        var reportPath = Path.Combine(outputDir, "report.md");
        File.WriteAllText(reportPath, sb.ToString(), Encoding.UTF8);
    }

    /// <summary>ファイル一覧をマークダウンのネストリスト形式で描画する。</summary>
    private static void RenderFileTree(
        StringBuilder sb,
        List<ChangedFile> files,
        Dictionary<string, DiffStat> diffStats)
    {
        var sortedFiles = files.OrderBy(f => f.Path).ToList();

        // ディレクトリ→子要素のツリー構造を構築
        var tree = new SortedDictionary<string, object?>();
        var fileInfo = new Dictionary<string, ChangedFile>();

        foreach (var f in sortedFiles)
        {
            var parts = f.Path.Split('/');
            var node = tree;

            for (var i = 0; i < parts.Length - 1; i++)
            {
                if (!node.TryGetValue(parts[i], out var child) || child is not SortedDictionary<string, object?> childDict)
                {
                    childDict = new SortedDictionary<string, object?>();
                    node[parts[i]] = childDict;
                }

                node = childDict;
            }

            node[parts[^1]] = null; // リーフ（ファイル）
            fileInfo[f.Path] = f;
        }

        RenderNode(sb, tree, 0, [], fileInfo, diffStats);
    }

    /// <summary>ツリーノードを再帰的に描画する。</summary>
    private static void RenderNode(
        StringBuilder sb,
        SortedDictionary<string, object?> node,
        int depth,
        List<string> pathParts,
        Dictionary<string, ChangedFile> fileInfo,
        Dictionary<string, DiffStat> diffStats)
    {
        var indent = new string(' ', depth * 2);

        foreach (var (name, child) in node)
        {
            if (child is null)
            {
                // ファイル（リーフ）
                var fullPath = string.Join("/", pathParts.Append(name));
                var statusChar = fileInfo.TryGetValue(fullPath, out var fInfo)
                    ? fInfo.Status switch
                    {
                        FileChangeStatus.Added => "A",
                        FileChangeStatus.Modified => "M",
                        FileChangeStatus.Deleted => "D",
                        _ => "?",
                    }
                    : "?";

                var statStr = diffStats.TryGetValue(fullPath, out var stat)
                    ? $" (+{stat.Added}, -{stat.Deleted})"
                    : "";

                var diffLink = $"diff/{fullPath}.diff";
                sb.AppendLine($"{indent}- [{name}]({diffLink}) `[{statusChar}]`{statStr}");
            }
            else if (child is SortedDictionary<string, object?> childDict)
            {
                // ディレクトリ
                sb.AppendLine($"{indent}- **{name}/**");
                var newParts = new List<string>(pathParts) { name };
                RenderNode(sb, childDict, depth + 1, newParts, fileInfo, diffStats);
            }
        }
    }
}
