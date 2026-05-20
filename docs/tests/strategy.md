# テスト戦略

## テスト原則

- 自動テストが未整備の領域でも、変更対象のビルド・型チェックは必ず実行する。
- UI変更は手動確認項目を明示し、確認結果を作業報告に含める。
- ファイルシステム、Markdown変換、Mermaid描画、リンク遷移は回帰しやすいため優先して確認する。

## テストピラミッド

- Unit tests: 今後追加する。ファイルツリー構築、Markdown変換、パス解決を優先する。
- Integration checks: `dotnet build`、`npm run build`、`cargo check` を現時点の基礎チェックとする。
- Manual E2E: Finder起動、フォルダ選択、Markdown表示、Mermaid表示、Reloadを確認する。

## カバレッジ目標

MVP段階では数値目標を設定しない。正式採用する実装が決まった後、ファイル操作とMarkdown rendering周辺から自動テストを追加する。

## テストデータ管理

- Avalonia版は `Avalonia/MarkdownViewer.Avalonia/sample_docs/` を手動確認用サンプルとして使う。
- Tauri版も同じサンプルまたは `docs/` 配下のMarkdownを使って確認する。
- Mermaid、相対画像、相対Markdownリンクを含むサンプルを維持する。

## モック/フィクスチャ戦略

- C# Serviceテストでは一時ディレクトリを作り、ファイルツリーやMarkdown変換を検証する。
- TypeScript rendererテストではMarkdown文字列を入力し、生成HTMLとリンク処理を検証する。
- Rust commandテストでは一時ディレクトリと `PathBuf` を使い、root外参照を拒否することを確認する。
