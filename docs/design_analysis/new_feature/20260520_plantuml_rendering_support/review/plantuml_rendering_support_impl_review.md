# PlantUML 表示対応 実装レビュー

**レビュー日**: 2026-05-21
**再確認日**: 2026-05-21
**初回レビュー対象コミット**: `7c4acc65a0ae9eaafbf16703360f355ddb29d59c`
**再確認対象コミット**: `632019ed4773a249dba3ce7d296d986b738cc337`
**対象設計**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/design/plantuml_rendering_support_feature_design.md`
**対象設計レビュー**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/review/plantuml_rendering_support_design_review.md`
**対象実装記録**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/impl/plantuml_rendering_support_feature_impl.md`
**対象 meta**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-001
**レビュー観点出典**: `ai-review-response-workflow` skill 同梱 `references/procedure/review_checkpoints.md` および `new-feature-workflow` の `phase_3_impl_and_docs_focus.md`
**判定**: **承認 (Approved)**。Phase 4 進行可。残作業は Low 6 件で、Phase 4-a / 4-b の動作確認と completion に紐付けて扱う。

---

## 概要

TODO-2026-001 (PlantUML Rendering Support) の Phase 3 実装レビュー。Phase 2 設計レビューで確定した Medium 4 件 (非同期 API 契約、Tauri command 境界、runtime directory 定義、theme 切替時の挙動) の反映、Low 8 件の反映、`plantuml.jar` の非コミット運用、Avalonia / Tauri 双方の Java process 実行・timeout・SVG sanitizer・エラー表示・恒久ドキュメント反映を、`review_checkpoints.md` および `phase_3_impl_and_docs_focus.md` の観点に従って検証した。

---

## 1. 齟齬・不整合

### 1.1 Tauri: Mermaid 図が PlantUML 描画完了後に消える

**ドキュメント記載**: 受け入れ条件「Existing Mermaid samples still render after the change」(docs/todo/todo.md 34 行)、設計書 75-76 行「Mermaid fence は既存経路で引き続き表示される」、setting design 動作要件「Reload や theme switch 後に古い SVG を残したり、空白のまま失敗を隠したりしない」(design 188 行)。
**実装**: `markdown-viewer-tauri/src/App.tsx` の `MarkdownPreview` は `useMemo` deps `[markdown, plantUmlDiagrams, selectedFilePath]` で HTML を再生成し、`dangerouslySetInnerHTML` で DOM を全て書き換える (App.tsx:434-446)。Mermaid `useEffect` の deps は `[previewRevision, theme]` のみ (App.tsx:231-258)。
**差異**: PlantUML と Mermaid を同一 Markdown に含む場合、以下の順序で Mermaid SVG が消失する。
1. ファイル選択 → `previewRevision++`。
2. Mermaid `useEffect` が `.mermaid` 要素を mermaid.run で SVG 化する。
3. PlantUML `useEffect` が `setPlantUmlRenderState({ key, pending })` を呼び、再 render を発生させる。
4. `MarkdownPreview` の useMemo が `plantUmlDiagrams` 参照変化で再計算され、HTML 全体が markdown-it により再生成される。`<div class="mermaid">{escapedCode}</div>` (mermaid.run 前の形) で `dangerouslySetInnerHTML` が DOM を上書きする。
5. Mermaid `useEffect` の deps は変わらないため、再実行されない。Mermaid 図が raw code テキストの状態のまま残る。
6. PlantUML 完了後の更に再 render でも同じ理由で Mermaid は復帰しない。

これは設計の「Mermaid 既存経路を維持する」要件、および受け入れ条件への regression にあたる。`sample_docs/plantuml.md` には Mermaid を含めていないため、提示済みの手動 / 自動検証では現れない。

**推奨対応**: 以下のいずれかを採用する。
- (a) Mermaid `useEffect` の deps に PlantUML 結果 (例: `plantUmlRenderState.key` または `plantUmlDiagrams`) を追加し、PlantUML 完了後の DOM 書き換え後にも Mermaid 再描画を発火させる。
- (b) PlantUML render 完了を待ってから 1 度だけ最終 HTML を生成・適用するよう、`MarkdownPreview` の render 経路を「Mermaid → PlantUML」の順序付きパイプラインへ揃える。
- (c) Mermaid を `dangerouslySetInnerHTML` 配下に置かず、PlantUML 結果差し替え後に React で Mermaid container を mount し直す。

合わせて、Mermaid と PlantUML の両方を含む Markdown を `sample_docs/` に 1 件追加し、手動確認観点に「Mermaid と PlantUML が同居するファイルで両方が描画される」を明記する。
**severity**: High
**対応**: 対応済み。`markdown-viewer-tauri/src/App.tsx` の Mermaid `useEffect` 依存関係へ `plantUmlDiagrams` を追加し、PlantUML 結果反映で `dangerouslySetInnerHTML` 配下の DOM が再生成された後も `mermaid.run` を再実行するようにした。`sample_docs/plantuml.md` に Mermaid と PlantUML の同居サンプルを追加し、`docs/rules/development_workflow.md` と impl 文書へ同居確認観点を追記した。

### 1.2 Tauri/Rust: 大きな SVG の場合に PlantUML プロセス出力読み出しが deadlock する

**ドキュメント記載**: 設計書「プロセス実行」(design 154-174 行) で 1 図あたり 10 秒 timeout、stdout を読み出し可能性、Avalonia 側は `Process.StandardOutput.ReadToEndAsync` で並行 drain している (`PlantUmlRenderService.cs:79-80`)。
**実装**: `markdown-viewer-tauri/src-tauri/src/lib.rs:257-299` の `render_plantuml_svg` は、stdin 書き込み後に `loop { try_wait(); sleep(20ms); }` でプロセス終了を polling し、終了後にようやく `child.stdout.read_to_end(&mut stdout)` を実行する。
**差異**: Java 子プロセスが SVG を stdout に書き込む際、OS パイプバッファ (macOS で概ね 64KB、Linux で 64KB 程度) を超える出力があると、Java は `write()` で block する。parent は `try_wait()` を polling しているが stdout を drain しないため、Java は exit せず、parent は終了を観測せず、10 秒 timeout まで進まない。

実害:
- 設計ドキュメントなどで頻出する class / activity / sequence 図は数十 KB から 100KB 超 (`@enduml` 内のセル/関係数次第) になる。提示された smoke test (`printf '@startuml\nAlice -> Bob: Hello\n@enduml'`) は 1〜2KB 程度で deadlock しないが、利用想定の図サイズでは恒常的に timeout する。
- Avalonia 側は `ReadToEndAsync` を `WaitForExitAsync` と並行起動しているため、この問題は発生しない。実装 2 系列での挙動が乖離する。

**推奨対応**: 以下のいずれかで stdout / stderr を子プロセス実行中に drain する。
- (a) `std::thread::spawn` で stdout / stderr 読み出し thread を 2 本起こし、`join` で結果を集約する。
- (b) `std::io::copy` を tokio 任せにする (既存依存にあるなら) もしくは `os_pipe` 等で対処する。
- (c) `child.wait_with_output()` のような統合 API を使い、内部で並行 drain する経路へ寄せる。

timeout は別の watchdog thread か `Instant::now() - started` の polling で維持できる。Avalonia の `CancellationTokenSource(RenderTimeout)` 相当を Rust 側でも揃えるとなお揃いやすい。
**severity**: High
**対応**: 対応済み。`markdown-viewer-tauri/src-tauri/src/lib.rs` で stdout / stderr を子プロセス実行中に別 thread で並行 drain する `read_plantuml_pipe` / `join_plantuml_pipe` を追加した。timeout 時は process を kill / wait したうえで reader thread を回収するため、大きな SVG でも pipe buffer 詰まりで `try_wait()` が進まない状態を避ける。

### 1.3 Tauri: Mermaid fence regex の info-string 厳密性が緩んだ

**ドキュメント記載**: 既存仕様の Mermaid fence は ` ```mermaid ` のみが対象だった (`MarkdownRenderService.cs` の旧 regex `^```[ \t]*mermaid[ \t]*\r?\n` および App.tsx の `language === "mermaid"` 判定)。
**実装**: Avalonia の `DiagramFenceRegex` は `^```[ \t]*(?<language>mermaid|plantuml|puml)[^\r\n]*\r?\n` (`MarkdownRenderService.cs:69`) で、`mermaid` の後に任意の info string を許容する。`extractPlantUmlSources` (`App.tsx:540`) も同様。
**差異**: ` ```mermaid foo bar ` のような info string 付き fence が、新たに Mermaid 描画対象として扱われるようになった。一方、Tauri の markdown-it fence rule (`App.tsx:464`) は `info.trim().split(/\s+/)[0]?.toLowerCase()` で先頭トークンだけ比較しており、こちらは挙動が変わらない。Avalonia と Tauri で fence info string 解釈が分岐し、同じ Markdown が片方で Mermaid と認識され片方で plain code block になる可能性がある。
**推奨対応**: 両実装で同じ厳密性を採用する。例えば設計書 (もしくは `docs/architecture/code_patterns.md`) で「fence info string は先頭トークンのみで言語を判定する」と明記し、Avalonia の regex も `(?<language>mermaid|plantuml|puml)[ \t]*\r?\n` に合わせる。
**severity**: Medium
**対応**: 対応済み。既存 Tauri 実装と Avalonia 実装の実態に合わせ、fence info string の先頭 token を小文字化して `mermaid` / `plantuml` / `puml` と照合する仕様を `docs/architecture/code_patterns.md` へ明記した。

### 1.4 Avalonia: PlantUML 描画 source の stdin エンコーディングが未指定

**ドキュメント記載**: 設計書「プロセス実行」(design 164 行) は stdout / stderr の UTF-8 取扱いを明記したが、stdin は明記されていない。
**実装**: `PlantUmlRenderService.cs:59-69` の `ProcessStartInfo` は `StandardOutputEncoding` / `StandardErrorEncoding` を UTF-8 にしているが、`StandardInputEncoding` を設定していない。`process.StandardInput.WriteAsync(source.AsMemory(), ...)` は `StreamWriter` のデフォルト encoding (OS console code page 依存) で書き込む。
**差異**: macOS / Linux の default code page は UTF-8 のため現状環境では問題が出ない。一方、Windows 環境では code page 932 (Shift_JIS) などになり、非 ASCII の PlantUML source (日本語ラベル、エイリアス等) が PlantUML 側で誤ってデコードされる。本プロジェクトは macOS arm64 を主開発環境としているが、Tauri / Avalonia ともにクロスプラットフォーム前提で書かれており、将来 Windows 検証時に不可解な描画崩れの原因になり得る。
**推奨対応**: `ProcessStartInfo.StandardInputEncoding = Encoding.UTF8` を追加する。または `process.StandardInput.BaseStream` に `new StreamWriter(stream, Encoding.UTF8)` で wrap する。1 行追加で完結する。
**severity**: Low
**対応**: 対応済み。`Avalonia/MarkdownViewer.Avalonia/Services/PlantUmlRenderService.cs` に `StandardInputEncoding = Encoding.UTF8` を追加した。

---

## 2. ドキュメント不足

### 2.1 共有確認用サンプルが PlantUML 単独のみ

**不足**: `sample_docs/plantuml.md` は PlantUML 2 fence のみで構成されている。設計レビュー §1.1 の指摘 (本文書 1.1) の再現確認、および acceptance criteria の Mermaid 維持要件の手動確認材料が無い。
**推奨対応**: `sample_docs/` 配下に Mermaid と PlantUML を 1 ファイルに含むサンプルを追加するか、`sample_docs/plantuml.md` に Mermaid block を追加する。`docs/rules/development_workflow.md` の手動確認に「Mermaid と PlantUML を同居させた Markdown で両方が描画される」を追加する。
**severity**: Medium
**対応**: 対応済み。`sample_docs/plantuml.md` に Mermaid block を追加し、PlantUML sequence / puml class diagram と同一 Markdown 内で確認できるようにした。`docs/rules/development_workflow.md` の手動確認にも「Mermaid と PlantUML が同居する `sample_docs/plantuml.md` で両方の図が描画されること」を追記した。

### 2.2 PlantUML 描画失敗時の StatusMessage 表示が impl 文書に明示されていない

**不足**: Avalonia の `MainWindowViewModel.OpenMarkdownAsync` は `RenderToHtmlFragmentAsync` を await し、その中で PlantUML 失敗は inline error に置き換わるだけで StatusMessage には反映されない。設計書「エラー動作」(design 184-186 行) は「banner / status には最初の代表エラー 1 件のみを表示し、詳細は inline error を正とする」としているが、Avalonia 実装は banner 表示を一切行わず、Tauri 実装のみ `firstError` を `setErrorMessage` で銀盤に表示する。Avalonia / Tauri の挙動差が impl 文書 (`plantuml_rendering_support_feature_impl.md`) や `docs/components/avalonia_viewer/detail_design.md` に書かれていない。
**推奨対応**: 設計を Avalonia の挙動に合わせる (status へは出さない) ことを意図しているならば impl 文書と Avalonia detail_design に明記する。設計通り「最初の代表エラーは status / banner にも出す」のが正なら Avalonia でも `_currentBodyHtml` を保持しつつ `StatusMessage = firstError;` を設定する変更を入れる。挙動差そのものは Low だが、文書整合性を担保するうえで Phase 3 で扱う対象になる。
**severity**: Low
**対応**: 未対応。低優先度として Phase 4 に持ち越す。Avalonia は現状 inline error を正とし、Tauri は代表エラーを banner にも出す実装差があるため、Phase 4 の動作確認結果に合わせて設計または実装を揃える。

### 2.3 Tauri runtime directory 探索順の挙動が detail_design と Rust 実装で僅かにズレる

**不足**: `docs/components/tauri_viewer/detail_design.md:24` は「Tauri dev では `markdown-viewer-tauri/src-tauri/` をruntime directory として先に探索し、次にRust実行ファイルのdirectoryを見る」と書く。実装 `plantuml_runtime_directories` (`lib.rs:355-387`) は次の順序で挿入する。
1. `current_dir()` (シェル呼び出し元の CWD)
2. `CARGO_MANIFEST_DIR` (`debug_assertions` 時のみ。これが `markdown-viewer-tauri/src-tauri/`)
3. `current_exe` 親

つまり、cwd → src-tauri/ → exe parent の順で先頭は cwd である。設計書「Runtime 設定」(design 101-102 行) では「Tauri 開発実行: `markdown-viewer-tauri/src-tauri/` を明示的な runtime directory として先に探索し、その後に Rust 実行ファイルの directory を探索する」と書かれており、cwd 優先は明示されていない。
**推奨対応**: 実装通り cwd を最優先する設計を意図しているなら `docs/components/tauri_viewer/detail_design.md` と設計書「Runtime 設定」を「cwd → src-tauri/ → exe parent」の順序へ揃える。設計書通り src-tauri/ を最優先するなら実装の挿入順を入れ替える。recommended は実装側を `markdown-viewer-tauri/src-tauri/` 優先に揃えること (Finder 起動時に cwd が `/` になっても src-tauri/ で解決できる前提を保つため)。
**severity**: Medium
**対応**: 対応済み。実装・設計・component docs を `markdown-viewer-tauri/src-tauri/`、current working directory、Rust 実行ファイル directory の順に揃えた。macOS bundle では従来通り `<app>.app/Contents/MacOS/` のみを runtime directory とし、Finder 起動時の working directory に依存しない。

### 2.4 PlantUML jar / config ファイルの runtime 解決例外条件が impl 文書に未記載

**不足**: 設計書「互換性・移行方針」(design 219 行) は「jar 未検出、config 不正、Java 起動不可を区別できる error を返す」と書いているが、Java 起動不可エラーが C# 側で `Win32Exception` を契機にユーザ向け文字列へ変換される箇所、Rust 側で `Failed to start Java: <error>` 文字列に化ける箇所が、`impl/` 文書、`docs/components/<viewer>/detail_design.md` のいずれにも具体例として残っていない。Phase 4 動作確認時 / 将来の改修時に Java 不在シナリオの再現手順が分かりづらい。
**推奨対応**: `plantuml_rendering_support_feature_impl.md` または `docs/rules/development_workflow.md` に「Java 未導入 / jar 未配置 / config 不正 / 構文エラー / timeout」の 5 シナリオの期待表示文言を 1 行ずつ書く。
**severity**: Low
**対応**: 未対応

---

## 3. 改善提案

### 3.1 Rust `PlantUmlRuntimeOptions._config_path` が未使用

**推奨対応**: `lib.rs:42` の `_config_path` は Avalonia の `PlantUmlRuntimeOptions.ConfigPath` 相当を一応保持しているが、書き込み専用で読み出されない。今すぐ消すか、将来 trace 用に残すかを決め、コメントで意図を残す。Avalonia 側の `PlantUmlRuntimeOptions.ConfigPath` も同様にデバッグ表示等で使われていないため、整合させる方が責務分離の見通しが良くなる。
**severity**: Low
**対応**: 未対応

### 3.2 jar 解決が描画ごとに走る

**推奨対応**: `MarkdownRenderService` が PlantUML fence を N 個処理する都度、`PlantUmlRenderService.RenderToHtmlAsync` 内で `PlantUmlRuntimeResolver.Resolve()` を実行する (Avalonia)。Rust 側も `render_plantuml_diagram` ごとに `resolve_plantuml_runtime` を呼ぶ。10 図構成でも runtime 解決のコストは小さいが、`plantuml.config.json` を毎回 `File.ReadAllText` するため I/O が累積する。1 つの Markdown 変換単位で resolve 結果を memo するか、jar 未検出時は再 resolve を試みず即エラーを返す形で揃えると性能と挙動が安定する。設計の cache follow-up とは別軸の改善点。
**severity**: Low
**対応**: 未対応

### 3.3 PlantUML placeholder の名前衝突可能性

**推奨対応**: `MarkdownRenderService.RenderToHtmlFragmentAsync` (Avalonia) は `DIAGRAM_BLOCK_0000` のような placeholder を文字列置換するが、ユーザの Markdown 本文に偶然同じ文字列が含まれた場合に誤置換が起きる (Mermaid 既存実装の継承)。`Guid.NewGuid()` を含めた sentinel を 1 回だけ採番する、または markdown-it / Markdig の inline parser hook を使う方が衝突しない。新規 PlantUML 対応で fence 抽出経路を共通化したので、衝突回避を一回り強化しておく価値はある。設計と無関係の Mermaid 既存挙動でもあるため低優先。
**severity**: Low
**対応**: 未対応

### 3.4 ADR 候補化判定の最終結論

**推奨対応**: 設計 follow-up に「ローカル CLI で図を生成する設計判断を ADR 化するかの判定」が残っている (design 272 行)。Phase 4 完了処理 (`completion`) の前または同 Phase で結論 (起票 / 起票しない理由) を `docs/adr/README.md` の起票条件 §2 に沿って残す。Phase 4 完了報告の漏れを防ぐためにも、impl 段階で「Phase 4 completion で判定する」までは確約しておく。
**severity**: Low
**対応**: 未対応

---

## 4. 整合性確認済み項目

| 項目 | 確認結果 |
|------|----------|
| `plantuml.jar` / `plantuml.config.json` がリポジトリにコミットされていない (`git ls-files`) | ✓ 整合 |
| `.gitignore` に `/plantuml.jar` / `/plantuml.config.json` および `markdown-viewer-tauri/src-tauri/plantuml.{jar,config.json}` が追加され、`git check-ignore` で除外確認済み | ✓ 整合 |
| Avalonia: `IMarkdownRenderService` が `Task<string> RenderToHtmlFragmentAsync(string, CancellationToken)` に一本化され、同期 API は撤去 | ✓ 整合 (Phase 2 Medium 1.1) |
| Avalonia: `MarkdownRenderService` (fence 抽出・placeholder 管理・差し替え) と `PlantUmlRenderService` (CLI 実行・timeout・stdout/stderr 解釈) と `PlantUmlRuntimeResolver` (jar 解決) で責務分割 | ✓ 整合 |
| Tauri: `render_plantuml_diagrams` command 採用、`read_text_file` 統合案不採用 | ✓ 整合 (Phase 2 Medium 1.2) |
| Tauri: `Result<PlantUmlRenderResponse, String>` 契約 + 個別図エラーは `PlantUmlDiagramResult.ok=false` | ✓ 整合 |
| Avalonia: `ToggleTheme` で `_currentBodyHtml` を再利用し PlantUML CLI を再実行しない | ✓ 整合 (Phase 2 Medium 1.4) |
| Tauri: `theme` 変更だけでは `render_plantuml_diagrams` を invoke しない (PlantUML useEffect の deps は `[selectedFilePath, selectedMarkdown, previewRevision]`) | ✓ 整合 (Phase 2 Medium 1.4) |
| Avalonia/Tauri ともに `java -jar <plantuml.jar> -tsvg -pipe` を引数配列で起動し shell を介さない | ✓ 整合 (review_checkpoints.md §3) |
| Avalonia: stdout/stderr を `Encoding.UTF8` で取得し、`ReadToEndAsync` で並行 drain | ✓ 整合 |
| 1 図あたり 10 秒の timeout と timeout 時の process kill | ✓ 整合 (Avalonia) / △ (Rust の polling 構造は §1.2 参照) |
| SVG sanitizer: `<script>` 要素と `on*` event handler attribute 除去を Avalonia / Tauri 両方で実装 | ✓ 整合 |
| エラー表示: 各 fence ごとに `.plantuml-error`、Tauri は `firstError` を banner にも反映 | ✓ 整合 (Avalonia の banner 反映は §2.2 参照) |
| `PlantUmlRuntimeOptions` の `JarPath` / `ConfigPath` 契約、runtime error の分類 (`JarNotFound` / `ConfigInvalid`) | ✓ 整合 (Phase 2 Low 2.3) |
| Avalonia / Tauri 開発実行と Tauri bundle の runtime directory が `docs/rules/development_workflow.md` と impl で対応 | ✓ 整合 |
| 共有確認用 `sample_docs/plantuml.md` がリポジトリ直下に追加され、`mermaid` / `plantuml` / `puml` を含む | ✓ 整合 |
| `docs/rules/development_workflow.md` に PlantUML setup、runtime directory、PlantUML `1.2026.3` / `openjdk 24.0.2` 動作確認、手動確認の PlantUML 追加が反映 | ✓ 整合 (Phase 2 Low 3.2) |
| `docs/architecture/overview.md` / `code_patterns.md` / `common_pitfalls.md` に PlantUML を追記 | ✓ 整合 |
| `docs/components/avalonia_viewer/` (README / detail_design / interface_spec) に Service 構成と非同期 API を追記 | ✓ 整合 |
| `docs/components/tauri_viewer/` (README / detail_design / interface_spec) に PlantUML command 契約と runtime directory を追記 | ✓ 整合 |
| 設計レビュー §1.1〜§1.4 Medium 4 件、§2.1〜§2.4 / §3.1〜§3.4 Low 8 件のすべてが実装または文書に反映 | ✓ 整合 |
| `meta.md` `impl_status=draft` で Phase 3 レビュー依頼準備済み | ✓ 整合 |
| Phase 3 検証コマンド `dotnet build` / `npm run build` / `cargo fmt -- --check` / `cargo check` が成功 (ユーザ報告) | ✓ 整合 |
| PlantUML 1.2026.3 と Java openjdk 24.0.2 で `java -jar ... -tsvg -pipe` smoke test が成功 (ユーザ報告) | ✓ 整合 |
| 設計書本文・恒久ドキュメント・impl 文書が日本語、UI / エラー文言・コード識別子が英語で `docs/rules/language_rules.md` を満たす | ✓ 整合 |

---

## 5. 対応優先度

| 優先度 | 項目 | 理由 |
|--------|------|------|
| 高 | 1.1 Tauri Mermaid 消失 regression | 受け入れ条件「Existing Mermaid samples still render」への regression。Mermaid + PlantUML を含む実利用 Markdown で発火する |
| 高 | 1.2 Rust stdout/stderr deadlock | パイプバッファを超える SVG (実利用想定の class / sequence 図で容易に発生) が常時 10 秒 timeout する。Avalonia と挙動が乖離する |
| 中 | 1.3 Mermaid fence regex 厳密性差 | Avalonia と Tauri で fence info string 解釈が分岐し、同じ Markdown が異なる結果になり得る |
| 中 | 2.1 Mermaid 同居サンプル不足 | 1.1 / 1.2 の再現確認と Phase 4-a 手動確認に必要 |
| 中 | 2.3 Tauri runtime directory 探索順の文書/実装ズレ | Finder 起動 / Tauri bundle 利用時の挙動再現性に影響する |
| 低 | 1.4 Avalonia stdin encoding 未指定 | macOS では顕在化しないが Windows 検証時の潜在バグ |
| 低 | 2.2 Avalonia の banner 反映欠如の文書化 | 設計と実装の整合を impl 文書で明示する |
| 低 | 2.4 5 エラーシナリオの期待表示の記録 | Phase 4 動作確認の再現性を上げる |
| 低 | 3.1 Rust `_config_path` 未使用 | コード読解の見通し向上 |
| 低 | 3.2 jar 解決の memoization | I/O 累積の最適化 |
| 低 | 3.3 placeholder 衝突可能性 | Mermaid 旧実装からの継承。本機能では新規 risk 増ではない |
| 低 | 3.4 ADR 候補化結論 | Phase 4 completion での処理を確約しておく |

---

## 6. 結論

実装は Phase 2 設計レビューで確定した Medium 4 件 (非同期 API 一本化、`render_plantuml_diagrams` command 採用、runtime directory 定義、theme 切替時の CLI 再実行抑制) と Low 8 件 (`.gitignore`、`sample_docs/plantuml.md`、`PlantUmlRuntimeOptions` 契約、SVG sanitizer、PlantUML version 記録、Tauri banner 整合、UTF-8 取扱い等) を概ね反映している。Avalonia 側は `Process.StandardOutput.ReadToEndAsync` を `WaitForExitAsync` と並行起動する形で正しく実装され、設計通り stdout / stderr drain → timeout キャンセル → exit code 判定の順で安定している。`plantuml.jar` / `plantuml.config.json` はリポジトリにコミットされていないことを `git ls-files` と `git check-ignore` で確認した。恒久ドキュメント (`docs/rules/development_workflow.md`、`docs/architecture/*`、`docs/components/<viewer>/*`) も実装差分に追従している。

一方で、Phase 4 動作確認へ進む前に解消すべき correctness 課題が 2 件存在する。

- §1.1: Tauri で Mermaid と PlantUML を同居させると、PlantUML 描画完了後に Mermaid SVG が DOM 書き換えで消失する。これは受け入れ条件「Existing Mermaid samples still render after the change」と設計の Mermaid 既存経路維持に反する。
- §1.2: Rust 側で stdout / stderr を子プロセス終了後にしか読まないため、パイプバッファを超える SVG では 10 秒 timeout までブロックする。実利用想定の class / sequence 図でほぼ確実に発生する。Avalonia 側は正しく実装されており乖離がある。

§1.3 / §2.1 / §2.3 は中優先度で、fence info string の厳密性整合、Mermaid と PlantUML を同居させた共有サンプルの追加、Tauri runtime directory 探索順の文書/実装整合の 3 点を Phase 3 内で揃えることを推奨する。

判定: **条件付き承認**。
- 1.1 / 1.2 の 2 件 (High) を実装で解消し、1.3 / 2.1 / 2.3 の 3 件 (Medium) を実装または文書で整合させた段階で Phase 3 を完了承認とする。Avalonia / Tauri 両実装の検証コマンドと Mermaid + PlantUML 同居サンプルでの手動確認 (両図描画、theme 切替時の CLI 再実行抑制、Java 未配置時のエラー表示) を再走させること。
- 低優先度 §1.4 / §2.2 / §2.4 / §3.1〜§3.4 の 7 件は Phase 3 中の対応が望ましいが、Phase 4-a / 4-b に持ち越しても致命的な阻害要因にはならない。Phase 4 へ持ち越す場合は impl 文書または `meta.md` に明示すること。

未解決指摘は本文書に列挙したとおり。High 2 件の対応完了後に再レビューを依頼することを推奨する。

---

## 7. 指摘対応状況更新 (2026-05-21)

Phase 3実装レビュー後、High 2件と Medium 3件を対応した。

| 項目 | 対応状況 |
|------|----------|
| 1.1 Tauri Mermaid 消失 regression | 対応済み。PlantUML結果反映後もMermaidを再描画する。 |
| 1.2 Rust stdout/stderr deadlock | 対応済み。stdout / stderrを子process実行中に別threadでdrainする。 |
| 1.3 Mermaid fence regex厳密性差 | 対応済み。info string先頭tokenを言語判定に使う仕様として文書化した。 |
| 2.1 Mermaid同居サンプル不足 | 対応済み。`sample_docs/plantuml.md` にMermaid blockを追加した。 |
| 2.3 Tauri runtime directory探索順 | 対応済み。実装・設計・component docsを `src-tauri/`、current working directory、実行ファイルdirectoryの順に揃えた。 |
| 1.4 Avalonia stdin encoding未指定 | 対応済み。`StandardInputEncoding = Encoding.UTF8` を追加した。 |

低優先度の 2.2 / 2.4 / 3.1 / 3.2 / 3.3 / 3.4 は Phase 4 での確認またはfollow-upとして残す。Phase 3完了承認の阻害要因ではない。

再検証:

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj --no-restore`: 成功。
- `npm run build` in `markdown-viewer-tauri/`: 成功。Mermaid chunk size warningあり。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。

再レビュー依頼対象: この対応差分を含む次 commit。

---

## 8. レビュー担当による再確認結果 (2026-05-21, commit `632019e`)

実装差分・恒久ドキュメント・impl 文書を再確認した。High 2 件と Medium 3 件は実装または恒久ドキュメントへ反映されており、レビュー担当としても解消を承認する。

### High の対応確認

- **1.1 Tauri Mermaid 消失 regression**: `markdown-viewer-tauri/src/App.tsx:259` の Mermaid `useEffect` の deps が `[previewRevision, theme, plantUmlDiagrams]` へ拡張された。`plantUmlDiagrams` は `useMemo` 化された `emptyPlantUmlDiagrams` を空集合として使うことで参照安定性が確保され、PlantUML 結果が変化したときだけ Mermaid effect が再走する。PlantUML 描画 (pending → result) の各 setState で `dangerouslySetInnerHTML` が DOM を上書きしても、その直後の Mermaid effect で `.mermaid` 要素に対して `mermaid.run` が再実行される。Mermaid + PlantUML 同居サンプル (`sample_docs/plantuml.md`) が追加されたことで、Phase 4-a の手動確認でも再現できる。✓ 解消確認。
- **1.2 Rust stdout/stderr deadlock**: `markdown-viewer-tauri/src-tauri/src/lib.rs:247-260` で `child.stdout.take()` / `child.stderr.take()` を取り出し、`read_plantuml_pipe` (`lib.rs:314-328`) で `thread::spawn` した reader thread に `read_to_end` を担わせる。stdin への source 書き込みは reader thread が走った後に実行されるため、Java が SVG を stdout に書く間も親プロセスは drain を継続でき、pipe buffer overflow が原因の deadlock を回避する。timeout 経路 (`lib.rs:302-308`) では `child.kill()` → `child.wait()` → `join_plantuml_pipe` の順で reader thread を回収するため、kill 後の thread leak も発生しない。stdin 書き込み失敗時の cleanup (`lib.rs:267-273`) でも同じ手順で thread を回収する。Avalonia の `ReadToEndAsync` 並行 drain と振る舞いが揃った。✓ 解消確認。

### Medium の対応確認

- **1.3 Mermaid fence regex 厳密性差**: `docs/architecture/code_patterns.md` の TypeScript / React 節に「Mermaid / PlantUML のfence言語判定はinfo stringの先頭tokenを小文字化して行う」旨が追記された。実装上、Tauri は `info.trim().split(/\s+/)[0]?.toLowerCase()` で先頭 token を切り出して比較するため文書通り。Avalonia の `DiagramFenceRegex` は ` ```mermaid<空白あり> ` のような通常の info string パターンを正しく言語として扱い、文書記述と整合する。連結記法 (` ```mermaidsequence ` のように空白なしで追記する) は Markdown 上でも一般的な書式ではないため、文書化による整合で実用上の差異は解消とみなせる。✓ 解消確認。
- **2.1 Mermaid 同居サンプル不足**: `sample_docs/plantuml.md` に Mermaid flowchart block が追加され、`mermaid` / `plantuml` / `puml` の 3 種類を 1 ファイルで確認できる構成になった。`docs/rules/development_workflow.md` の手動確認チェックリストに「Mermaid と PlantUML が同居する `sample_docs/plantuml.md` で両方の図が描画されること」が追記され、設計書 (`feature_design.md`) の「テスト・ユーザ確認観点」も同居前提の文言へ更新された。Phase 4-a で High 1.1 の対応を再現確認できる材料がそろった。✓ 解消確認。
- **2.3 Tauri runtime directory 探索順**: `lib.rs:405-416` で `CARGO_MANIFEST_DIR` (debug 時) → `current_dir` → `current_exe` parent の順に挿入される。macOS bundle 判定 (`is_macos_app_executable_directory`) で先に拾うため、bundled 起動は `<app>.app/Contents/MacOS/` のみ。`docs/components/tauri_viewer/detail_design.md`、`docs/rules/development_workflow.md`、設計書 (`feature_design.md`)、`impl/plantuml_rendering_support_feature_impl.md` の 4 箇所すべてが「`markdown-viewer-tauri/src-tauri/` → current working directory → Rust 実行ファイル directory の順」で揃っている。✓ 解消確認。

### Low の対応確認

- **1.4 Avalonia stdin encoding 未指定**: `Avalonia/MarkdownViewer.Avalonia/Services/PlantUmlRenderService.cs:65` に `StandardInputEncoding = Encoding.UTF8` が追加された。Windows などの非 UTF-8 default code page 環境でも、PlantUML source は UTF-8 で stdin へ書き込まれる。✓ 解消確認。
- **2.2 Avalonia banner 反映欠如の文書化**: 未対応。Phase 4 持ち越し。
- **2.4 5 エラーシナリオの期待表示の記録**: 未対応。Phase 4 動作確認時に impl 文書または development_workflow へ追記する想定。
- **3.1 Rust `_config_path` 未使用**: 未対応。コード上の見通し改善で、Phase 4 / completion で扱う。
- **3.2 jar 解決の memoization**: 未対応。性能最適化として follow-up に残す。
- **3.3 Placeholder 衝突可能性**: 未対応。Mermaid 旧実装からの継承で、follow-up に残す。
- **3.4 ADR 候補化判定の最終結論**: 未対応。Phase 4-c completion で判定し、結論を `docs/adr/` または `meta.md` の follow-up に残す。

### 整合性追加確認

- `git diff` 上での実装差分と impl 文書 (§「設計レビュー指摘への対応」) の対応が一致する。
- `meta.md` の `related_commits` には Phase 3 関連 commit が反映待ち。`design_status=done`、`impl_status=draft` のまま。impl 完了後は本承認に合わせて `impl_status=done`、`status=implemented` への遷移と Phase 3 主要 commit (`7c4acc6` / `07ce356` / `632019e`) の `related_commits` 追記が必要 (本レビューと同時に meta を更新する)。
- 再検証コマンド (`dotnet build` / `npm run build` / `cargo check` / `cargo fmt -- --check` / `git diff --check`) の成功はユーザ報告通り。Mermaid chunk size の warning は既存事象として継続。

### 判定

**承認 (Approved)**。

- 設計レビュー Medium 4 件 / Low 8 件、本実装レビュー High 2 件 / Medium 3 件 / Low 1 件の合計 18 件が実装または恒久ドキュメントへ反映済み。
- 残る Low 6 件 (2.2 / 2.4 / 3.1 / 3.2 / 3.3 / 3.4) は Phase 4 (-a 動作確認 / -b 完了処理 / -c マージ前) で扱う follow-up として impl 文書 §「設計レビュー指摘への対応」と本文書 §5 表に明示済み。Phase 3 完了の阻害要因にはならない。
- Phase 4-a のユーザ動作確認では、`sample_docs/plantuml.md` を Avalonia と Tauri の双方で開き、(1) Mermaid と PlantUML の両方が描画されること、(2) Light / Dark 切替で PlantUML CLI を再実行せず描画が崩れないこと、(3) `plantuml.jar` を一時的に置き換えた場合のエラー表示が動作すること、を確認することを推奨する。

未解決指摘なし (Phase 3 で扱う対象としては解消済み)。本承認をもって Phase 3 実装レビューを完了とする。

---

## 9. Phase 4-a 追加実装レビュー (2026-05-21)

**追加実装対象コミット**: `cf18d24` (Add PlantUML rendering loading indicators) / `6c0ff27` (Refine PlantUML loading feedback) / `2249c63` (Update PlantUML loading feedback meta)
**meta 更新コミット**: `e454baf` (Update PlantUML feature meta)
**比較基準**: `732fbc4` (Phase 3 Approve PlantUML rendering implementation)
**レビュー観点出典**: `references/procedure/review_checkpoints.md` および `new-feature-workflow` Phase 3 / Phase 4 共通観点

### 経緯

Phase 4-a ユーザー動作確認で、Avalonia / Tauri 双方とも PlantUML 描画 (Java process 起動) に体感数秒の待機が発生し、ユーザーには「クリック直後に何も起きていないように見える」状態が問題になった。追加要望に応じて以下の UI フィードバックと Rust command の非同期化を実装した。

- Avalonia: `MainWindowViewModel.OpenMarkdownAsync` で `IsBusy=true` と `StatusMessage="Rendering <path>..."` を設定し、`MainWindow.axaml` にツールバー下の indeterminate `ProgressBar` とプレビュー領域のオーバーレイ (テキスト + indeterminate progress) を追加。
- Tauri: `App.tsx` に `isMarkdownLoading` state と `isPlantUmlRendering` 派生値を追加し、プレビュー上部に `Loading Markdown...` / `Rendering PlantUML diagrams...` の sticky `loading-banner` を表示。
- Tauri Rust: `render_plantuml_diagrams` を `async fn` 化し、`tauri::async_runtime::spawn_blocking` で blocking work を分離して async runtime の executor が詰まらないようにした。

`cf18d24` で初版を入れたあと、ユーザー追加フィードバック「Avalonia の進捗バーが Reload ボタンに近接して見た目が悪い」「Tauri は macOS 標準の待機カーソルに見える」を受けて `6c0ff27` で Avalonia の `ProgressBar` をツールバー下部の専用行へ移動し、Tauri に Markdown 読み込み中の明示バナー + `spawn_blocking` を追加した。`2249c63` は meta の commit 履歴反映。

### 1. Avalonia の読み込み中表示と既存 UI の干渉

**観点**: `MainWindow.axaml` の進捗 UI が Reload / Theme / Open Folder などの既存ボタンと干渉しないこと。
**確認**:
- `MainWindow.axaml:23-26` の toolbar grid は `RowDefinitions="Auto,4"` / `ColumnDefinitions="Auto,Auto,Auto,*"` に拡張され、ボタン列 (Row 0) と progress bar (Row 1, ColumnSpan=4, Height=4) が分離された。Reload / Theme / Open Folder ボタンは Row 0 に残り、ProgressBar の上に乗らない。
- `MainWindow.axaml:69-95` のプレビュー領域は `Grid` で `NativeWebView` の上に `IsBusy=true` 連動の overlay Border を重ねる。overlay は WebView 全面を覆い、内側に `StatusMessage` + indeterminate progress を表示する中央カードを持つ。WebView の navigation handler はそのまま稼働しており、`PreviewWebView_OnNavigationCompleted` イベント発火経路を阻害しない。
- 既存の `ExplorerTree` (Grid.Row=1, Grid.Column=0) には影響しない。
- 残課題: Reload ボタンは `IsEnabled` を `!IsBusy` などに bind しておらず、busy 中もクリック可能。`ReloadAsync()` は `OpenFolderAsync` を await したあとに `OpenMarkdownAsync` を await する構造で、in-flight な `OpenMarkdownAsync` は cancellation token を持たないため、Reload を連打すると複数の `OpenMarkdownAsync` が並行する可能性が残る。これは本追加実装で持ち込まれた問題ではない (Phase 3 時点から存在) ので Low 扱いとし、完了レビューまでに `IsBusy` 連動 `IsEnabled` への切り替えか cancellation 経路の整備を検討する余地として記録する。

**判定**: 干渉なし。既存 UI と progress UI が物理的に重ならず、`Padding="10,8"` + `RowSpacing="6"` でツールバーの密度も適切。

### 2. Tauri の読み込み中表示

**観点**: Markdown 読み込み中 / PlantUML 描画中の表示が期待通り出ること。
**確認**:
- `App.tsx:49` で `isMarkdownLoading` state を追加し、`loadMarkdown` (App.tsx:121-138) で `try` 直前に `setIsMarkdownLoading(true)`、`finally` で `false` に戻している。`read_text_file` invoke が失敗しても finally で解除されるため state が残らない。
- `App.tsx:61-63` で `isPlantUmlRendering` を `plantUmlDiagrams.some((d) => !d.ok && d.error === null)` として導出。これは pending 状態 (App.tsx:194-201 で `ok: false, html: pending, error: null`) のみが該当し、success (`ok=true, error=null`) や failure (`ok=false, error=message`) では false になる。banner の出現条件は意図通り。
- `App.tsx:307-316` で preview-pane 上部に sticky banner を出す。`isMarkdownLoading` が優先され、後段で `isPlantUmlRendering && <banner/>` に切り替わる JSX 構造。Markdown 読み込みが終わって PlantUML 描画が始まった時点でバナーのテキストが切り替わる。`role="status"` を付けており accessibility 観点でも妥当。
- `App.css:228-237` で `.loading-banner` が定義され、`position: sticky; top: 0; z-index: 2; background: var(--accent-soft); color: var(--text)` でテーマ変数に追従する。Light / Dark どちらでも視認可能。
- 既存 `.error-banner` (App.css:218-226) と同じ z-index=2 で重なるが、両者は別 DOM ノード (`errorMessage && <div className="error-banner"/>` と `isMarkdownLoading ? ... : isPlantUmlRendering && ...`) として独立に表示されるため、DOM 順 (error-banner → loading-banner) で縦に積まれる。許容範囲。

**判定**: 期待通り。`Loading Markdown...` → `Rendering PlantUML diagrams...` → 解除、の遷移が自然に成立する。

### 3. `spawn_blocking` 化の確認

**観点**: PlantUML Java process 待機で Tauri 側の async runtime が詰まらないこと。
**確認**:
- `lib.rs:93-98` で `render_plantuml_diagrams` が `async fn` に変わり、`tauri::async_runtime::spawn_blocking(move || render_plantuml_diagrams_blocking(sources))` でブロッキング作業を分離。`.await.map_err(|e| format!("PlantUML render task failed: {e}"))?` で `JoinError` も UI 表示可能なエラーへ変換。
- `lib.rs:100-118` の `render_plantuml_diagrams_blocking` が従来の同期実装本体。順次 `render_plantuml_diagram` を呼び、`first_error` を集約する点は変わらず。
- Java process の `try_wait` / `sleep(20ms)` polling と pipe reader thread (Phase 3 で導入) は `spawn_blocking` 内で実行されるため、tokio の executor を block しない。これにより `Loading Markdown...` → `Rendering PlantUML diagrams...` バナー切り替えや、Mermaid の `useEffect` トリガなど、フロント側の UI 更新が Java 待機中も発火可能になる。
- 副次効果として、`invoke<PlantUmlRenderResponse>("render_plantuml_diagrams", ...)` の呼び出しは引き続き Promise を返し、フロント側コードは変更不要。

**判定**: 期待通りの非同期化。blocking thread pool への移譲で UI 更新が PlantUML 描画中も継続する。

### 4. Mermaid / PlantUML 同居・theme 切替・reload の回帰確認

**観点**: Phase 3 で解消した Mermaid + PlantUML 同居挙動、theme 切替時の CLI 再実行抑制、Reload 経路が損なわれていないこと。
**確認**:
- `App.tsx:268` の Mermaid `useEffect` の deps は `[previewRevision, theme, plantUmlDiagrams]` のまま。`plantUmlDiagrams` が pending → result で参照変化するたびに mermaid.run が再走し、PlantUML 結果反映後の DOM 上書き後も Mermaid SVG が復活する経路は維持されている。
- Theme 切替: `App.tsx:177-178` の `useEffect` は `data-theme` 属性のみ更新する。Mermaid `useEffect` は `theme` 変化で再走するが、PlantUML 用 `useEffect` (App.tsx:180-237) の deps には `theme` が含まれていないため、`render_plantuml_diagrams` は再 invoke されない。設計通り。
- Reload: `App.tsx:103-115` の `reload` は `scan_directory` → `loadMarkdown` の順で呼び出し、`loadMarkdown` 内で `setIsMarkdownLoading(true)/false` を回す。`previewRevision++` で PlantUML `useEffect` が再 trigger され、新しい SVG を取得する。
- Avalonia 側: `ToggleTheme()` (`MainWindowViewModel.cs:141-150`) は `IsBusy` を変更しないまま `_currentBodyHtml` を再利用してプレビューを更新する。overlay と progress は出ない。`ReloadAsync()` (95-108) は `OpenFolderAsync` → `OpenMarkdownAsync` の経路を通り、`OpenMarkdownAsync` 内で `IsBusy=true/false` を回す。
- `sample_docs/plantuml.md` の構成 (mermaid → plantuml → puml) は変更されていない。Mermaid 同居検証材料は維持。

**判定**: 既存挙動の回帰なし。Mermaid + PlantUML 同居サンプルでの手動確認は引き続き有効。

### 5. 文書整合・language rules

**観点**: `docs/rules/language_rules.md` に従い、本文は日本語、UI 文言は英語で揃っていること。impl 文書と detail_design に追加実装が反映されていること。
**確認**:
- UI 文言: `Loading Markdown...`、`Rendering PlantUML diagrams...`、`Rendering {path}...`、`PlantUML render pending...` はすべて英語。`StatusMessage = $"Rendering {Path.GetRelativePath(RootPath, path)}..."` の `{path}` 部分は relative path 文字列で言語非依存。
- 文書: `docs/components/avalonia_viewer/detail_design.md` (処理フローに「描画中状態へ切り替え」「描画中状態を解除」を追加、PlantUML 節に `IsBusy` / `StatusMessage` の説明を追加) と `docs/components/tauri_viewer/detail_design.md` (`spawn_blocking` 経由の blocking work、pending banner の説明を追加) が日本語で記述されている。
- impl 文書 `plantuml_rendering_support_feature_impl.md` は Avalonia / Tauri / Phase 4-a 検証コマンドの各節に追加実装内容を反映済み。`spawn_blocking` 採用、Markdown 読み込みバナー、PlantUML 描画バナー、検証ログがすべて記録されている。
- `docs/rules/development_workflow.md` の手動確認チェックリストに「PlantUML 描画中に読み込み中表示が出ること」が追加されている。

**判定**: 言語規則と文書整合とも問題なし。

### 6. `plantuml.jar` / publish 生成物の混入確認

**観点**: 生成物がリポジトリにコミットされていないこと。
**確認**: `git ls-files | grep -E "plantuml\.jar|plantuml\.config\.json|^publish/"` の出力なし。`.gitignore` の Phase 3 設定 (`/plantuml.jar`、`/plantuml.config.json`、`markdown-viewer-tauri/src-tauri/plantuml.{jar,config.json}`、`publish/`) で適切に除外されている。
**判定**: 問題なし。

### 7. 改善提案 (Low、Phase 4 / completion で扱う候補)

| # | 内容 | severity |
|---|------|----------|
| 9.A | Avalonia: 描画中 (`IsBusy=true`) は Reload / Open Folder / Theme ボタンの `IsEnabled` を false にして連打を抑止すると、UX が一段安定する。完了レビュー (Phase 4-c) もしくは follow-up での対応を推奨。 | Low |
| 9.B | Tauri: PlantUML 描画 pending 中の inline placeholder が `.plantuml-error` styling (赤系) のままで、上部の `loading-banner` (accent-soft、青系) と視覚的に不整合。pending 専用クラス (例: `.plantuml-loading`) を追加して、結果待ちは accent-soft、最終失敗は error 色で表示すると意図が伝わりやすい。 | Low |
| 9.C | Tauri: `App.tsx:308-316` で `isMarkdownLoading` と `isPlantUmlRendering` のバナーは `else if` で排他なため、Markdown 読み込み直後に PlantUML 描画が始まる遷移は自然だが、Markdown 読み込み + PlantUML 描画が同時に発生し得るケース (Reload 時など) では Markdown 側だけが表示される。多くの場合は Markdown 読み込みが先に完了するため実害は小さいが、両方を併記するか「Loading...」一本に集約するかは Phase 4-c で再評価する。 | Low |
| 9.D | Avalonia: overlay Border の `Background` は `SystemControlBackgroundChromeMediumLowBrush` を直接使うため WebView を不透明に隠す。半透明化 (例: opacity 0.6 + Background 透明) でプレビュー残像を見せたいかどうかは UX の方向性次第。現状でも実害なし。 | Low |

これらはいずれも Phase 4-a の追加実装によって新たに導入された致命的な欠陥ではなく、UX 改善の余地として記録する。本追加実装の承認可否には影響しない。

### 8. 判定

**承認 (Approved)**。

- 主目的の「PlantUML 描画中に読み込み中フィードバックを示す」を Avalonia / Tauri 双方で実装済み。
- 既存 UI / 既存挙動 (Mermaid 同居、theme 切替、Reload) の回帰なし。
- `spawn_blocking` 採用により Tauri 側の async runtime が PlantUML Java process 待機で詰まらない設計に整理された。
- 言語規則、生成物の非コミット、impl / detail_design / development_workflow の整合はすべて確認済み。
- 残課題 9.A〜9.D は Low で、Phase 4-c 完了レビューまでの follow-up としてのみ扱う。

これで Phase 4-a の追加実装も含めて Phase 3 実装内容の整合は保たれている。Phase 4-b (差分レポート生成・コミット) → Phase 4-c (マージ前承認) へ進む準備が整った。Phase 4-c 完了レビュー時に 9.A〜9.D の扱い (取り込むか follow-up として残すか) を判断することを推奨する。
