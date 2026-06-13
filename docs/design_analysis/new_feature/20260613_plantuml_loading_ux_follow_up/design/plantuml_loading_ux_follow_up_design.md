# PlantUML Loading UX Follow-up 設計

## 背景・要求・完了条件

`TODO-2026-002 PlantUML Loading UX Follow-up` は、先行して追加された
PlantUML 表示機能について、読み込み中 UX をより明確にするための
追補である。元の実装では、Tauri 側の pending placeholder が
`.plantuml-error` と同じ見た目を使っており、まだ描画中なのか、最終的に
失敗したのかが区別しづらかった。加えて、Avalonia / Tauri の双方で
読み込み中に重複操作を許すと、レンダリングの重なりや stale preview の
温床になる懸念があった。

本 follow-up の完了条件は次のとおり。

- Avalonia で `IsBusy=true` の間、Open Folder / Theme / Reload / Explorer の
  操作が無効化される。
- Avalonia の loading overlay はプレビューを完全に塗りつぶさず、状態を
  読み取りやすい semi-transparent 表示になる。
- Tauri の PlantUML pending state は `.plantuml-loading` で表示され、
  `.plantuml-error` と視覚的に区別される。
- Tauri で Markdown 読み込み中と PlantUML 描画中の busy state が明示され、
  Toolbar / Explorer の重複操作が抑止される。
- 変更内容が component detail design と README に反映される。
- `docs/rules/development_workflow.md` で要求される build / check が通る。

## 対象範囲と非対象

対象:

- Avalonia MainWindow の busy 中操作制御。
- Avalonia loading overlay の視認性改善。
- Tauri の aggregate busy-state 表示と操作抑止。
- Tauri の pending placeholder 専用スタイル追加。
- 関連 component docs の更新。

非対象:

- PlantUML renderer のアルゴリズム変更。
- PlantUML timeout や runtime resolver の仕様変更。
- busy 中キャンセル機能の追加。
- Mermaid 描画フローの設計変更。
- completion artifact (`change_report.md` / `diff.zip`) 作成。

## 採用案

既存の描画フローは維持し、UI 側で busy-state と pending-state の表現だけを
明確化する。

- Avalonia は既存の `IsBusy` を唯一の制御点として利用し、XAML binding で
  Toolbar と Explorer を無効化する。
- Avalonia overlay は `IsBusy` と連動したまま、背景色だけを薄い半透明へ
  変える。
- Tauri は `isMarkdownLoading || isPlantUmlRendering` を aggregate busy-state
  として扱い、Toolbar / Explorer の両方へ同じ制御をかける。
- Tauri の pending placeholder は `.plantuml-loading` へ分離し、最終 failure
  だけが `.plantuml-error` を使う。
- loading banner は Markdown と PlantUML の状態を単純な分岐で統合する。

この案であれば、既存の render pipeline や service 境界を崩さずに、課題の
中心である UX の誤認だけを局所的に解消できる。

## 不採用案

### busy 中キャンセルを追加する

follow-up の要求は「重複操作を避ける」ことであり、操作キャンセルまで入れると
ViewModel / React state / renderer の責務が広がるため今回は不採用とする。

### PlantUML pending と error を文言だけで区別する

pending 中の見た目が error と同一だと、文言を読まない限り区別できない。
視認性改善が主目的なので不採用とする。

### Markdown loading と PlantUML rendering を完全に別 UI にする

別々の表示系を維持すると busy 制御も二重化しやすい。今回は aggregate busy を
導入し、表示文言のみ状態に応じて切り替える。

## Before / After

Before:

- Tauri の pending placeholder は error と同じ見た目だった。
- Tauri では Markdown 読み込み中と PlantUML 描画中が別扱いで、複数操作の
  抑止が UI 全体では揃っていなかった。
- Avalonia では `IsBusy` 表示はあるが、Toolbar / Explorer の抑止と overlay
  の見え方に改善余地があった。

After:

- Tauri の pending state は `.plantuml-loading` として明示される。
- Tauri の busy 中は Open Folder / Theme / Reload / file selection を抑止する。
- Avalonia の busy 中は Toolbar / Explorer を無効化する。
- Avalonia overlay はプレビュー内容を完全には隠さない。

## 影響範囲

Avalonia:

- [Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml](../../../../../Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml)

Tauri:

- [markdown-viewer-tauri/src/App.tsx](../../../../../markdown-viewer-tauri/src/App.tsx)
- [markdown-viewer-tauri/src/App.css](../../../../../markdown-viewer-tauri/src/App.css)

Permanent docs:

- [docs/components/avalonia_viewer/detail_design.md](../../../../components/avalonia_viewer/detail_design.md)
- [docs/components/avalonia_viewer/README.md](../../../../components/avalonia_viewer/README.md)
- [docs/components/tauri_viewer/detail_design.md](../../../../components/tauri_viewer/detail_design.md)
- [docs/components/tauri_viewer/README.md](../../../../components/tauri_viewer/README.md)

## 設計方針

### Avalonia

- 新しい busy state を増やさず、既存の `IsBusy` を UI 制御にも再利用する。
- Button / TreeView の `IsEnabled` binding で重複操作を止める。
- overlay は loading を示しつつ、元のプレビュー内容が透けて見える程度の
  半透明色にする。

### Tauri

- busy 判定は `isMarkdownLoading` と `isPlantUmlRendering` の OR に限定する。
- busy 中に新しい操作を開始しないガードを、Open Folder / Reload /
  `loadMarkdown` に入れる。
- Tree 選択も `disabled` 伝播で止め、見た目と実際の動作を一致させる。
- pending HTML fallback も `.plantuml-loading` に揃え、描画前後で class が
  一貫するようにする。

## 互換性・移行方針

既存の Markdown / Mermaid / PlantUML の表示契約は変えない。busy 中に受け付ける
操作だけを制限するため、通常操作の導線変更はない。テーマ切替や Reload も、
busy でない時の動作は従来どおり維持する。

## 恒久ドキュメント更新予定先

- [docs/components/avalonia_viewer/detail_design.md](../../../../components/avalonia_viewer/detail_design.md)
- [docs/components/avalonia_viewer/README.md](../../../../components/avalonia_viewer/README.md)
- [docs/components/tauri_viewer/detail_design.md](../../../../components/tauri_viewer/detail_design.md)
- [docs/components/tauri_viewer/README.md](../../../../components/tauri_viewer/README.md)

## テスト・ユーザ確認観点

自動確認:

- `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`
- `npm run build` in `markdown-viewer-tauri/`
- `cargo check` in `markdown-viewer-tauri/src-tauri/`

手動確認:

- PlantUML を含む Markdown を開き、pending state が error と誤認されないこと。
- busy 中に Open Folder / Theme / Reload / Explorer 選択が抑止されること。
- busy 終了後に通常操作へ復帰すること。
- Avalonia overlay が過度に視認性を損なわないこと。

## リスクと follow-up

リスク:

- busy 中に操作を完全無効化するため、長時間レンダリングでは待機しかできない。
- Tauri の loading message は aggregate 表示なので、個別図ごとの進捗までは
  表現しない。

follow-up:

- 必要になれば busy 中キャンセル、または queue / 最新選択優先の制御を別課題で
  検討する。
- 手動確認で overlay の見え方が悪い場合は、opacity と blur を再調整する。

## レビュー方針

今回は変更規模が小さく、実装が先行しているため、Phase 2 と Phase 3 の観点を
まとめた一括レビューを行う。reviewer には設計妥当性、実装差分、恒久 docs、
build/check 結果を同じ topic として確認してもらう。
