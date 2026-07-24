# Tauri document preview 横幅の可変化 実装記録

## 1. 対象

- TODO: `TODO-2026-021 Tauri document preview 横幅の可変化`
- 設計: `design/tauri_document_preview_responsive_width_design.md`
- 設計レビュー: `review/tauri_document_preview_responsive_width_design_review.md`
- 実装ブランチ: `spec-change/tauri-document-preview-responsive-width`

## 2. 実装概要

Tauri版Markdown本文の固定980px上限を撤去し、preview pane content boxから左右gutterを引いた幅へ追従させた。Phase 4-aで検出したMermaidのリサイズ退行に対し、Markdown内容を変えないReact再描画では描画済みSVGを元HTMLで上書きしないよう`dangerouslySetInnerHTML`値を安定化した。width state、event handler、Rust command、HTML iframe、security boundaryは変更していない。

横長contentの手動確認用に`sample_docs/preview_width.md`を追加し、変更後の幅契約をTauri Viewer component docsと開発・手動確認ルールへ同期した。

## 3. 設計差分と実装差分

| 設計項目 | 実装 |
| --- | --- |
| 固定980px上限を撤去 | `App.css`の`.markdown-body`を`width: calc(100% - 48px)`へ置換した。旧`min(980px, ...)`経路は残していない。 |
| 通常左右gutter 24px | `margin: 0 auto`と`calc(100% - 48px)`を維持し、preview pane content boxの残余48pxを左右へ等分する。 |
| viewport 760px以下の左右gutter 14px | 既存media queryの`calc(100% - 28px)`を変更せず維持した。 |
| Markdown子要素契約を維持 | table / pre / Mermaid / PlantUMLの`overflow-x: auto`、image / PlantUML SVGの`max-width: 100%`を変更していない。 |
| HTML iframe全幅を維持 | `.html-preview-frame { width: 100%; }`、iframe DOM、protocol / sandbox / CSPを変更していない。 |
| JavaScript計測を追加しない | width計測、observer、listenerは追加していない。`App.tsx`はMermaid SVGを保持するため`dangerouslySetInnerHTML` objectを既存HTML単位でmemoizeした。`explorerPane.ts`と`documentPolicy.ts`は変更していない。 |
| Mermaidリサイズ退行を解消 | window size保存stateによるApp再描画で元Markdown HTMLが再注入されないようにし、描画済みSVGを維持する。Markdown内容や既存再描画依存値が変わる場合の更新は維持した。 |
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
| `docs/components/tauri_viewer/detail_design.md` | box model、gutter値、pane / viewport基準の違い、子要素overflow / scaling、Mermaid SVGを保持するReact DOM契約を追記。 |
| `docs/components/tauri_viewer/interface_spec.md` | Document Preview表示契約とresize後のMermaid SVG維持を追加。 |
| `docs/rules/development_workflow.md` | `sample_docs/preview_width.md`を使う広幅・狭幅・Explorer resize・HTML回帰とMermaid SVG維持の手動確認を追加。 |

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

初回の幅変更はCSS-onlyであり、CSS source文字列へ結合するunit testは追加していない。Phase 4-aフィードバック修正後にも同じ一式を再実行し、frontend build、既存Vitest 29件、`cargo check`、Rust 22件、format check、`git diff --check`が成功した。Mermaid SVG保持はReact外のDOM mutationとwindow resize state更新を含むWebView上の振る舞いであり、現行のNode環境VitestにはDOM環境がないため、`sample_docs/preview_width.md`を使う再手動確認を完了条件とする。外部I/O、永続化、serialization、Rust、Tauri integration境界は変更していない。

## 8. Phase 4-a手動確認

2026-07-25の初回ユーザー確認では、本文幅とgutterの追従は期待どおりだった。Mermaidは初期状態でSVG描画されたが、window resize後にdiagram source文字列へ戻ったためNGとなり、Phase 3へ戻して修正した。

1. `sample_docs/preview_width.md`をpreview pane 1028px以下で開き、従来相当のmarginを確認する。
2. preview paneを1028px超へ広げ、本文が980pxで止まらず左右24pxを残して拡張することを確認する。
3. table、Mermaid、PlantUML、image、codeの広幅利用と局所horizontal overflow / scalingを確認する。
4. window viewportを760px以下へ縮め、左右gutterが14pxになることを確認する。
5. window viewportを760px超に保ってExplorerをresizeし、pane追従中もgutterが24pxのままであることを確認する。
6. Markdown / HTML tab切替、HTML iframe全幅、HTML文書固有layout、Preview scroll、Reload、Light / Darkを回帰確認する。
7. Mermaid初期SVG描画後にwindow幅とExplorer幅を変更し、SVG表示が維持されることを再確認する。

## 9. 未解決事項

修正後のMermaidリサイズ再確認を含むPhase 4-aユーザー動作確認が未完了。
