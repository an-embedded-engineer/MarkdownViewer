# Tauri document preview 横幅の可変化 実装記録

## 1. 対象

- TODO: `TODO-2026-021 Tauri document preview 横幅の可変化`
- 設計: `design/tauri_document_preview_responsive_width_design.md`
- 設計レビュー: `review/tauri_document_preview_responsive_width_design_review.md`
- 実装ブランチ: `spec-change/tauri-document-preview-responsive-width`

## 2. 実装概要

Tauri版Markdown本文の固定980px上限を撤去し、preview pane content boxから左右gutterを引いた幅へ追従させた。React DOM、state、event handler、Rust command、HTML iframe、security boundaryは変更していない。

横長contentの手動確認用に`sample_docs/preview_width.md`を追加し、変更後の幅契約をTauri Viewer component docsと開発・手動確認ルールへ同期した。

## 3. 設計差分と実装差分

| 設計項目 | 実装 |
| --- | --- |
| 固定980px上限を撤去 | `App.css`の`.markdown-body`を`width: calc(100% - 48px)`へ置換した。旧`min(980px, ...)`経路は残していない。 |
| 通常左右gutter 24px | `margin: 0 auto`と`calc(100% - 48px)`を維持し、preview pane content boxの残余48pxを左右へ等分する。 |
| viewport 760px以下の左右gutter 14px | 既存media queryの`calc(100% - 28px)`を変更せず維持した。 |
| Markdown子要素契約を維持 | table / pre / Mermaid / PlantUMLの`overflow-x: auto`、image / PlantUML SVGの`max-width: 100%`を変更していない。 |
| HTML iframe全幅を維持 | `.html-preview-frame { width: 100%; }`、iframe DOM、protocol / sandbox / CSPを変更していない。 |
| JavaScript計測を追加しない | `App.tsx`、`explorerPane.ts`、`documentPolicy.ts`を変更していない。 |
| 横長fixture | `sample_docs/preview_width.md`へtable、Mermaid、PlantUML、image、long code lineをまとめた。 |

## 4. 設計レビュー指摘の反映

設計レビュー3.1のLow指摘に従い、次の二つの幅基準を恒久ドキュメントへ明記した。

- 本文widthの`100%`: preview pane content box基準。
- 48pxから28pxへのgutter切替: window viewport 760px基準。

そのためwindow viewportが760px超のままExplorer resizeや将来のsplit viewで個別paneだけが狭くなっても、Markdown左右gutterは24pxのまま切り替わらない。`docs/rules/development_workflow.md`にもこの手動確認観点を追加した。

## 5. 恒久ドキュメント反映

| 文書 | 反映内容 |
| --- | --- |
| `docs/components/tauri_viewer/README.md` | Markdown本文のpane追従とHTML iframe全幅、`App.css`の責務を追記。 |
| `docs/components/tauri_viewer/basic_design.md` | 固定px最大幅を持たないCSS layoutとHTML文書layoutの非上書きを追記。 |
| `docs/components/tauri_viewer/detail_design.md` | box model、gutter値、pane / viewport基準の違い、子要素overflow / scalingを追記。 |
| `docs/components/tauri_viewer/interface_spec.md` | Document Preview表示契約を追加。 |
| `docs/rules/development_workflow.md` | `sample_docs/preview_width.md`を使う広幅・狭幅・Explorer resize・HTML回帰の手動確認を追加。 |

## 6. 互換性

- preview paneが1028px以下の場合、通常幅の計算結果は従来と同じ。
- preview paneが1028pxを超えた場合だけ、Markdown本文が980pxを超えて拡張する。
- window viewport 760px以下の既存responsive layoutは変更していない。
- Explorer width、tab、Reload、Theme、Markdown / HTML open、Preview scrollのstate / operation contractは変更していない。
- persisted data、app config、Tauri APIに変更はなく、migrationや互換分岐は追加していない。

## 7. 自動検証結果

実行日: 2026-07-25

| コマンド | 結果 |
| --- | --- |
| `cd markdown-viewer-tauri && npm run build` | 成功。TypeScript compile / Vite build完了。既知のchunk size warningのみ。 |
| `cd markdown-viewer-tauri && npm test -- --run` | 成功。2 files / 29 tests passed。 |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | 成功。 |
| `cd markdown-viewer-tauri/src-tauri && cargo test` | 成功。22 tests passed、失敗0。 |
| `cd markdown-viewer-tauri/src-tauri && cargo fmt -- --check` | 成功。差分なし。 |
| `git diff --check` | 成功。whitespace errorなし。 |

CSS-onlyのvisible layout変更であり、現行VitestはDOM / computed layoutを提供しないため、CSS source文字列へ結合するunit testは追加していない。外部I/O、永続化、serialization、主要導線、integration test codeを変更していないため、追加の統合テスト対象には該当しない。

## 8. Phase 4-a手動確認予定

1. `sample_docs/preview_width.md`をpreview pane 1028px以下で開き、従来相当のmarginを確認する。
2. preview paneを1028px超へ広げ、本文が980pxで止まらず左右24pxを残して拡張することを確認する。
3. table、Mermaid、PlantUML、image、codeの広幅利用と局所horizontal overflow / scalingを確認する。
4. window viewportを760px以下へ縮め、左右gutterが14pxになることを確認する。
5. window viewportを760px超に保ってExplorerをresizeし、pane追従中もgutterが24pxのままであることを確認する。
6. Markdown / HTML tab切替、HTML iframe全幅、HTML文書固有layout、Preview scroll、Reload、Light / Darkを回帰確認する。

## 9. 未解決事項

実装上の未解決事項はない。visible layoutの最終確認はPhase 4-aのユーザー動作確認で行う。
