# Tauri MenuBar / StatusBar 導入 実装レビュー

**レビュー日**: 2026-07-06
**対象コミット**: `61e4cd6 feat: add Tauri menu bar and status bar`
**対象ドキュメント**: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/design/tauri_menubar_statusbar_design.md`
**対象 impl 記録**: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/impl/tauri_menubar_statusbar_impl.md`
**対象 meta**: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-003
**判定**: **条件付き承認 (Conditionally Approved)**。下記 1 件 (中 1 件) を Phase 4 前に修正すれば進行可。

---

## 概要

TODO-2026-003 Phase 3 (実装・恒久ドキュメント反映) レビュー。承認済み設計 (`review/tauri_menubar_statusbar_design_review.md`) に対して、`markdown-viewer-tauri/src/App.tsx` / `App.css` の実装差分、`docs/components/tauri_viewer/*` の反映内容、`npm run build` / `cargo check` の再実行結果を確認した。

---

## 1. 齟齬・不整合

### 1.1 狭幅時に `Root` を完全非表示にしており、設計の「ellipsis / title で破綻を避ける」方針と食い違う

**ドキュメント記載**: 設計書「リスクと follow-up」に「StatusBar の情報量が多く、狭い幅で root path と error が競合する。表示優先度は `Error`、`State`、`File`、`Root` の順とし、`Root` を最初に短縮する。CSS grid / flex と ellipsis / title で破綻を避ける。」(design 216 行)。ここでの「短縮する」は、直後の「ellipsis / title で破綻を避ける」という手段の記述と合わせて読むと、テキストを省略記号で切り詰めつつ `title` で全文確認できる状態を指しており、フィールド自体を消すことは意図していない。

**実装**: `App.css:430-432` の `@media (max-width: 760px)` 内で `.status-root { display: none; }` としており、幅 760px 未満では `Root` 項目が DOM から完全に取り除かれる。`title` 属性ごと消えるため、狭幅時は root path を確認する手段がなくなる。

**差異**: (a) 受け入れ条件「root path、active file、loading、error が StatusBar に表示される」(design 126-127 行 / todo.md completion) は幅を問わず成立すべきだが、760px 未満のウィンドウ幅では成立しない。(b) 旧 `Toolbar` の `.path-display` は狭幅時 (`max-width: 26vw`) でも常に ellipsis 表示されており、完全に消えることはなかった (`App.css` 旧実装)。今回の変更はこの点で既存挙動からの後退でもある。Tauri デスクトップアプリはウィンドウ幅を任意に縮められるため、760px 未満は非現実的なケースではない。

**推奨対応**: `.status-root { display: none; }` を削除し、狭幅時も `Root` 列を残したまま `minmax(0, 1fr)` 程度まで幅を許容し `.status-value` の ellipsis + `title` で全文を確認できる形に変更する。`grid-template-columns` のブレークポイント側 (`App.css:424-428`) に `Root` 用の列 (例: `minmax(64px, 0.5fr)`) を追加する。

**severity**: Medium

### 対応内容 (2026-07-06 follow-up)

`App.css` の mobile breakpoint から `.status-root { display: none; }` を削除し、`grid-template-columns` を 4 列のまま `Error` / `State` / `File` / `Root` の順で維持するよう変更した。`Root` 列は `minmax(64px, 0.5fr)` とし、狭幅時も項目を DOM / 表示上に残したまま `.status-value` の ellipsis と既存 `title` 属性で全文確認できる。

`npm run build` (`markdown-viewer-tauri/`) と `cargo check` (`markdown-viewer-tauri/src-tauri/`) は再実行で成功した。Vite の chunk size warning のみで新規エラーはない。

---

## 2. ドキュメント不足

なし。`docs/components/tauri_viewer/README.md` / `basic_design.md` / `detail_design.md` / `interface_spec.md` はいずれも Toolbar → MenuBar / StatusBar 分離後の構成、MenuBar の操作モデル (常時表示ボタン群、ドロップダウンなし)、StatusBar の `aria-live` 分割方針、狭幅時の表示優先度を反映済みで、Phase 2 承認内容との齟齬はない。`docs/architecture/` に `Toolbar` への直接参照がないため、architecture docs 未更新も妥当。

---

## 3. 改善提案

### 3.1 `menu-group` / `status-bar` の `aria-label` にグルーピング用の role が付いていない

**推奨対応**: `App.tsx:368,377` の `<div className="menu-group" aria-label="...">` は暗黙ロールが `generic` のままであり、支援技術によっては `aria-label` がグループ名として読み上げられない場合がある。`role="group"` (または `role="toolbar"` 相当) を付与すると、File / View のグルーピングがスクリーンリーダーでも明確になる。必須ではなく、任意の改善として扱ってよい。

**severity**: Low

### 対応内容 (2026-07-06 follow-up)

`App.tsx` の `File commands` / `View commands` の `.menu-group` に `role="group"` を付与し、`aria-label` が支援技術上の grouping label として扱われやすい構造にした。`role="menubar"` / `role="menuitem"` は引き続き導入していない。

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 実装確認 | 結果 |
| --- | --- | --- |
| `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる | `MenuBar` の `File` group に `Open Folder` (`disabled={isBusy}`) / `Reload` (`disabled={!rootPath \|\| isBusy}`)、`View` group に Theme toggle (`disabled={isBusy}`) を実装。旧 `Toolbar` の handler / disabled 条件と 1:1 で一致 (`App.tsx:358-385`) | ✓ 整合 |
| root path、active file、loading、error が StatusBar に表示される | `StatusBar` が `rootPath` / `selectedFileName` / `loadingMessage` / `errorMessage` を `Root` / `File` / `State` / `Error` として表示 (`App.tsx:394-408`) | ✓ 整合 (狭幅時の `Root` 表示は 1.1 参照) |
| 既存単一ファイル表示が退行しない | `loadRoot` / `loadMarkdown` / `selectedMarkdown` / `previewRevision` / `MarkdownPreview` は Phase 2 以前と一字一句変更なし (`App.tsx:94-155`, `504-524`) | ✓ 整合 |
| Mermaid が退行しない | `mermaid.initialize` / `mermaid.run` の effect と依存配列 (`previewRevision`, `theme`, `plantUmlDiagrams`) は変更なし (`App.tsx:255-282`) | ✓ 整合 |
| PlantUML が退行しない | `plantUmlRenderState` の effect、`extractPlantUmlSources`、`render_plantuml_diagrams` invoke、inline `.plantuml-loading` / `.plantuml-error` は変更なし (`App.tsx:196-253`, `615-622`) | ✓ 整合 |
| 相対画像が退行しない | `renderMarkdown` の image rule、`resolveSiblingPath`、`convertFileSrc` 呼び出しは変更なし (`App.tsx:555-571`) | ✓ 整合 |
| リンク遷移が退行しない | `handlePreviewClick`、`openUrl`、anchor scroll、相対 `.md` 読み込みは変更なし (`App.tsx:157-190`) | ✓ 整合 |

Phase 2 レビューで確認事項とされた 3 点も実装済み:

- MenuBar は常時表示ボタン群のみで、ドロップダウン / `role="menubar"` / `role="menuitem"` / 矢印キー移動 / フォーカストラップは未導入 (`App.tsx:358-385`)。✓
- `State` / `Error` の値のみ `aria-live="polite"`、`Root` / `File` は live region に含まれない (`App.tsx:402-405`, `418-427`)。✓
- 狭幅時の表示優先度が `Error` → `State` → `File` → `Root` の順で構築されている (`App.tsx:401-406`, `App.css:423-428`)。ただし `Root` は「短縮」ではなく「非表示」になっている点は 1.1 で指摘。△

---

## 5. 検証結果確認

| 検証 | プロンプト記載結果 | 再実行結果 |
| --- | --- | --- |
| `npm run build` (`markdown-viewer-tauri/`) | 成功。chunk size warning のみ | 再実行し同様に成功 (`✓ built in 7.25s`)。chunk size warning のみで新規エラーなし |
| `cargo check` (`markdown-viewer-tauri/src-tauri/`) | 成功 | 再実行し成功 (`Finished dev profile ... in 3.81s`) |

いずれもコード変更 (`App.tsx` / `App.css`) のみで Rust / Tauri command 側の変更が含まれないことと整合する。

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 中 | 1.1 狭幅時の `Root` 完全非表示 | 受け入れ条件 (root path が StatusBar に表示される) が狭幅ウィンドウで満たされず、旧 Toolbar からの後退にもなる |
| 低 | 3.1 `menu-group` の `role` 未指定 | 支援技術での読み上げ品質に関する改善で、必須要件には影響しない |

---

## 7. 残リスク / Phase 4 での注意点

- 1.1 を修正した場合、`.status-bar` の `grid-template-columns` (デスクトップ・狭幅両方) の列幅配分を再調整し、`Error` / `State` の視認性を保ったまま `Root` が過度に潰れないことを Phase 4 の手動確認で目視すること。
- Phase 4 の手動確認観点 (`impl/tauri_menubar_statusbar_impl.md` 記載) に加え、実際にウィンドウ幅を 760px 未満まで縮小した状態で `Root` / `File` / `State` / `Error` がすべて (ellipsis であっても) 視認・`title` 確認できることを確認する。
- `sample_docs/plantuml.md` を用いた Mermaid + PlantUML 同居確認、相対画像・相対リンク遷移確認は設計変更の影響を受けない経路のため、Phase 4 では回帰がないことの最終確認として実施すれば足りる。
- `docs/todo/todo.md` の `TODO-2026-003` は Phase 4 (Verification and completion) 完了時に `status: done` へ更新する。今回のコミットでは未更新であり、これは本 Phase の対象外として妥当。

---

## 8. 結論

実装は Phase 2 承認済み設計の大部分を忠実に反映している。MenuBar の常時表示ボタン群方針、StatusBar の `aria-live` 分割方針は正確に実装され、既存の Markdown 表示・Mermaid・PlantUML・相対画像・リンク遷移の処理経路はコード上変更されていないことをソース確認で裏付けた。恒久ドキュメント (README / basic_design / detail_design / interface_spec) も実装と一致しており、`npm run build` / `cargo check` はいずれも再実行で成功を確認した。不要な互換レイヤーや重複 state の追加も見当たらない。

一方で、狭幅時に `Root` フィールドを `display: none` で完全に消す実装 (1.1) は、設計が明記した「ellipsis / title で破綻を避ける」という緩和方針と整合せず、受け入れ条件 (root path が StatusBar に表示される) を狭幅ウィンドウで満たさない。これは実装ミスとして是正可能な範囲であり、設計全体の採用案や対象範囲を覆すものではないため、**条件付き承認**とする。Phase 4 着手前に 1.1 を修正し、狭幅時も `Root` が (省略表示であっても) 確認できる状態にすること。

未対応指摘: 1 件 (中 1 件)。3.1 (低) は任意改善のため必須対応ではない。
