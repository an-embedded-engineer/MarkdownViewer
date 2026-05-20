namespace ExtractGitDiff;

/// <summary>ファイル変更種別。</summary>
public enum FileChangeStatus
{
    /// <summary>追加。</summary>
    Added,

    /// <summary>変更。</summary>
    Modified,

    /// <summary>削除。</summary>
    Deleted,
}

/// <summary>変更対象ファイルの情報。</summary>
public sealed record ChangedFile(string Path, FileChangeStatus Status);

/// <summary>コミットのID・メッセージ。</summary>
public sealed record CommitInfo(string CommitId, string Message);

/// <summary>ファイルごとの差分行数統計。</summary>
public sealed record DiffStat(string Path, int Added, int Deleted);

/// <summary>範囲指定の共通インターフェース。</summary>
public interface IRangeSpec;

/// <summary>日付範囲指定。</summary>
public sealed record DateRange(string DateFrom, string DateTo) : IRangeSpec;

/// <summary>コミットID範囲指定。</summary>
public sealed record CommitRange(string CommitFrom, string CommitTo) : IRangeSpec;

/// <summary>CLI引数から生成される抽出設定。</summary>
public sealed record ExtractConfig(
    IRangeSpec RangeSpec,
    IReadOnlyList<string> Dirs,
    IReadOnlyList<string> Extensions,
    string OutputDir);
