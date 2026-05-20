# PlantUML 表示対応 実装レビュー

**レビュー日**: 2026-05-21
**対象実装コミット**: `7c4acc65a0ae9eaafbf16703360f355ddb29d59c`
**対象設計**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/design/plantuml_rendering_support_feature_design.md`
**対象設計レビュー**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/review/plantuml_rendering_support_design_review.md`
**対象実装記録**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/impl/plantuml_rendering_support_feature_impl.md`
**対象 meta**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-001
**レビュー観点出典**: `ai-review-response-workflow` skill 同梱 `references/procedure/review_checkpoints.md` および `new-feature-workflow` の `phase_3_impl_and_docs_focus.md`

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
**対応**: 未対応

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
**対応**: 未対応

### 1.3 Tauri: Mermaid fence regex の info-string 厳密性が緩んだ

**ドキュメント記載**: 既存仕様の Mermaid fence は ` ```mermaid ` のみが対象だった (`MarkdownRenderService.cs` の旧 regex `^```[ \t]*mermaid[ \t]*\r?\n` および App.tsx の `language === "mermaid"` 判定)。
**実装**: Avalonia の `DiagramFenceRegex` は `^```[ \t]*(?<language>mermaid|plantuml|puml)[^\r\n]*\r?\n` (`MarkdownRenderService.cs:69`) で、`mermaid` の後に任意の info string を許容する。`extractPlantUmlSources` (`App.tsx:540`) も同様。
**差異**: ` ```mermaid foo bar ` のような info string 付き fence が、新たに Mermaid 描画対象として扱われるようになった。一方、Tauri の markdown-it fence rule (`App.tsx:464`) は `info.trim().split(/\s+/)[0]?.toLowerCase()` で先頭トークンだけ比較しており、こちらは挙動が変わらない。Avalonia と Tauri で fence info string 解釈が分岐し、同じ Markdown が片方で Mermaid と認識され片方で plain code block になる可能性がある。
**推奨対応**: 両実装で同じ厳密性を採用する。例えば設計書 (もしくは `docs/architecture/code_patterns.md`) で「fence info string は先頭トークンのみで言語を判定する」と明記し、Avalonia の regex も `(?<language>mermaid|plantuml|puml)[ \t]*\r?\n` に合わせる。
**severity**: Medium
**対応**: 未対応

### 1.4 Avalonia: PlantUML 描画 source の stdin エンコーディングが未指定

**ドキュメント記載**: 設計書「プロセス実行」(design 164 行) は stdout / stderr の UTF-8 取扱いを明記したが、stdin は明記されていない。
**実装**: `PlantUmlRenderService.cs:59-69` の `ProcessStartInfo` は `StandardOutputEncoding` / `StandardErrorEncoding` を UTF-8 にしているが、`StandardInputEncoding` を設定していない。`process.StandardInput.WriteAsync(source.AsMemory(), ...)` は `StreamWriter` のデフォルト encoding (OS console code page 依存) で書き込む。
**差異**: macOS / Linux の default code page は UTF-8 のため現状環境では問題が出ない。一方、Windows 環境では code page 932 (Shift_JIS) などになり、非 ASCII の PlantUML source (日本語ラベル、エイリアス等) が PlantUML 側で誤ってデコードされる。本プロジェクトは macOS arm64 を主開発環境としているが、Tauri / Avalonia ともにクロスプラットフォーム前提で書かれており、将来 Windows 検証時に不可解な描画崩れの原因になり得る。
**推奨対応**: `ProcessStartInfo.StandardInputEncoding = Encoding.UTF8` を追加する。または `process.StandardInput.BaseStream` に `new StreamWriter(stream, Encoding.UTF8)` で wrap する。1 行追加で完結する。
**severity**: Low
**対応**: 未対応

---

## 2. ドキュメント不足

### 2.1 共有確認用サンプルが PlantUML 単独のみ

**不足**: `sample_docs/plantuml.md` は PlantUML 2 fence のみで構成されている。設計レビュー §1.1 の指摘 (本文書 1.1) の再現確認、および acceptance criteria の Mermaid 維持要件の手動確認材料が無い。
**推奨対応**: `sample_docs/` 配下に Mermaid と PlantUML を 1 ファイルに含むサンプルを追加するか、`sample_docs/plantuml.md` に Mermaid block を追加する。`docs/rules/development_workflow.md` の手動確認に「Mermaid と PlantUML を同居させた Markdown で両方が描画される」を追加する。
**severity**: Medium
**対応**: 未対応 (本文書 1.1 と一体で対応すること)

### 2.2 PlantUML 描画失敗時の StatusMessage 表示が impl 文書に明示されていない

**不足**: Avalonia の `MainWindowViewModel.OpenMarkdownAsync` は `RenderToHtmlFragmentAsync` を await し、その中で PlantUML 失敗は inline error に置き換わるだけで StatusMessage には反映されない。設計書「エラー動作」(design 184-186 行) は「banner / status には最初の代表エラー 1 件のみを表示し、詳細は inline error を正とする」としているが、Avalonia 実装は banner 表示を一切行わず、Tauri 実装のみ `firstError` を `setErrorMessage` で銀盤に表示する。Avalonia / Tauri の挙動差が impl 文書 (`plantuml_rendering_support_feature_impl.md`) や `docs/components/avalonia_viewer/detail_design.md` に書かれていない。
**推奨対応**: 設計を Avalonia の挙動に合わせる (status へは出さない) ことを意図しているならば impl 文書と Avalonia detail_design に明記する。設計通り「最初の代表エラーは status / banner にも出す」のが正なら Avalonia でも `_currentBodyHtml` を保持しつつ `StatusMessage = firstError;` を設定する変更を入れる。挙動差そのものは Low だが、文書整合性を担保するうえで Phase 3 で扱う対象になる。
**severity**: Low
**対応**: 未対応

### 2.3 Tauri runtime directory 探索順の挙動が detail_design と Rust 実装で僅かにズレる

**不足**: `docs/components/tauri_viewer/detail_design.md:24` は「Tauri dev では `markdown-viewer-tauri/src-tauri/` をruntime directory として先に探索し、次にRust実行ファイルのdirectoryを見る」と書く。実装 `plantuml_runtime_directories` (`lib.rs:355-387`) は次の順序で挿入する。
1. `current_dir()` (シェル呼び出し元の CWD)
2. `CARGO_MANIFEST_DIR` (`debug_assertions` 時のみ。これが `markdown-viewer-tauri/src-tauri/`)
3. `current_exe` 親

つまり、cwd → src-tauri/ → exe parent の順で先頭は cwd である。設計書「Runtime 設定」(design 101-102 行) では「Tauri 開発実行: `markdown-viewer-tauri/src-tauri/` を明示的な runtime directory として先に探索し、その後に Rust 実行ファイルの directory を探索する」と書かれており、cwd 優先は明示されていない。
**推奨対応**: 実装通り cwd を最優先する設計を意図しているなら `docs/components/tauri_viewer/detail_design.md` と設計書「Runtime 設定」を「cwd → src-tauri/ → exe parent」の順序へ揃える。設計書通り src-tauri/ を最優先するなら実装の挿入順を入れ替える。recommended は実装側を `markdown-viewer-tauri/src-tauri/` 優先に揃えること (Finder 起動時に cwd が `/` になっても src-tauri/ で解決できる前提を保つため)。
**severity**: Medium
**対応**: 未対応

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
| Avalonia / Tauri 開発実行と Tauri bundle の runtime directory が `docs/rules/development_workflow.md` と impl で対応 (順序は §2.3 参照) | △ |
| 共有確認用 `sample_docs/plantuml.md` がリポジトリ直下に追加され、`plantuml` と `puml` を含む | ✓ 整合 (Mermaid 混在は §2.1 参照) |
| `docs/rules/development_workflow.md` に PlantUML setup、runtime directory、PlantUML `1.2026.3` / `openjdk 24.0.2` 動作確認、手動確認の PlantUML 追加が反映 | ✓ 整合 (Phase 2 Low 3.2) |
| `docs/architecture/overview.md` / `code_patterns.md` / `common_pitfalls.md` に PlantUML を追記 | ✓ 整合 |
| `docs/components/avalonia_viewer/` (README / detail_design / interface_spec) に Service 構成と非同期 API を追記 | ✓ 整合 |
| `docs/components/tauri_viewer/` (README / detail_design / interface_spec) に PlantUML command 契約と runtime directory を追記 | ✓ 整合 (順序差は §2.3 参照) |
| 設計レビュー §1.1〜§1.4 Medium 4 件、§2.1〜§2.4 / §3.1〜§3.4 Low 8 件のすべてが実装または文書に反映 (本文書 §1.3 / §2.3 で軽微な再修正対象あり) | ✓ おおむね整合 |
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
