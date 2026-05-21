# PlantUML 表示対応 変更レポート

## 対象

- TODO: `TODO-2026-001 PlantUML Rendering Support`
- Branch: `feature/plantuml-rendering-support`
- Base commit: `6d0c0ecc8fef95561b8b3599dc23979b38434c1c`
- Report commit range: `6d0c0ec..1bf3e04`
- 作成日: 2026-05-21

## 変更概要

Markdown Viewer の Avalonia 版と Tauri 版に、ローカル `plantuml.jar` と Java を使った PlantUML 表示を追加した。

- `plantuml` / `puml` fenced code block を PlantUML SVG としてインライン表示する。
- `plantuml.jar` はコミット対象に含めず、runtime directory または `plantuml.config.json` で参照する。
- PlantUML SVG は `<script>` と `on*` event handler 属性を除去してから表示する。
- Mermaid と PlantUML が同居する Markdown でも両方の図を維持する。
- PlantUML 描画に時間がかかる場合に備え、Avalonia / Tauri 双方に読み込み中表示を追加した。

## Avalonia 変更

- `PlantUmlRuntimeResolver` を追加し、runtime directory の `plantuml.config.json` または `plantuml.jar` を解決する。
- `PlantUmlRenderService` を追加し、`java -jar <plantuml.jar> -tsvg -pipe` で SVG を生成する。
- `MarkdownRenderService` を非同期化し、Mermaid / PlantUML fence を HTML fragment へ差し替える。
- `HtmlTemplateService` に `.plantuml-diagram` / `.plantuml-error` のスタイルを追加した。
- `MainWindowViewModel` と `MainWindow.axaml` に描画中状態を追加し、ヘッダー下部 progress とプレビュー overlay を表示する。
- Theme 切替時は直近の body HTML を再利用し、PlantUML CLI を再実行しない。

## Tauri 変更

- Rust command `render_plantuml_diagrams` を追加し、PlantUML source 配列を SVG HTML または error HTML に変換する。
- Rust 側で runtime directory 探索、config 読み込み、timeout、UTF-8 stdout/stderr 処理、SVG sanitizer を実装した。
- PlantUML stdout / stderr は子 process 実行中に別 thread で drain し、大きな SVG でも pipe buffer で詰まらないようにした。
- `render_plantuml_diagrams` を `spawn_blocking` へ移し、Java process 待機で async runtime を block しないようにした。
- React 側で PlantUML fence を抽出し、結果待ち中は `Rendering PlantUML diagrams...` バナーを表示する。
- Markdown 読み込み中は `Loading Markdown...` バナーを表示する。
- PlantUML 結果反映後も Mermaid を再描画し、Mermaid / PlantUML 同居文書で Mermaid 図が消えないようにした。

## サンプル・ドキュメント

- `sample_docs/plantuml.md` を追加し、Mermaid / PlantUML / puml の同居確認に使えるようにした。
- `docs/rules/development_workflow.md` に Java / `plantuml.jar` setup、runtime directory、手動確認観点を追記した。
- `docs/components/avalonia_viewer/` と `docs/components/tauri_viewer/` に PlantUML の構成、runtime 解決、エラー表示、読み込み中表示を追記した。
- `docs/architecture/overview.md`、`docs/architecture/code_patterns.md`、`docs/architecture/common_pitfalls.md` に PlantUML 統合点と注意点を追記した。

## 検証結果

自動 / コマンド検証:

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`: 成功。
- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj -c Release --no-restore`: 成功。
- `npm run build` in `markdown-viewer-tauri/`: 成功。Mermaid 由来の chunk size warning は既存課題として継続。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。
- `java -jar plantuml.jar -version`: PlantUML `1.2026.3`、Java `openjdk 24.0.2` で成功。

ユーザー確認:

- `publish/tauri/markdown-viewer-tauri.app` で PlantUML が描画されることを確認済み。
- `publish/avalonia/MarkdownViewer.Avalonia.app` で PlantUML が描画されることを確認済み。
- Avalonia / Tauri 双方で、PlantUML 描画中の読み込み中表示が分かりやすくなったことを確認済み。

レビュー:

- Phase 2 設計レビュー: 承認済み。
- Phase 3 実装レビュー: 承認済み。
- Phase 4-a 追加実装レビュー: 承認済み。

## 生成物

- `diff.zip`: `6d0c0ec..1bf3e04` の差分 patch を格納した zip。
- publish 済み `.app` と `plantuml.jar` は動作確認用生成物であり、コミット対象には含めない。

## 既知制約

- Java runtime と `plantuml.jar` は同梱しない。
- PlantUML dark-mode option は使わず、viewer 側の背景と枠で表示を整える。
- PlantUML SVG の永続 cache は未実装。Reload または Markdown 本文更新時は再描画する。
- Low の UX 改善候補は `TODO-2026-002 PlantUML Loading UX Follow-up` として別途追跡する。
