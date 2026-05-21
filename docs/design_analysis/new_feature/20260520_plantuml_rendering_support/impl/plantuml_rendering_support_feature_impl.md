# PlantUML 表示対応 実装記録

## 対象

- TODO: `TODO-2026-001 PlantUML Rendering Support`
- Design: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/design/plantuml_rendering_support_feature_design.md`
- Design review: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/review/plantuml_rendering_support_design_review.md`

## 実装差分

### Avalonia

- `PlantUmlRuntimeResolver` を追加し、`plantuml.config.json` または runtime directory の `plantuml.jar` を解決する。
- `PlantUmlRenderService` を追加し、`java -jar <plantuml.jar> -tsvg -pipe` でSVGを生成する。
- `MarkdownRenderService` を `RenderToHtmlFragmentAsync` に一本化し、Mermaid / PlantUML fenceをplaceholder経由で差し替える。
- `MainWindowViewModel` はMarkdown表示時に非同期rendererをawaitし、Theme切替時は直近のbody HTMLを再利用してPlantUML CLIを再実行しない。
- PlantUML描画中は `IsBusy` と `StatusMessage` を更新し、上部バーとプレビュー領域に読み込み中表示を出す。
- `HtmlTemplateService` に `.plantuml-diagram` / `.plantuml-error` の表示スタイルを追加した。

### Tauri

- `render_plantuml_diagrams` commandを追加し、PlantUML source配列をSVG HTMLまたはエラーHTMLへ変換する。
- Rust側でruntime directory探索、`plantuml.config.json` 読み込み、timeout、UTF-8 stdout/stderr処理、SVG sanitizerを実装した。
- Rust側はPlantUML stdout / stderrを別threadで並行drainし、大きなSVGでもpipe bufferでdeadlockしないようにした。
- React側はMarkdown本文から `plantuml` / `puml` fenceを抽出し、`previewRevision` とselected file path単位でPlantUML commandを呼ぶ。
- PlantUML結果の反映でpreview DOMが再生成された場合もMermaidを再描画し、Mermaid / PlantUML同居文書で両図が維持されるようにした。
- Theme切替だけではPlantUML commandを再実行せず、既存結果を使って再描画する。
- PlantUML描画結果待ちの図がある間は、プレビュー上部に描画中バナーを表示する。
- `App.css` に `.plantuml-diagram` / `.plantuml-error` の表示スタイルを追加した。

### Runtime / Samples

- `.gitignore` にローカル `plantuml.jar` / `plantuml.config.json` を追加した。
- 共有確認用にMermaid / PlantUML同居サンプル `sample_docs/plantuml.md` を追加した。

## 恒久ドキュメント反映

- `docs/rules/development_workflow.md`: PlantUML setup、runtime directory、手動確認観点を追加。
- `docs/architecture/overview.md`: PlantUMLのAvalonia / Tauri統合点を追加。
- `docs/architecture/code_patterns.md`: PlantUML renderer / commandの責務分割を追加。
- `docs/architecture/common_pitfalls.md`: PlantUML runtime配置とtheme切替時の注意点を追加。
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/avalonia_viewer/interface_spec.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`

## 設計レビュー指摘への対応

- Medium 1.1: Avaloniaの非同期API契約とservice責務分担に合わせて実装した。
- Medium 1.2: Tauriは `render_plantuml_diagrams` command採用に固定した。
- Medium 1.3: Tauri devとbundleのruntime directoryをRust resolverに反映した。Tauri devでは `markdown-viewer-tauri/src-tauri/`、current working directory、Rust実行ファイルdirectoryの順で探索する。
- Medium 1.4: Theme切替時はPlantUML CLIを再実行しないようAvalonia / Tauri双方で制御した。
- Impl review High 1.1: TauriのMermaid effectをPlantUML描画結果反映後にも再実行し、Mermaid + PlantUML同居時にMermaid SVGが消えないようにした。
- Impl review High 1.2: RustのPlantUML stdout / stderrを子process実行中に並行drainし、大きなSVGでtimeoutまで詰まる問題を解消した。
- Impl review Medium 1.3: fence言語判定はinfo stringの先頭tokenで行う仕様として恒久ドキュメントへ明記した。
- Impl review Medium 2.1: `sample_docs/plantuml.md` にMermaid blockを追加し、同居確認に使えるようにした。
- Impl review Medium 2.3: Tauri runtime directory探索順を実装・設計・component docsで `src-tauri/`、current working directory、Rust実行ファイルdirectoryの順に揃えた。
- Low指摘: `.gitignore`、共有sample、runtime option契約、SVG sanitizer、UTF-8 stdin/stdout/stderr処理、代表エラー表示を実装・文書へ反映した。ADR候補化とversion確認commandはfollow-upとして残す。

## 検証結果

Phase 3レビュー依頼前に以下を実行した。

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj --no-restore`: 成功。
- `npm run build` in `markdown-viewer-tauri/`: 成功。Mermaid由来のchunk size warningは既存課題として継続。
- `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `java -jar plantuml.jar -version`: 成功。PlantUML `1.2026.3`、Java `openjdk 24.0.2`。
- `printf '@startuml\nAlice -> Bob: Hello\n@enduml\n' | java -jar plantuml.jar -tsvg -pipe`: 成功。`/private/tmp/plantuml_smoke.svg` にSVGを生成。

Phase 3実装レビュー指摘対応後に以下を再実行した。

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj --no-restore`: 成功。sandbox内ではAvalonia telemetry log書き込み権限で失敗したため、同一コマンドを権限付きで再実行した。
- `npm run build` in `markdown-viewer-tauri/`: 成功。Mermaid由来のchunk size warningは既存課題として継続。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。
- `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。

Phase 4-aユーザー確認では、publish済みTauri `.app` と publish済みAvalonia `.app` の双方でPlantUML描画を確認済み。追加フィードバックとして「PlantUML描画に時間がかかるため、ファイル選択後に読み込み中表示が必要」と判明したため、以下を追加実装して再検証した。

- Avalonia: Markdown / PlantUML描画中に上部バーの進捗表示とプレビュー領域の読み込み中表示を出す。
- Tauri: PlantUML command結果待ちの間、プレビュー上部に `Rendering PlantUML diagrams...` バナーを出す。
- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj --no-restore`: 成功。sandbox内ではAvalonia telemetry log書き込み権限で失敗したため、同一コマンドを権限付きで再実行した。
- `npm run build` in `markdown-viewer-tauri/`: 成功。Mermaid由来のchunk size warningは既存課題として継続。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。

## 既知制約

- Java runtime と `plantuml.jar` は同梱しない。
- PlantUML dark-mode optionは使わず、SVGをviewerの枠で表示する。
- PlantUML SVGのcacheは未実装。ReloadまたはMarkdown本文更新時は再描画する。
- PlantUML jarはリポジトリ直下のignored runtime fileとして取得し、PlantUML `1.2026.3` の実行可否を確認済み。
