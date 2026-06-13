# PlantUML Loading UX Follow-up 実装記録

## 対象

- TODO: `TODO-2026-002 PlantUML Loading UX Follow-up`
- Design: `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/design/plantuml_loading_ux_follow_up_design.md`
- Upstream context:
  `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/review/plantuml_rendering_support_impl_review.md`
  section 9.

## 実装方針との差分評価

本 topic は実装先行の retrospective backfill である。現時点の差分を確認した結果、
実装は設計意図と整合しており、追加のコード修正が必須となる不整合は確認していない。
そのため、本 Phase 3 では実装差分の記録と検証結果の整理を主対象とする。

## 実装差分

### Avalonia

- [Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml](../../../../../Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml)
  で Open Folder / Theme / Reload に `IsEnabled="{Binding !IsBusy}"` を追加した。
- 同ファイルの Explorer `TreeView` にも `IsEnabled="{Binding !IsBusy}"` を追加し、
  busy 中のファイル切替を防いだ。
- loading overlay の背景を semi-transparent な `#00000018` に変更し、状態を
  示しつつプレビュー内容の視認性を残した。

### Tauri

- [markdown-viewer-tauri/src/App.tsx](../../../../../markdown-viewer-tauri/src/App.tsx)
  に `isBusy = isMarkdownLoading || isPlantUmlRendering` を追加した。
- `openFolder` / `reload` / `loadMarkdown` に busy guard を入れ、重複操作を開始
  しないようにした。
- Toolbar に `isBusy` を渡し、Open Folder / Theme / Reload を busy 中は disable
  するようにした。
- Explorer 側は `disabled` prop を TreeNode まで伝播し、busy 中の Markdown 選択を
  止めた。
- pending placeholder は `.plantuml-error` から `.plantuml-loading` へ変更し、
  loading banner は Markdown / PlantUML の状態を統合した文言で表示する。

### Styling / Docs

- [markdown-viewer-tauri/src/App.css](../../../../../markdown-viewer-tauri/src/App.css)
  に `.plantuml-loading` 用の accent 色スタイルを追加した。
- component README / detail design に pending state と busy-state 制御の仕様を
  反映した。

## 恒久ドキュメント反映

- [docs/components/avalonia_viewer/detail_design.md](../../../../components/avalonia_viewer/detail_design.md)
- [docs/components/avalonia_viewer/README.md](../../../../components/avalonia_viewer/README.md)
- [docs/components/tauri_viewer/detail_design.md](../../../../components/tauri_viewer/detail_design.md)
- [docs/components/tauri_viewer/README.md](../../../../components/tauri_viewer/README.md)

反映内容:

- Tauri の aggregate busy-state と `.plantuml-loading` の導入。
- Avalonia の busy 中操作抑止と semi-transparent overlay。

## コード妥当性判断

受け入れ条件に照らすと、現在の差分は次を満たしている。

- Busy-state controls cannot cause confusing overlapping renders or stale
  preview updates.
  理由: Avalonia は Button / Explorer を `IsBusy` に束ね、Tauri は Toolbar と
  Tree selection の両方を `isBusy` に統一している。
- Pending PlantUML content is visually distinct from final PlantUML errors.
  理由: Tauri は `.plantuml-loading` と `.plantuml-error` を分離した。
- Loading state behavior is documented in the relevant component detail design.
  理由: Avalonia / Tauri の detail design と README を更新済み。
- Avalonia build, Tauri frontend build, and Tauri Rust check complete after the
  change.
  理由: 下記の検証結果で確認済み。

現時点で追加修正が必要な明確な不具合は見つかっていない。

## 検証結果

`docs/rules/development_workflow.md` に従い、以下を実行した。

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`
  : 成功。
- `npm run build` in `markdown-viewer-tauri/` : 成功。
  Vite の chunk size warning は出るが build は成功。
- `cargo check` in `markdown-viewer-tauri/src-tauri/` : 成功。

補足:

- VS Code の file diagnostics では、変更した code / XAML / TODO に新規 error は
  出ていない。
- `markdownlint-cli2` を変更した component docs に対して直接実行すると、既存の
  80 桁制限由来の MD013 が多数残る。これは今回の UX 機能要件とは別系統の
  ドキュメント整形課題であり、project の必須検証コマンドにも含まれていない。

## レビュー依頼のまとめ方

変更規模が局所的なため、review では以下を 1 本の topic としてまとめて確認する。

- design の妥当性
- landed implementation の整合性
- component docs の反映漏れ有無
- build/check 結果

review 文書は `review/plantuml_loading_ux_follow_up_impl_review.md` を主とし、
設計観点も同一レビューで扱う前提とする。
