# コードパターン

## C# / Avalonia

- Namespace はフォルダ構造に対応させる。
- Model は `Models/`、UI状態は `ViewModels/`、処理は `Services/` に置く。
- ViewModel は `CommunityToolkit.Mvvm` の `ObservableObject` / command を使う。
- ファイルツリーやMarkdown変換などの処理は Service に分離し、ViewModelから呼び出す。
- XAMLコードビハインドはView初期化とフレームワーク連携に限定する。

## TypeScript / React

- UI state は `App.tsx` のReact stateで管理する。
- Markdown rendering、Mermaid描画、リンク処理、パス解決は関数として分ける。
- Tauri command 呼び出しは `invoke<T>()` の型引数で戻り値を明示する。
- Rendererが生成するHTMLは `html: false` を前提とし、Markdown内HTMLを許可しない。

## Rust / Tauri

- フロントエンドから直接ファイルシステムを読まず、Rust command に寄せる。
- `scan_directory` はExplorer用ツリー構築、`read_text_file` はMarkdown本文読み込みに責務を限定する。
- 返却モデルは `serde::Serialize` を使い、TypeScript側の型と対応させる。
- 除外ディレクトリや拡張子判定はRust側の小さな関数へ分離する。

## エラーハンドリングパターン

- AvaloniaはViewModelでエラー表示状態を持つ。
- TauriはRust commandで `Result<T, String>` を返し、React側でエラーバナー表示する。
- パス解決、ファイル読み込み、Markdown/Mermaid描画の失敗は握りつぶさない。

## テストパターン

現時点で自動テストは未整備。変更時はビルド確認と手動UI確認を必須とする。

将来的には以下を追加する。

- C#: `FileTreeService` / `MarkdownRenderService` のユニットテスト
- Rust: パス検証とファイルツリー構築のユニットテスト
- Frontend: Markdown renderer とリンク処理のユニットテスト
