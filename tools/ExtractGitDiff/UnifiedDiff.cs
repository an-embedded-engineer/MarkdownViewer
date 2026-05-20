using System.Text;

namespace ExtractGitDiff;

/// <summary>unified diff形式のテキストを生成するユーティリティ。</summary>
public static class UnifiedDiff
{
    /// <summary>2つのテキスト行配列からunified diff形式のテキストを生成する。</summary>
    public static string Generate(
        string[] oldLines, string[] newLines,
        string oldLabel, string newLabel,
        int contextLines = 3)
    {
        var opcodes = GetOpcodes(oldLines, newLines);
        var hunks = GroupIntoHunks(opcodes, oldLines.Length, newLines.Length, contextLines);

        if (hunks.Count == 0)
        {
            return string.Empty;
        }

        var sb = new StringBuilder();
        sb.AppendLine($"--- {oldLabel}");
        sb.AppendLine($"+++ {newLabel}");

        foreach (var hunk in hunks)
        {
            sb.AppendLine(
                $"@@ -{hunk.OldStart + 1},{hunk.OldCount} +{hunk.NewStart + 1},{hunk.NewCount} @@");

            foreach (var op in hunk.Operations)
            {
                switch (op.Tag)
                {
                    case DiffTag.Equal:
                        for (var i = op.OldStart; i < op.OldEnd; i++)
                        {
                            sb.AppendLine($" {oldLines[i]}");
                        }

                        break;
                    case DiffTag.Delete:
                        for (var i = op.OldStart; i < op.OldEnd; i++)
                        {
                            sb.AppendLine($"-{oldLines[i]}");
                        }

                        break;
                    case DiffTag.Insert:
                        for (var i = op.NewStart; i < op.NewEnd; i++)
                        {
                            sb.AppendLine($"+{newLines[i]}");
                        }

                        break;
                    case DiffTag.Replace:
                        for (var i = op.OldStart; i < op.OldEnd; i++)
                        {
                            sb.AppendLine($"-{oldLines[i]}");
                        }

                        for (var i = op.NewStart; i < op.NewEnd; i++)
                        {
                            sb.AppendLine($"+{newLines[i]}");
                        }

                        break;
                }
            }
        }

        return sb.ToString();
    }

    /// <summary>最長共通部分列（LCS）ベースのオペコードを生成する。</summary>
    private static List<DiffOperation> GetOpcodes(string[] oldLines, string[] newLines)
    {
        // Myers' diff に近い簡易実装（LCS テーブル方式）
        var oldLen = oldLines.Length;
        var newLen = newLines.Length;

        // LCS長テーブル構築
        var dp = new int[oldLen + 1, newLen + 1];
        for (var i = oldLen - 1; i >= 0; i--)
        {
            for (var j = newLen - 1; j >= 0; j--)
            {
                dp[i, j] = oldLines[i] == newLines[j]
                    ? dp[i + 1, j + 1] + 1
                    : Math.Max(dp[i + 1, j], dp[i, j + 1]);
            }
        }

        // バックトラックでオペコード生成
        var ops = new List<DiffOperation>();
        var oi = 0;
        var ni = 0;

        while (oi < oldLen || ni < newLen)
        {
            if (oi < oldLen && ni < newLen && oldLines[oi] == newLines[ni])
            {
                // Equal: 連続する一致行をまとめる
                var startOi = oi;
                var startNi = ni;
                while (oi < oldLen && ni < newLen && oldLines[oi] == newLines[ni])
                {
                    oi++;
                    ni++;
                }

                ops.Add(new DiffOperation(DiffTag.Equal, startOi, oi, startNi, ni));
            }
            else if (ni < newLen && (oi >= oldLen || dp[oi, ni + 1] >= dp[oi + 1, ni]))
            {
                // Insert
                ops.Add(new DiffOperation(DiffTag.Insert, oi, oi, ni, ni + 1));
                ni++;
            }
            else if (oi < oldLen)
            {
                // Delete
                ops.Add(new DiffOperation(DiffTag.Delete, oi, oi + 1, ni, ni));
                oi++;
            }
        }

        // 隣接するInsert/Deleteをマージしてコンパクトにする
        return MergeAdjacentOps(ops);
    }

    /// <summary>隣接する同種オペレーションをマージする。</summary>
    private static List<DiffOperation> MergeAdjacentOps(List<DiffOperation> ops)
    {
        if (ops.Count == 0) return ops;

        var merged = new List<DiffOperation> { ops[0] };

        for (var i = 1; i < ops.Count; i++)
        {
            var prev = merged[^1];
            var curr = ops[i];

            // 同じタグで隣接している場合はマージ
            if (prev.Tag == curr.Tag && prev.OldEnd == curr.OldStart && prev.NewEnd == curr.NewStart)
            {
                merged[^1] = new DiffOperation(
                    prev.Tag, prev.OldStart, curr.OldEnd, prev.NewStart, curr.NewEnd);
            }
            // Delete + Insert の連続は Replace にまとめる
            else if (prev.Tag == DiffTag.Delete && curr.Tag == DiffTag.Insert
                     && prev.OldEnd == curr.OldStart && prev.NewEnd == curr.NewStart)
            {
                merged[^1] = new DiffOperation(
                    DiffTag.Replace, prev.OldStart, prev.OldEnd, curr.NewStart, curr.NewEnd);
            }
            else if (prev.Tag == DiffTag.Replace && curr.Tag == DiffTag.Insert
                     && prev.OldEnd == curr.OldStart && prev.NewEnd == curr.NewStart)
            {
                merged[^1] = new DiffOperation(
                    DiffTag.Replace, prev.OldStart, prev.OldEnd, prev.NewStart, curr.NewEnd);
            }
            else
            {
                merged.Add(curr);
            }
        }

        return merged;
    }

    /// <summary>オペコードをコンテキスト行数でハンクにグループ化する。</summary>
    private static List<DiffHunk> GroupIntoHunks(
        List<DiffOperation> ops, int oldLen, int newLen, int contextLines)
    {
        // 変更があるかチェック
        if (ops.All(op => op.Tag == DiffTag.Equal))
        {
            return [];
        }

        var hunks = new List<DiffHunk>();
        var currentOps = new List<DiffOperation>();
        var hunkOldStart = 0;
        var hunkNewStart = 0;

        for (var idx = 0; idx < ops.Count; idx++)
        {
            var op = ops[idx];

            if (op.Tag == DiffTag.Equal)
            {
                var eqLen = op.OldEnd - op.OldStart;

                if (eqLen > contextLines * 2 && currentOps.Count > 0)
                {
                    // 末尾コンテキストを追加してハンクを閉じる
                    var tailEnd = Math.Min(op.OldStart + contextLines, op.OldEnd);
                    if (tailEnd > op.OldStart)
                    {
                        currentOps.Add(new DiffOperation(
                            DiffTag.Equal, op.OldStart, tailEnd,
                            op.NewStart, op.NewStart + (tailEnd - op.OldStart)));
                    }

                    hunks.Add(BuildHunk(currentOps, hunkOldStart, hunkNewStart));
                    currentOps = [];

                    // 次のハンクの先頭コンテキスト
                    var headStart = Math.Max(op.OldEnd - contextLines, tailEnd);
                    if (headStart < op.OldEnd)
                    {
                        hunkOldStart = headStart;
                        hunkNewStart = op.NewEnd - (op.OldEnd - headStart);
                        currentOps.Add(new DiffOperation(
                            DiffTag.Equal, headStart, op.OldEnd,
                            hunkNewStart, op.NewEnd));
                    }
                }
                else
                {
                    // Equal行が短い場合はそのまま含める
                    if (currentOps.Count == 0)
                    {
                        // ハンクの先頭コンテキスト
                        var start = Math.Max(op.OldStart, op.OldEnd - contextLines);
                        if (start < op.OldEnd)
                        {
                            hunkOldStart = start;
                            hunkNewStart = op.NewStart + (start - op.OldStart);
                            currentOps.Add(new DiffOperation(
                                DiffTag.Equal, start, op.OldEnd,
                                hunkNewStart, op.NewEnd));
                        }
                    }
                    else
                    {
                        currentOps.Add(op);
                    }
                }
            }
            else
            {
                if (currentOps.Count == 0)
                {
                    hunkOldStart = op.OldStart;
                    hunkNewStart = op.NewStart;
                }

                currentOps.Add(op);
            }
        }

        // 最後のハンクを閉じる
        if (currentOps.Any(op => op.Tag != DiffTag.Equal))
        {
            hunks.Add(BuildHunk(currentOps, hunkOldStart, hunkNewStart));
        }

        return hunks;
    }

    /// <summary>オペレーションリストからハンクを構築する。</summary>
    private static DiffHunk BuildHunk(
        List<DiffOperation> ops, int oldStart, int newStart)
    {
        var oldCount = ops.Sum(op => op.Tag is DiffTag.Equal or DiffTag.Delete or DiffTag.Replace
            ? op.OldEnd - op.OldStart
            : 0);
        var newCount = ops.Sum(op => op.Tag is DiffTag.Equal or DiffTag.Insert or DiffTag.Replace
            ? op.NewEnd - op.NewStart
            : 0);

        return new DiffHunk(oldStart, oldCount, newStart, newCount, ops);
    }

    private enum DiffTag { Equal, Delete, Insert, Replace }

    private sealed record DiffOperation(
        DiffTag Tag, int OldStart, int OldEnd, int NewStart, int NewEnd);

    private sealed record DiffHunk(
        int OldStart, int OldCount, int NewStart, int NewCount,
        List<DiffOperation> Operations);
}
