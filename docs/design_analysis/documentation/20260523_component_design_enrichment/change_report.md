# Component design docs enrichment change report

## 変更概要

`docs/components/avalonia_viewer/` と `docs/components/tauri_viewer/` 配下の `README.md` / `basic_design.md` / `detail_design.md` を、技術スタック・ディレクトリ構成・ソースコード対応・PlantUML 図で視覚的に仕様を把握できる形へ拡充した。`interface_spec.md` / `issues.md` および他コンポーネント・ソースコードは変更していない。

## 更新した文書一覧

- [docs/components/avalonia_viewer/README.md](docs/components/avalonia_viewer/README.md)
- [docs/components/avalonia_viewer/basic_design.md](docs/components/avalonia_viewer/basic_design.md)
- [docs/components/avalonia_viewer/detail_design.md](docs/components/avalonia_viewer/detail_design.md)
- [docs/components/tauri_viewer/README.md](docs/components/tauri_viewer/README.md)
- [docs/components/tauri_viewer/basic_design.md](docs/components/tauri_viewer/basic_design.md)
- [docs/components/tauri_viewer/detail_design.md](docs/components/tauri_viewer/detail_design.md)
- [docs/design_analysis/documentation/20260523_component_design_enrichment/meta.md](docs/design_analysis/documentation/20260523_component_design_enrichment/meta.md)
- [docs/design_analysis/documentation/20260523_component_design_enrichment/design/component_design_enrichment_design.md](docs/design_analysis/documentation/20260523_component_design_enrichment/design/component_design_enrichment_design.md)
- [docs/design_analysis/documentation/20260523_component_design_enrichment/impl/component_design_enrichment_impl.md](docs/design_analysis/documentation/20260523_component_design_enrichment/impl/component_design_enrichment_impl.md)

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

- `ls docs/components/avalonia_viewer/ docs/components/tauri_viewer/`
- `test -f` で各 README / detail_design で参照する Avalonia / Tauri のソースパスを全件存在確認
- `grep -n` でドキュメント内の fence 開閉と PlantUML ブロックの整合を確認
- `grep -rn` で他 docs から `avalonia_viewer` / `tauri_viewer` への外部参照を洗い出し、本 documentation topic の `meta.md` 以外には外部参照が無いことを確認
- `git status --short` で `.md` のみが変更対象であることを確認

## docs-only 判定と `diff.zip` 非作成理由

- 変更ファイルはすべて `.md`。`Avalonia/` 配下の C# / XAML、`markdown-viewer-tauri/` 配下の TypeScript / Rust / 設定ファイル、`scripts/` 等のテンプレート、`instructions/` 配下の sync source は一切変更していない。
- 仕様・挙動・runtime asset の変更を伴わないため、documentation-workflow の禁止事項に従い `diff.zip` を作成しない。

## 関連コミット

- `1932d3f docs: scaffold component design enrichment workspace`
- `2e325ef docs: capture component design enrichment plan`
- `9b5e668 docs: enrich Avalonia / Tauri viewer component design docs`
