# PlantUML 表示対応 設計レビュー

**レビュー日**: 2026-05-20
**対象ドキュメント**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/design/plantuml_rendering_support_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-001
**対象コミット**: `48126dc4ce581d9c428ddddcf02d671e655350d2`
**レビュー観点出典**: `ai-review-response-workflow` skill 同梱 `references/procedure/review_checkpoints.md` および `new-feature-workflow` の `phase_2_design_focus.md`

---

## 概要

TODO-2026-001 (PlantUML Rendering Support) の Phase 2 設計レビュー。`plantuml.jar` を成果物に含めず、ローカル Java / `plantuml.jar` を実行ディレクトリ規約と `plantuml.config.json` で参照する設計、ならびに Avalonia/Tauri の責務境界、CLI 実行、timeout、エラー表示、SVG 埋め込み、セキュリティについて、ユーザ指定の観点と review_checkpoints.md に従って検証した。Phase 3 への進行可否を確認することが目的。

---

## 1. 齟齬・不整合

### 1.1 `MarkdownRenderService` 非同期化の契約が未定義

**ドキュメント記載**: 影響範囲に「`MarkdownRenderService` を非同期化し、`plantuml` placeholder に対応する」とある (design 117-118 行)。
**実装**: 現行 `IMarkdownRenderService.RenderToHtmlFragment(string)` は同期 `string` を返す。`MainWindowViewModel.OpenMarkdownAsync` がこのメソッドを await せずに呼んでいる (`Avalonia/MarkdownViewer.Avalonia/Services/MarkdownRenderService.cs:9`、`Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs:119`)。
**差異**: 公開 API の戻り値型と命名が変わるが、設計書には新シグネチャ案 (例 `Task<string> RenderToHtmlFragmentAsync(string markdown, CancellationToken)`) も後方互換扱いの方針も書かれていない。`MarkdownRenderService` 自身が `PlantUmlRenderService` を所有して非同期化するのか、`MainWindowViewModel` が両 Service を呼び分けるオーケストレータとなり Render Service は同期のまま残すのかが Phase 3 で揺らぐ恐れがある。
**推奨対応**: Phase 3 着手前に、(a) 新インタフェース署名、(b) `MarkdownRenderService` と `PlantUmlRenderService` の責務分担 (placeholder 抽出側 / 実行側 / 差し替え orchestrator のどこが本体か)、(c) 既存同期メソッドを残すか撤去するか、を設計書「設計方針」または「影響範囲」へ追記する。SRP と「特定クラス固有 / 抽象化層 / 汎用層」の配置精査 (review_checkpoints.md §2) を明示するため。
**severity**: Medium
**対応**: 未対応

### 1.2 Tauri 側の境界選択が二案併記のまま

**ドキュメント記載**: 「`render_plantuml_diagrams` command を追加する、または Markdown 読み込み response に図描画結果を統合する」(design 124-125 行)。
**差異**: 採用案 / 不採用案いずれの形式でもなく、二案併記で残っている。前者は (markdown-it でいったん HTML 化 → fence 抽出 → Rust command 呼び出し → 差し替え) という多段オーケストレーションを React 側に置くことになり、後者は `read_text_file` 相当の契約自体を拡張することになる。境界選択は React と Rust 双方のテスト観点と互換性に影響する。
**推奨対応**: Phase 3 で採用案を一つに固定し、設計書「採用案」または「設計方針」に追記する。React は再描画条件 (Mermaid と同じ `previewRevision` パイプライン) と整合する形を取り、Rust は `Result<T, String>` 契約 (language_rules.md Rust §1) を保つ案が既存パターンと整合しやすい。判断理由 (Tauri command boundary に寄せる方が `language_rules.md` の「Tauri command はファイルシステムや OS 連携の境界として扱う」と一致する) も併記する。
**severity**: Medium
**対応**: 未対応

### 1.3 Tauri の runtime directory 定義が不足

**ドキュメント記載**: 「publish されたアプリ: 実行ファイルのディレクトリ。開発実行: 現在の working directory を先に見て、その後に実行ファイルのディレクトリを見る」(design 99-101 行)。
**差異**: Avalonia の `dotnet run` / `dotnet publish` 規約には素直に対応するが、Tauri の以下の起動形態が明示されていない。
- `npm run tauri dev`: Rust binary は `markdown-viewer-tauri/src-tauri/target/debug/` 配下、working directory は呼び出し元シェル依存。
- `tauri build` 後の macOS `.app` バンドル: 実行ファイルは `<bundle>/Contents/MacOS/`、working directory は Finder 起動時に `/` になる場合がある。
- 既存 `docs/architecture/common_pitfalls.md` の「Publish 生成物」の規約 (`publish/` 配下) と Tauri bundle の物理パスの関係が曖昧。
**推奨対応**: 設計書「Runtime 設定 / runtime directory」に Tauri 側の具体例を追加する。最低限、(1) dev: `markdown-viewer-tauri/src-tauri/` を cwd 相当として扱うか、cargo binary dir をどう扱うか、(2) bundled: `.app/Contents/MacOS/` 相当を runtime dir とする、を明文化する。`docs/components/tauri_viewer/detail_design.md` への反映予定先 (Phase 3) にもこの規約を含める。
**severity**: Medium
**対応**: 未対応

### 1.4 Theme 切替時の再レンダリング挙動が未定義

**ドキュメント記載**: 「PlantUML の dark-mode option は初期実装では使わない」「SVG を `.plantuml-diagram` で包み、viewer の背景・border 変数に合わせる」(design 188-191 行)、「Reload や theme switch 後に古い SVG を残したり、空白のまま失敗を隠したりしない」(design 175 行)。
**差異**: Avalonia の `MainWindowViewModel.ToggleTheme` (`Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs:138`) は theme 切替時に `OpenMarkdownAsync` を再実行する。Tauri も `previewRevision` 起点で再レンダリングする。これらは現状 Markdown → HTML 変換コストしか発生しないが、設計のままだと theme 切替のたびに `java -jar` が再起動し、10 図構成で 10 秒以上の体感遅延を生む。SVG をキャッシュしない方針 (cache は follow-up) と「古い SVG を残さない」要件の整合性が曖昧。
**推奨対応**: 設計書「設計方針 / Theme 動作」に theme 切替時の再描画ポリシーを明記する。候補 (どちらでもよいが Phase 3 着手前に確定する):
- A. Theme 切替時は SVG を再生成せず CSS のみ更新する (Mermaid と異なる扱い)。
- B. Theme 切替時にも SVG を再生成し、その間 placeholder を表示する。
あわせて「テスト・ユーザ確認観点」の Light / Dark 切替確認の合格条件を「PlantUML 出力が重なったり見えなくなったりしない」だけでなく「再描画にかかる時間」まで観測できる形に補足する。
**severity**: Medium
**対応**: 未対応

---

## 2. ドキュメント不足

### 2.1 `.gitignore` 追加パターンの粒度

**不足**: 設計は「`plantuml.config.json` と `plantuml.jar` を `.gitignore` へ追加する」(design 110 行) と書いているが、現状の `.gitignore` (リポジトリ直下) は単純な glob 列挙 (`bin/`, `obj/`, `publish/` 等) で構成されている。`plantuml.jar` を bare filename で書くと意図しないサブディレクトリの同名ファイルもすべて除外する。Avalonia の publish output (`publish/avalonia/raw/` 配下) は既に `publish/` で除外されるため Tauri 側に置く配置場合と整合する必要がある。
**推奨対応**: 設計書「Runtime 設定」または「影響範囲」に、追加する `.gitignore` パターンの具体的な書式 (例: `plantuml.jar`、`plantuml.config.json`、または `/plantuml.jar` のように root のみへ限定する案) を記述する。Tauri / Avalonia でユーザが jar を置く想定パスを 1, 2 件列挙し、それらが除外対象に含まれることを示す。
**severity**: Low
**対応**: 未対応

### 2.2 PlantUML サンプル Markdown 配置先が曖昧

**不足**: 「既存 sample docs 領域、または必要に応じて共有 sample 領域へ PlantUML サンプル Markdown を追加する」(design 131-132 行) としか書かれていない。`docs/` 配下と `markdown-viewer-tauri/` 内のどちらに置くか、Avalonia / Tauri 両方で同じファイルを開けるよう想定するのかが不明。手動確認手順 (design 226-228 行) との接続も曖昧。
**推奨対応**: Phase 3 着手前に配置先を 1 つ決め、設計書 (または `docs/components/<viewer>/detail_design.md` への反映予定) に追記する。Avalonia / Tauri 双方の手動確認で同じファイルを開ける構成 (リポジトリ直下の `samples/` 等) が後続 follow-up の確認にも使いやすい。
**severity**: Low
**対応**: 未対応

### 2.3 `PlantUmlRuntimeOptions` の契約と Java pre-check の有無

**不足**: 「`Services/` 配下に `PlantUmlRuntimeOptions` / resolver service を追加する」(design 116 行) とあるが、`PlantUmlRuntimeOptions` がレコードか class か、resolver の戻り値型 (成功時の `JarPath` と失敗時のエラー種別) が示されていない。また「Java 未導入」を「原因が分かるエラー」(design 14 行) として表示する要件があるのに、`java -version` の pre-check を行うのか、初回 `java -jar` 失敗を ProcessException から判別するのかが書かれていない。
**推奨対応**: `PlantUmlRuntimeOptions` の構造 (例: `record PlantUmlRuntimeOptions(string JarPath)` と `enum PlantUmlRuntimeError { JarNotFound, ConfigInvalid, JavaUnavailable }`)、resolver の `Result<T, Error>` 相当の契約、Java availability の検査タイミング (起動時 / 初回描画時 / 描画失敗時のメッセージ生成時) を Phase 3 で確定し、設計書または `docs/components/<viewer>/interface_spec.md` への反映予定に含める。
**severity**: Low
**対応**: 未対応

### 2.4 ADR 候補化の判断記録

**不足**: 「ローカル CLI を呼び出してドキュメント表示の一部を生成する」判断は、再利用可能性のある横断判断 (将来 Graphviz/dot や他のローカル CLI を呼ぶ拡張で同じトレードオフが発生する) で、`docs/adr/README.md` §2 の起票条件のうち「複数案件で再利用される可能性が高い」「誤ると同種の設計ミスを繰り返しやすい」の二つに触れる。設計書「リスクと follow-up」にこの ADR 候補化の判断記録がない。
**推奨対応**: ADR 化が必要かを Phase 3 もしくは Phase 4 で改めて判定する旨を follow-up に追記する。今すぐ ADR を起票する必要はないが、判断記録がないと将来の類似機能 (例: Graphviz, kroki cli, 他の図形 CLI) で同じ議論を繰り返す。
**severity**: Low
**対応**: 未対応

---

## 3. 改善提案

### 3.1 PlantUML SVG の defense-in-depth

**推奨対応**: 設計書「セキュリティと sanitization」に、PlantUML 出力 SVG に対する追加防御 (例: `<script>` / `on*` 属性の除去、もしくは `<svg>` を `<iframe srcdoc>` で隔離) の採否を明記する。今回はローカル PlantUML から生成された SVG を信頼する設計だが、PlantUML がカスタム HTML を埋め込む `<text>`/`<a>` パターンを将来追加した場合や、ローカルとはいえユーザが第三者の Markdown を開くケースを考慮し、防御を採用しないなら理由を、採用するなら境界 (Avalonia / Tauri 共通の sanitizer 層) を残す。
**severity**: Low
**対応**: 未対応

### 3.2 PlantUML / Java バージョンの記録

**推奨対応**: 「ローカル環境では `openjdk 24.0.2`」(design 7 行) とあるが、PlantUML 側の動作確認バージョンが書かれていない。Phase 3 で動作確認した PlantUML のバージョン (例: `plantuml-1.2024.3.jar`) を恒久ドキュメント `docs/rules/development_workflow.md` のセットアップ節へ「動作確認済み」として明示すると、jar 入れ替え時の再現性が上がる。設計書の「リスクと follow-up」または「テスト・ユーザ確認観点」へ「動作確認した PlantUML バージョンを `development_workflow.md` に記載する」を追加する。
**severity**: Low
**対応**: 未対応

### 3.3 Tauri command 失敗時のエラー対応箇所

**推奨対応**: 設計書「エラー動作」(design 166-175 行) は inline error と既存 status / error banner の両方に出すと書いているが、Tauri 側の既存 banner (`src/App.tsx` の `setErrorMessage`) は単一文字列を持つ。複数図で同時に解決エラーが出た場合に最初のメッセージで上書きされる挙動と整合するか、Phase 3 で確認する旨を残す。Avalonia 側 (`StatusMessage`) も同じ前提。「resolver 全体のエラーは各 fence にインライン + banner 1 件」で十分か、複数 fence の同時失敗を 1 件にまとめる前提かを明記する。
**severity**: Low
**対応**: 未対応

### 3.4 stdout encoding と大規模 SVG

**推奨対応**: PlantUML CLI は UTF-8 で SVG を stdout に出力する。`Process.StandardOutput` (C#) / `Command::output()` (Rust) が UTF-8 で解釈する設定 (C# 側は `StandardOutputEncoding = Encoding.UTF8`) を明示しておくと、地域別 default encoding によるバグを防げる。「設計方針 / プロセス実行」へ 1 行追加する程度の改善。
**severity**: Low
**対応**: 未対応

---

## 4. 整合性確認済み項目

| 項目 | 確認結果 |
|------|----------|
| ` ```plantuml ` / ` ```puml ` を対象とする旨が `docs/todo/todo.md` の受け入れ条件と一致 | ✓ 整合 |
| `plantuml.jar` をコミット対象に含めない方針が `.gitignore` 追加予定に反映されている | ✓ 整合 (粒度は 2.1 参照) |
| Avalonia は `Services/` 配下に新規 Service を追加、Tauri は Rust command 側で実行する分担が `docs/rules/language_rules.md` および `docs/architecture/code_patterns.md` と整合 | ✓ 整合 |
| `java -jar <plantuml.jar> -tsvg -pipe` を arg-array で起動し shell 展開を通さない方針 | ✓ 整合 (review_checkpoints.md §3 安全性) |
| timeout 10 秒 / 順次実行で 1 図あたりのコストとエラー対応の単純さを優先 | ✓ 整合 (review_checkpoints.md §4) |
| SVG のみに出力を限定し、PNG / base64 を非対象とする | ✓ 整合 |
| ネットワーク server を使わない / Markdown 本文から jar path を推定しない | ✓ 整合 (review_checkpoints.md §3) |
| Mermaid 既存経路、theme 切替、reload、ローカル画像、リンク遷移を維持する後方互換要件 | ✓ 整合 |
| 恒久ドキュメント更新予定先 (`docs/architecture/overview.md` / `code_patterns.md` / `common_pitfalls.md` と `docs/components/<viewer>/`) が並ぶ | ✓ 整合 |
| 設計書本文が日本語、UI / エラー文字列が英語で `docs/rules/language_rules.md` を満たす | ✓ 整合 |
| 検証コマンド (`dotnet build` / `npm run build` / `cargo check` / `cargo fmt -- --check`) が `docs/rules/development_workflow.md` と一致 | ✓ 整合 |
| follow-up に diagram cache / dark-mode option / 設定 UI / version 確認 command を切り出している | ✓ 整合 |

---

## 5. 対応優先度

| 優先度 | 項目 | 理由 |
|--------|------|------|
| 高 | 1.1 `MarkdownRenderService` 非同期化の契約 | Phase 3 着手時に最初にぶつかる公開 API 変更で、責務分割が定まらないと共通化判断ができない |
| 高 | 1.2 Tauri 側の境界選択 | React / Rust の責務境界に直接影響し、二案併記のまま実装に入ると後戻りが発生する |
| 中 | 1.3 Tauri runtime directory の具体化 | `.app` 起動時の cwd 想定がずれると jar 解決の手動確認が再現しない |
| 中 | 1.4 Theme 切替時の再レンダリング挙動 | UX 体感に直結し、cache follow-up を先送りする前に挙動を確定する必要がある |
| 低 | 2.1 `.gitignore` 追加パターン | 実装と同時に決定可能だが、設計合意に含めておく方が後段で差し戻されにくい |
| 低 | 2.2 サンプル Markdown 配置先 | Phase 3 で確定すれば足りる |
| 低 | 2.3 `PlantUmlRuntimeOptions` 契約と Java pre-check | 設計時点で型と error 種別を決めておくと実装が単純化する |
| 低 | 2.4 ADR 候補化の判断記録 | follow-up に残す形でよい |
| 低 | 3.1 SVG defense-in-depth | 信頼境界の根拠を文書化する |
| 低 | 3.2 PlantUML バージョン記録 | 再現性向上のための小改善 |
| 低 | 3.3 Tauri banner との同時失敗整合 | エッジケースだが要件として明示する価値あり |
| 低 | 3.4 stdout encoding 明示 | 1 行で実装ミスの可能性を減らせる |

---

## 6. 結論

設計は受け入れ条件と非対象、`plantuml.jar` の非コミット方針、Avalonia/Tauri の責務境界、CLI 実行 / timeout / エラー表示 / セキュリティの主要観点を網羅しており、骨格として十分に妥当である。特に以下はユーザ指定の重点観点に照らしても問題がない。

- `plantuml.jar` をコミット対象に含めず、runtime directory + `plantuml.config.json` で解決する設計の妥当性: 妥当 (config 不在時 `plantuml.jar` を runtime dir で探す決定的 fallback と、相対 path を config dir 基準で解決するルールが明確)。
- Avalonia と Tauri の責務境界: 既存アーキテクチャ (Avalonia は `Services/` 配下に Service、Tauri は Rust command を OS 境界として扱う) と整合する。
- PlantUML CLI 実行 / timeout / エラー表示 / SVG 埋め込み / セキュリティ: 仕様が明示され、shell 展開を通さない、Markdown から jar path を推定しない、stderr / exit code を捕捉する、エラーを inline + banner に出す、SVG のみに限定する、といった安全寄りの決定がそろっている。

一方で、Phase 3 実装に入る前に「中」優先度の 4 件 (1.1 非同期 API、1.2 Tauri 境界、1.3 Tauri runtime dir、1.4 theme 切替) は設計書側で確定させることを推奨する。これらを未確定のまま Phase 3 に進むと、`MarkdownRenderService` の責務分割、React / Rust の責務境界、UX の体感性能、jar 解決の再現性のいずれかで手戻りが発生する可能性が高い。

判定: **条件付き承認**。
- 1.1 / 1.2 / 1.3 / 1.4 の 4 点を設計書または `meta.md` の design 側へ追記し、`design_status` を `done` に切り替えた段階で Phase 3 への進行を承認する。
- 「低」優先度の指摘 (2.1〜2.4、3.1〜3.4) は Phase 3 着手時に併せて反映してよい。Phase 3 で対応する場合は、設計書ではなく `docs/components/<viewer>/detail_design.md` や `docs/rules/development_workflow.md` への反映で構わない。

レビューに伴う未解決指摘は本文書の通り。承認は中優先度 4 件の反映完了を前提条件とする。
