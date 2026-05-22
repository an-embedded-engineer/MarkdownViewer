# Component design docs enrichment 実装レビュー

**レビュー日**: 2026-05-23
**対象工程**: impl
**対象ドキュメント**:

- `docs/design_analysis/documentation/20260523_component_design_enrichment/change_report.md`
- `docs/design_analysis/documentation/20260523_component_design_enrichment/impl/component_design_enrichment_impl.md`
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/basic_design.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`

**対象実装**:

- `Avalonia/MarkdownViewer.Avalonia/`
- `markdown-viewer-tauri/`

---

## 概要

`docs/components/avalonia_viewer/` と `docs/components/tauri_viewer/` の拡充内容について、実装との仕様整合、リンク整合、PlantUML fence 形式、レビュー記録の妥当性を確認した。

---

## 1. 齟齬・不整合

### 1.1 README と change_report / impl の Markdown リンクが文書位置基準では解決できない

**重大度**: High
**優先度**: 高
**工程分類**: impl
**ステータス**: 対応済み（2026-05-23, `5511fbc8e2f799ad2cf8b2e13af737d0ae34087d`）

**ドキュメント記載**:

- `docs/components/avalonia_viewer/README.md:61-71` は `Avalonia/MarkdownViewer.Avalonia/...` をリンク先にしている。
- `docs/components/avalonia_viewer/README.md:83-86` は `docs/components/avalonia_viewer/...` をリンク先にしている。
- `docs/components/tauri_viewer/README.md:56-65` は `markdown-viewer-tauri/...` をリンク先にしている。
- `docs/components/tauri_viewer/README.md:77-80` は `docs/components/tauri_viewer/...` をリンク先にしている。
- `change_report.md:9-17` と `impl/component_design_enrichment_impl.md:7-12` も workspace root 相当のリンクをそのまま Markdown リンクとして記載している。
- `impl/component_design_enrichment_impl.md:20-21` は「既存リンクは維持」「workspace root 相対リンクを追加」としている。

**実装 / 表示仕様**:

- Tauri は `resolveSiblingPath(selectedFilePath, href)` で相対リンクを現在の Markdown ファイルのディレクトリ基準に解決する。
- Avalonia は `HtmlTemplateService.BuildHtmlDocument` で表示中 Markdown のディレクトリを `<base href>` に設定し、WebView 内リンクをその基準で解決する。

**差異**:

通常の Markdown 解決、および本プロジェクトの両 Viewer 実装では、相対リンクは表示中 Markdown ファイルの配置ディレクトリ基準で解決される。現在のリンクは workspace root 相対として書かれているため、例えば `docs/components/avalonia_viewer/README.md` 内の `Avalonia/MarkdownViewer.Avalonia/Program.cs` は `docs/components/avalonia_viewer/Avalonia/MarkdownViewer.Avalonia/Program.cs` として解釈される。

同様に `README.md` から `basic_design.md` へのリンクも `docs/components/avalonia_viewer/docs/components/avalonia_viewer/basic_design.md` のように解決される。これにより、拡充目的である「ソースコード対応表から該当箇所を引く」が実際の閲覧導線として機能しない。

**確認結果**:

簡易リンク検証で、対象文書内の相対リンクに少なくとも以下の未解決があった。

| 対象 | 未解決数 |
|---|---:|
| `docs/components/avalonia_viewer/README.md` | 15 |
| `docs/components/tauri_viewer/README.md` | 14 |
| `docs/design_analysis/documentation/20260523_component_design_enrichment/change_report.md` | 9 |
| `docs/design_analysis/documentation/20260523_component_design_enrichment/impl/component_design_enrichment_impl.md` | 6 |

**推奨対応**:

- コンポーネント README からリポジトリ直下のソースへは、文書位置基準で `../../../Avalonia/...` / `../../../markdown-viewer-tauri/...` のように修正する。
- コンポーネント README から同一ディレクトリ内の設計文書へは `basic_design.md` / `detail_design.md` / `interface_spec.md` / `issues.md` に修正する。
- `change_report.md` と `impl/component_design_enrichment_impl.md` から対象文書へは、それぞれのファイル位置からの相対パスに修正する。
- `impl/component_design_enrichment_impl.md` の検証記録は「ファイル存在確認」だけでなく「Markdown リンク解決確認」を実施した記録へ更新する。

**対応**: `docs: fix Markdown links to be file-position-relative (codex review)` で対応済み。コンポーネント README のソースリンクは `../../../Avalonia/...` / `../../../markdown-viewer-tauri/...`、同一ディレクトリ内の設計文書リンクは `basic_design.md` 形式へ修正された。`change_report.md` と `impl/component_design_enrichment_impl.md` のリンクもファイル位置基準へ修正され、検証記録に Markdown リンク解決確認が追加された。

---

### 1.2 外部参照なしの確認結果が現状と一致していない

**重大度**: Medium
**優先度**: 中
**工程分類**: impl
**ステータス**: 対応済み（2026-05-23, `5511fbc8e2f799ad2cf8b2e13af737d0ae34087d`）

**ドキュメント記載**:

- `impl/component_design_enrichment_impl.md:22` は、他 docs からの本コンポーネント文書への参照は本 documentation topic の `meta.md` のみとしている。
- `change_report.md:48` も同趣旨の確認結果を記載している。

**実際の参照**:

- `docs/architecture/overview.md:83-84` に `docs/components/avalonia_viewer/README.md` と `docs/components/tauri_viewer/README.md` への設計文書リファレンスが存在する。

**差異**:

外部参照がないという確認結果は現状と一致しない。今回の文書拡充で README の見出しや配置を壊してはいないため実害は限定的だが、レビュー記録としては検証結果が不正確であり、今後の文書移動・統合判断時に誤った根拠になる。

**推奨対応**:

- `impl/component_design_enrichment_impl.md` と `change_report.md` の記述を、`docs/architecture/overview.md` からの参照を認識した内容へ修正する。
- 参照元が README だけを指しており、今回の拡充でリンク先変更を伴わないため追加更新不要、という判断に置き換える。

**対応**: `impl/component_design_enrichment_impl.md` と `change_report.md` に、`docs/architecture/overview.md` / `docs/rules/project_overview.md` / `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/` 配下からの既存参照が追記された。参照先はいずれも README であり、今回の拡充では README の配置・ファイル名を変更していないため参照側更新不要、という判断に修正済み。

---

## 2. ドキュメント不足

### 2.1 リンク検証基準が「存在確認」と「Markdown 解決確認」で分離されていない

**重大度**: Medium
**優先度**: 中
**工程分類**: impl
**ステータス**: 対応済み（2026-05-23, `5511fbc8e2f799ad2cf8b2e13af737d0ae34087d`）

**不足**:

`impl/component_design_enrichment_impl.md:27-30` と `change_report.md:45-49` は確認コマンドを列挙しているが、`test -f` による workspace root 基準の存在確認と、Markdown ファイル位置基準のリンク解決確認が区別されていない。

**推奨対応**:

- 今回のリンク修正後、文書内 Markdown リンクをファイル位置基準で解決する検証を追加する。
- 検証対象から説明用の例示リンクを除外する条件も記録する。

**対応**: `impl/component_design_enrichment_impl.md` に「ファイル存在確認（workspace root 基準）」と「Markdown リンク解決確認（ファイル位置基準）」が分離して記録された。検証対象外となる例示 inline text path / fenced code block 内 path も明記済み。

---

## 3. 改善提案

### 3.1 レビュー省略理由を docs-only だけに依存させない

**重大度**: Low
**優先度**: 低
**工程分類**: design / impl
**ステータス**: 対応済み（2026-05-23, `5511fbc8e2f799ad2cf8b2e13af737d0ae34087d`）

**推奨対応**:

`design/component_design_enrichment_design.md:61-65` と `impl/component_design_enrichment_impl.md:38-41` は、追記中心の docs-only 変更で design / impl review を省略するとしている。一方、今回の変更はコンポーネント文書の主要導線を増やすため、リンク整合や実装実態との対応確認はレビュー対象に含めた方がよい。

今後は docs-only でも、次のいずれかに該当する場合は軽量レビューを必須にすることを推奨する。

- 既存の索引・リンク・参照導線を追加または変更する。
- 実装ファイルとの対応表を追加する。
- 実装挙動を説明するシーケンス図・状態図を追加する。

**対応**: `impl/component_design_enrichment_impl.md` のレビュー方針へ、索引・リンク・参照導線、実装ファイル対応表、実装挙動図を含む docs-only 変更では軽量レビューを必須にする運用改善方針が追記された。

---

## 4. 整合性確認済み項目

| 項目 | 確認結果 |
|---|---|
| Avalonia の主要クラス / Service 名 | 実装ファイルと概ね整合 |
| Avalonia の PlantUML runtime 解決順 | `PlantUmlRuntimeResolver` の config / jar 探索方針と整合 |
| Avalonia の PlantUML タイムアウト / SVG sanitize | `PlantUmlRenderService` の 10 秒 timeout、script / on* 除去と整合 |
| Tauri の主要 state / command 名 | `App.tsx` / `lib.rs` と概ね整合 |
| Tauri の `scan_directory` 対象拡張子と除外ディレクトリ | `lib.rs` と整合 |
| Tauri の PlantUML `spawn_blocking` / timeout / runtime 解決 | `lib.rs` と整合 |
| PlantUML fence | 対象文書では fenced code block として記載されている |
| ソースコード変更なし | `git status --short` 開始時点で差分なし、レビュー追加前の対象変更は docs-only と判断 |

---

## 5. 対応優先度

| 優先度 | 項目 | 理由 |
|---|---|---|
| 高 | README / change_report / impl の Markdown リンク修正 | 閲覧導線が実際に壊れ、拡充目的に直接影響する |
| 中 | 外部参照なしの確認結果修正 | レビュー記録と現状が不一致で、将来の文書運用判断を誤らせる |
| 中 | リンク検証基準の明記 | 同種のリンク不備の再発防止に必要 |
| 低 | docs-only review 省略基準の見直し | 運用改善。今回の修正完了条件には必須ではない |

---

## 6. 未解決事項 / follow-up

- `docs/components` 配下の Markdown リンクは、本 Viewer 実装と同じ「表示中 Markdown ファイルのディレクトリ基準」に統一する方針で反映済み。
- 追加の未解決指摘なし。

---

## 7. 指摘対応確認（2026-05-23）

**確認対象コミット**: `5511fbc8e2f799ad2cf8b2e13af737d0ae34087d`

**確認結果**:

- 指定コミットは現在の HEAD であり、`git diff 5511fbc8e2f799ad2cf8b2e13af737d0ae34087d` は差分なし。
- `git show 5511fbc8e2f799ad2cf8b2e13af737d0ae34087d` で、前回指摘対象だった README / change_report / impl / design のリンク方針修正を確認。
- 対象 15 Markdown ファイルの相対リンク 44 件をファイル位置基準で解決し、未解決リンク 0 件を確認。
- 対象 15 Markdown ファイルの fenced code block 開閉数を確認し、未閉じ fence 0 件を確認。

**追加指摘**: なし。

---

## 8. 結論

コンポーネント構成、主要クラス、PlantUML レンダリング、Tauri / Avalonia の責務説明は実装と概ね整合している。一方で、追加されたリンクの多くが Markdown ファイル位置基準では解決できず、ドキュメント拡充の主要価値である「設計文書から該当ソースへ辿る」導線が壊れている。

前回指摘は `5511fbc8e2f799ad2cf8b2e13af737d0ae34087d` で対応済み。再レビュー時点で追加指摘はない。
