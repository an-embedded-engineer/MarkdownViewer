# Avalonia / Tauri Viewer component design docs enrichment 実装記録

## 実際に更新した文書

| パス | 主な変更 |
|---|---|
| [docs/components/avalonia_viewer/README.md](../../../../components/avalonia_viewer/README.md) | 技術スタック表、ディレクトリ構成、主要要素テーブル（ソース対応リンク付き）を追記 |
| [docs/components/avalonia_viewer/basic_design.md](../../../../components/avalonia_viewer/basic_design.md) | レイヤー構成（component 図）、依存パッケージ図、状態モデル（state 図）を PlantUML で追加 |
| [docs/components/avalonia_viewer/detail_design.md](../../../../components/avalonia_viewer/detail_design.md) | 状態管理テーブル、クラス図、Open Folder→Preview の sequence 図、PlantUML レンダリング sequence 図、runtime 解決 activity 図、WebMessage / UI レイアウトの整理を追記 |
| [docs/components/tauri_viewer/README.md](../../../../components/tauri_viewer/README.md) | 技術スタック表、ディレクトリ構成、主要要素テーブル（ソース対応リンク付き）を追記 |
| [docs/components/tauri_viewer/basic_design.md](../../../../components/tauri_viewer/basic_design.md) | コンポーネント図、依存パッケージ図、状態モデル、Tauri 設定要点を追記 |
| [docs/components/tauri_viewer/detail_design.md](../../../../components/tauri_viewer/detail_design.md) | 状態テーブル、フロント/Rust モジュール図、処理フロー sequence 図、PlantUML レンダリング sequence 図、runtime 解決 activity 図、scan_directory 処理図、エラーハンドリング表、UI レイアウトを追記 |

## 移動、削除、統合した文書

なし。すべて既存ファイルへの追記中心。`interface_spec.md` / `issues.md` は触らず、構成変更も行っていない。

## リンク、索引、参照元、archive、履歴の整合結果

### リンク方針

本プロジェクトの Markdown Viewer 実装（Avalonia の `HtmlTemplateService.BuildHtmlDocument` による `<base href>` 設定、および Tauri の `resolveSiblingPath`）はいずれも標準 Markdown と同様に「**表示中 Markdown ファイルのディレクトリ基準**」で相対リンクを解決する。VSCode 上の rendering とも齟齬しないよう、本拡充で追加・修正した相対リンクはファイル位置基準で統一する。

### 各ファイルのリンク

- `docs/components/<viewer>/README.md` から同一ディレクトリ内の `basic_design.md` / `detail_design.md` / `interface_spec.md` / `issues.md` へは単純な相対リンク。
- `docs/components/<viewer>/README.md` からリポジトリ直下のソース (`Avalonia/...` / `markdown-viewer-tauri/...`) へは `../../../` 経由のファイル位置基準リンク。
- `docs/design_analysis/documentation/20260523_component_design_enrichment/change_report.md` から `docs/components/` へは `../../../components/...`、同一ディレクトリ内成果物 (`meta.md` / `design/` / `impl/`) へは直接相対パス。
- 本ファイル (`impl/component_design_enrichment_impl.md`) から `docs/components/` へは `../../../../components/...`。

### 外部参照状況

他 docs から本コンポーネント文書への参照は次の通り存在する。今回の拡充では README の見出し・配置・ファイル名を変更していないため、いずれも追加更新は不要。

- `docs/architecture/overview.md`: `docs/components/avalonia_viewer/README.md` と `docs/components/tauri_viewer/README.md` をプレーン text path で参照。
- `docs/rules/project_overview.md`: 同上。
- `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/` 配下: PlantUML 機能追加時の design / impl / review が同じ component 文書を参照（履歴）。

### archive / history

archive / history への影響なし。テンプレート利用者・運用者へ影響しない docs-only 変更であり、`docs/history/README.md` への追記は不要と判断。

## 実行した文書検証

### ファイル存在確認（workspace root 基準）

- `ls docs/components/avalonia_viewer/ docs/components/tauri_viewer/` で対象ファイルの存在を確認。
- 各 README で参照しているソースパスを `test -f` で全件存在確認（Avalonia: Program.cs / App.axaml.cs / MainWindow.axaml / MainWindowViewModel.cs / FileTreeNodeViewModel.cs / FileTreeService.cs / MarkdownRenderService.cs / PlantUmlRenderService.cs / PlantUmlRuntimeResolver.cs / HtmlTemplateService.cs / FileTreeNode.cs。Tauri: main.tsx / App.tsx / App.css / lib.rs / tauri.conf.json / capabilities/default.json / Cargo.toml / package.json）。

### Markdown リンク解決確認（ファイル位置基準）

- 本拡充で追加した README / change_report / impl の Markdown リンクについて、各リンクをそのファイルのディレクトリ基準で `os.path.normpath(os.path.join(dir, target))` 相当で解決し、リンク先のファイルが存在することを Python スクリプトで全件確認。
- 検証対象は本 documentation topic で追加・修正したリンクのみ。例示としての inline text path や fenced code block 内の path は対象外。

### PlantUML fence の妥当性

- `grep -n` で各 markdown 文書の fence の開閉数を確認し、PlantUML / text fence の対が揃っていることを確認。
- 対象 4 文書（Avalonia / Tauri × basic_design / detail_design）に含まれる全 15 個の PlantUML ブロックを `plantuml.jar -tsvg -pipe` でレンダリングし、`Syntax Error` が出ないことを確認。

### 外部参照

- `grep -rn "components/avalonia_viewer\|components/tauri_viewer" docs/ --include="*.md"` で外部参照を洗い出し、`docs/architecture/overview.md`、`docs/rules/project_overview.md`、`docs/design_analysis/new_feature/20260520_plantuml_rendering_support/` 配下のいずれも README を指していること、見出しやファイル名変更を伴わない本拡充では更新不要であることを確認。

## ソース変更を含まないことの確認

- 変更した extension: `.md` のみ。
- `git diff --stat` で `docs/components/` 配下と `docs/design_analysis/documentation/20260523_component_design_enrichment/` 配下のみが変更されることを確認。
- `Avalonia/` / `markdown-viewer-tauri/` / `scripts/` / `instructions/` 等のコード・設定は変更しない。

## レビュー方針

- 構成変更や archive を伴わない、既存文書への追記中心の更新であり、当初 design / impl review を省略する方針としていた。実装レビューを実施した結果、リンク導線の整合不備（workspace-root 相対と file-position 相対の混同）が摘出されたため、本ファイルとして指摘対応を記録する。
- 今後、同種の docs-only 変更でも、(a) 索引・リンク・参照導線の追加 / 変更、(b) 実装ファイルとの対応表の追加、(c) 実装挙動を説明するシーケンス図・状態図の追加、を含む場合は軽量レビューを必須にする運用改善を follow-up とする。
