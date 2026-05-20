using System.Diagnostics;

namespace ExtractGitDiff;

/// <summary>gitコマンド実行時の例外。</summary>
public sealed class GitCommandException : Exception
{
    /// <summary>標準エラー出力の内容。</summary>
    public string StdErr { get; }

    /// <summary>終了コード。</summary>
    public int ExitCode { get; }

    public GitCommandException(string message, string stdErr, int exitCode)
        : base(message)
    {
        StdErr = stdErr;
        ExitCode = exitCode;
    }
}

/// <summary>gitコマンドを実行するランナー。</summary>
public static class GitRunner
{
    /// <summary>gitコマンドを実行してテキスト出力を返す。</summary>
    public static string Run(params string[] args)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = "git",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var arg in args)
        {
            process.StartInfo.ArgumentList.Add(arg);
        }

        process.Start();
        var stdout = process.StandardOutput.ReadToEnd();
        var stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();

        if (process.ExitCode != 0)
        {
            throw new GitCommandException(
                $"git {string.Join(' ', args)} failed with exit code {process.ExitCode}",
                stderr,
                process.ExitCode);
        }

        return stdout;
    }

    /// <summary>gitコマンドを実行してバイト列で出力を返す。</summary>
    public static byte[] RunBytes(params string[] args)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = "git",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var arg in args)
        {
            process.StartInfo.ArgumentList.Add(arg);
        }

        process.Start();
        using var ms = new MemoryStream();
        process.StandardOutput.BaseStream.CopyTo(ms);
        var stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();

        if (process.ExitCode != 0)
        {
            throw new GitCommandException(
                $"git {string.Join(' ', args)} failed with exit code {process.ExitCode}",
                stderr,
                process.ExitCode);
        }

        return ms.ToArray();
    }

    /// <summary>gitコマンドを実行し、失敗時はnullを返す（exit code非ゼロ許容）。</summary>
    public static string? TryRun(params string[] args)
    {
        try
        {
            return Run(args);
        }
        catch (GitCommandException)
        {
            return null;
        }
    }

    /// <summary>gitコマンドを実行し、失敗時はnullを返す（バイト列版）。</summary>
    public static byte[]? TryRunBytes(params string[] args)
    {
        try
        {
            return RunBytes(args);
        }
        catch (GitCommandException)
        {
            return null;
        }
    }

    /// <summary>コミットIDの存在を検証し、完全なSHAを返す。</summary>
    public static string ValidateCommit(string commitId)
    {
        return Run("rev-parse", "--verify", commitId).Trim();
    }

    /// <summary>コミットに親があるかを確認する。</summary>
    public static bool CheckHasParent(string commitSha)
    {
        return TryRun("rev-parse", "--verify", $"{commitSha}^") is not null;
    }
}
