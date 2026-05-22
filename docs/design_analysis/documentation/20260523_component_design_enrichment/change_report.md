# Component design docs enrichment change report

## 変更概要

`docs/components/avalonia_viewer/` と `docs/components/tauri_viewer/` 配下の `README.md` / `basic_design.md` / `detail_design.md` を、技術スタック・ディレクトリ構成・ソースコード対応・PlantUML 図で視覚的に仕様を把握できる形へ拡充した。`interface_spec.md` / `issues.md` および他コンポーネント・ソースコードは変更していない。

## 更新した文書一覧

- [docs/components/avalonia_viewer/README.md](../../../components/avalonia_viewer/README.md)
- [docs/components/avalonia_viewer/basic_design.md](../../../components/avalonia_viewer/basic_design.md)
- [docs/components/avalonia_viewer/detail_design.md](../../../components/avalonia_viewer/detail_design.md)
- [docs/components/tauri_viewer/README.md](../../../components/tauri_viewer/README.md)
- [docs/components/tauri_viewer/basic_design.md](../../../components/tauri_viewer/basic_design.md)
- [docs/components/tauri_viewer/detail_design.md](../../../components/tauri_viewer/detail_design.md)
- [meta.md](meta.md)
- [design/component_design_enrichment_design.md](design/component_design_enrichment_design.md)
- [impl/component_design_enrichment_impl.md](impl/component_design_enrichment_impl.md)

## 追加した主な PlantUML 図

| 文書 | 図種 | 主な内容 |
|---|---|---|
| Avalonia basic_design | component | View / ViewModels / Services / Models / External の責務分離 |
| Avalonia basic_design | package (component) | 依存パッケージ図 (Avalonia stack / Markdig / PlantUML runtime) |
| Avalonia basic_design | state | Idle / Scanning / Ready / Rendering / Error |
| Avalonia detail_design | class | ViewModels / Services (interface + 実装) / Models |
| Avalonia detail_design | sequence | Open Folder → Preview |
| Avalonia detail_design | sequence | MarkdownRenderService ↔ PlantUmlRenderService ↔ Java |
| Avalonia detail_design | activity | PlantUML runtime 解決 |
| Tauri basic_design | component | Frontend / Tauri JS API / Runtime / Rust backend / External |
| Tauri basic_design | package | Frontend / Rust crates / PlantUML runtime 依存 |
| Tauri basic_design | state | NoRoot / HasRoot / MarkdownLoading / PlantUmlPending / Error |
| Tauri detail_design | class/module | App / Toolbar / FileTree / MarkdownPreview / TS helpers / Tauri JS API / Rust commands |
| Tauri detail_design | sequence | Open Folder → Preview |
| Tauri detail_design | sequence | render_plantuml_diagrams (spawn_blocking → java) |
| Tauri detail_design | activity | PlantUML runtime 解決 (macOS bundle / debug 分岐) |
| Tauri detail_design | activity | scan_directory のフロー |

## 削除、移動、統合した文書

なし。

## 実行した確認コマンド

- `ls docs/components/avalonia_viewer/ docs/components/tauri_viewer/` で対象ファイルの存在を確認。
- `test -f` で各 README / detail_design で参照する Avalonia / Tauri のソースパスを workspace root 基準で全件存在確認。
- `grep -n` でドキュメント内の fence 開閉と PlantUML ブロックの整合を確認。
- `plantuml.jar -tsvg -pipe` で対象 4 文書中の全 15 個の PlantUML ブロックをレンダリングし、Syntax Error が出ないことを確認。
- `grep -rn` で他 docs から `avalonia_viewer` / `tauri_viewer` への参照を洗い出し、README を指す既存参照（`docs/architecture/overview.md` / `docs/rules/project_overview.md` / 既存の `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/`）を識別。今回の拡充は README の見出し・配置・ファイル名を変更しないため、参照側の更新は不要と判断。
- 各 Markdown 内のリンクをファイル位置基準で resolve し、リンク先のファイルが存在することを Python スクリプトで全件確認。対象は本拡充で追加・修正した相対リンクのみ。
- `git status --short` で `.md` のみが変更対象であることを確認。

## docs-only 判定と `diff.zip` 非作成理由

- 変更ファイルはすべて `.md`。`Avalonia/` 配下の C# / XAML、`markdown-viewer-tauri/` 配下の TypeScript / Rust / 設定ファイル、`scripts/` 等のテンプレート、`instructions/` 配下の sync source は一切変更していない。
- 仕様・挙動・runtime asset の変更を伴わないため、documentation-workflow の禁止事項に従い `diff.zip` を作成しない。

## 関連コミット

- `1932d3f docs: scaffold component design enrichment workspace`
- `2e325ef docs: capture component design enrichment plan`
- `9b5e668 docs: enrich Avalonia / Tauri viewer component design docs`
- `7f21a62 docs: fix PlantUML enum syntax in Avalonia class diagram`
- レビュー指摘対応: README / change_report / impl の Markdown リンクをファイル位置基準へ修正、外部参照記録を更新（本コミット）。
