# PlantUML Loading UX Follow-up 変更レポート

## 対象

- TODO: `TODO-2026-002 PlantUML Loading UX Follow-up`
- Branch: `feature/plantuml-loading-ux-follow-up`
- Base commit: `52b72c98399feccbfa819fa65b78d8663f6d943d`
- Report commit range: `52b72c9..97b24b3`
- 作成日: 2026-06-14

## 変更概要

PlantUML 表示機能の follow-up として、pending / final error の区別と busy 中の
重複操作抑止を Avalonia / Tauri 双方で揃えた。

- Avalonia の Toolbar / Explorer を `IsBusy` 中に無効化した。
- Avalonia の loading overlay を semi-transparent に変更した。
- Tauri に aggregate busy-state と `.plantuml-loading` を追加した。
- busy 中の Open Folder / Theme / Reload / file selection を抑止した。
- component docs に loading UX の仕様を追記した。
- final error-state 確認用に、確実に syntax error となる PlantUML sample を追加した。

## Avalonia 変更

- `Views/MainWindow.axaml` の Open Folder / Theme / Reload に
  `IsEnabled="{Binding !IsBusy}"` を追加した。
- Explorer `TreeView` にも `IsEnabled="{Binding !IsBusy}"` を追加した。
- busy overlay の背景を `#00000018` に変更し、半透明表示へ調整した。

## Tauri 変更

- `src/App.tsx` に `isBusy = isMarkdownLoading || isPlantUmlRendering` を追加した。
- `openFolder` / `reload` / `loadMarkdown` に busy guard を追加した。
- Toolbar buttons と Tree selection に `isBusy` / `disabled` を伝播した。
- pending PlantUML placeholder を `.plantuml-loading` へ変更した。
- loading banner を Markdown / PlantUML の複合状態に応じて切り替えるようにした。

## サンプル・ドキュメント

- `sample_docs/plantuml.md` に syntax error 確認用の invalid PlantUML block を追加した。
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/detail_design.md`
- retrospective workflow artifact として
  `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/`
  配下の `meta.md` / `design/` / `impl/` / `review/` を整備した。

## 検証結果

自動 / コマンド検証:

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`: 成功。
- `npm run build` in `markdown-viewer-tauri/`: 成功。chunk size warning は既存課題として継続。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `printf '@startuml\nclass Foo\nFoo --\n@enduml\n' | java -jar plantuml.jar -tsvg -pipe`: exit code `200`、`Syntax Error? (Assumed diagram type: class)` を確認。

ユーザー確認:

- User confirmed points 1 to 8 of the Phase 4-a loading UX checklist in both Avalonia and Tauri.
- User confirmed the added invalid sample renders as `syntax error` in both viewers and only the target diagram is omitted.

レビュー:

- Phase 2 / 3 combined review: approved in
  `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/review/plantuml_loading_ux_follow_up_impl_review.md`
- Mandatory issues: none.
- Recommendation: clarify in docs that `isBusy` is a derived value in Tauri detail design.

## 生成物

- `diff.zip`: `52b72c9..97b24b3` の差分 patch を zip 化したもの。

## 既知制約

- Tauri detail design の `isBusy` 記述は機能的には正しいが、派生値であることを補足するとより明確。
- `markdownlint-cli2` の MD013 line-length 超過は既存のドキュメント整形課題であり、本 follow-up の必須検証対象外。
