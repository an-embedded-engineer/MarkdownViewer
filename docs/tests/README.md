# テスト

## 概要

現時点では専用の自動テストプロジェクトは未整備である。MVP比較実装では、ビルド・型チェック・手動UI確認を最低限の品質ゲートとして扱う。

## テスト構成

```text
MarkdownViewer/
├── Avalonia/MarkdownViewer.Avalonia/      — Avaloniaアプリ本体
├── markdown-viewer-tauri/                 — Tauriアプリ本体
└── docs/tests/                            — テスト方針
```

将来的な追加候補:

- `Avalonia/MarkdownViewer.Avalonia.Tests/`
- `markdown-viewer-tauri/src/**/*.test.ts`
- `markdown-viewer-tauri/src-tauri/src/*` のRust unit tests

## テストカテゴリ

- Build check: コンパイル、型チェック、Rust check。
- Manual UI check: フォルダ選択、Markdown表示、Mermaid表示、テーマ切替、Reload。
- Publish smoke check: `publish/` 配下の `.app` 起動確認。

## 実行方法

- 開発・実行ルール: `docs/rules/development_workflow.md`
- テスト方針: `docs/tests/strategy.md`
