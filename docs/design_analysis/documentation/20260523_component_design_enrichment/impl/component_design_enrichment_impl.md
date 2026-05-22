# Avalonia / Tauri Viewer component design docs enrichment 実装記録

## 実際に更新した文書

| パス | 主な変更 |
|---|---|
| [docs/components/avalonia_viewer/README.md](docs/components/avalonia_viewer/README.md) | 技術スタック表、ディレクトリ構成、主要要素テーブル（ソース対応リンク付き）を追記 |
| [docs/components/avalonia_viewer/basic_design.md](docs/components/avalonia_viewer/basic_design.md) | レイヤー構成（component 図）、依存パッケージ図、状態モデル（state 図）を PlantUML で追加 |
| [docs/components/avalonia_viewer/detail_design.md](docs/components/avalonia_viewer/detail_design.md) | 状態管理テーブル、クラス図、Open Folder→Preview の sequence 図、PlantUML レンダリング sequence 図、runtime 解決 activity 図、WebMessage / UI レイアウトの整理を追記 |
| [docs/components/tauri_viewer/README.md](docs/components/tauri_viewer/README.md) | 技術スタック表、ディレクトリ構成、主要要素テーブル（ソース対応リンク付き）を追記 |
| [docs/components/tauri_viewer/basic_design.md](docs/components/tauri_viewer/basic_design.md) | コンポーネント図、依存パッケージ図、状態モデル、Tauri 設定要点を追記 |
| [docs/components/tauri_viewer/detail_design.md](docs/components/tauri_viewer/detail_design.md) | 状態テーブル、フロント/Rust モジュール図、処理フロー sequence 図、PlantUML レンダリング sequence 図、runtime 解決 activity 図、scan_directory 処理図、エラーハンドリング表、UI レイアウトを追記 |

## 移動、削除、統合した文書

なし。すべて既存ファイルへの追記中心。`interface_spec.md` / `issues.md` は触らず、構成変更も行っていない。

## リンク、索引、参照元、archive、履歴の整合結果

- `docs/components/<viewer>/README.md` から `basic_design.md` / `detail_design.md` / `interface_spec.md` / `issues.md` への既存リンクは維持。
- 各 README からソースコードへの相対リンク（VSCode 拡張のルールに従う workspace root 相対）を追加。CLAUDE.md / VSCode 拡張ルール準拠。
- 他 docs (`docs/architecture/` / `docs/design_analysis/`) からの本コンポーネント文書への参照は変更なし（grep で外部参照は本 documentation topic の `meta.md` のみ）。
- archive / history への影響なし。テンプレート利用者・運用者へ影響しない docs-only 変更であり、`docs/history/README.md` への追記は不要と判断。

## 実行した文書検証

- `ls docs/components/avalonia_viewer/ docs/components/tauri_viewer/` で対象ファイルの存在を確認。
- 各 README / detail_design.md で参照しているソースパスを `test -f` で全件存在確認（Avalonia: Program.cs / App.axaml.cs / MainWindow.axaml / MainWindowViewModel.cs / FileTreeNodeViewModel.cs / FileTreeService.cs / MarkdownRenderService.cs / PlantUmlRenderService.cs / PlantUmlRuntimeResolver.cs / HtmlTemplateService.cs / FileTreeNode.cs。Tauri: main.tsx / App.tsx / App.css / lib.rs / tauri.conf.json / capabilities/default.json / Cargo.toml / package.json）。
- `grep` で各 markdown 文書の fence （`` ``` `` ）開閉数を確認し、PlantUML / text fence の対が揃っていることを確認。
- `grep` で他 docs からの `avalonia_viewer` / `tauri_viewer` 参照を洗い出し、本 documentation topic の `meta.md` 以外には外部参照が無いことを確認。

## ソース変更を含まないことの確認

- 変更した extension: `.md` のみ。
- `git diff --stat` で `docs/` 配下と `docs/design_analysis/documentation/...` 配下のみが変更されることを確認。
- `Avalonia/` / `markdown-viewer-tauri/` / `scripts/` / `instructions/` 等のコード・設定は変更しない。

## レビュー方針

- 構成変更や archive を伴わない、既存文書への追記中心の更新であり、design / impl review は `design/component_design_enrichment_design.md` の方針に従い省略する。
- 用語整合・リンク検証・PlantUML fence の妥当性は本 impl 内の検証で担保。
