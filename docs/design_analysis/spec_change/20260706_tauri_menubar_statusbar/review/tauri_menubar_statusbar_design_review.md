# Tauri MenuBar / StatusBar 導入 設計レビュー

**レビュー日**: 2026-07-06
**再確認日**: 2026-07-06
**対象ドキュメント**: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/design/tauri_menubar_statusbar_design.md`
**対象 meta**: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-003
**対象 WBS**: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md` WP-001
**初回レビュー対象コミット**: `7979fce docs: draft Tauri menu status design`
**再確認対象コミット**: `bec06d5 docs: address Tauri menu status design review`
**判定**: **承認 (Approved)**。Phase 3 進行可。

---

## 概要

TODO-2026-003 (Tauri MenuBar / StatusBar 導入) の Phase 2 設計レビュー。Tauri 版既存 `Toolbar` を React アプリ内 `MenuBar` / `StatusBar` へ分離する設計を、受け入れ条件トレース、既存コード (`markdown-viewer-tauri/src/App.tsx` / `App.css`) との整合、非対象の切り分け、類似ロジックの重複・fallback 有無、Phase 3 恒久ドキュメント更新予定の観点で検証した。

---

## 1. 齟齬・不整合

### 1.1 MenuBar の操作モデル (常時表示ボタン群 か ドロップダウンメニュー か) が未確定

**ドキュメント記載**: 「MenuBar の command は `File` と `View` のグループに分ける」「`File`: `Open Folder`, `Reload`」「`View`: `Theme: Light/Dark`」(design 97-101 行)。Before/After 図 (design 71-89 行) も `File:` / `View:` の見出しでグルーピングを示すのみ。

**差異**: 既存 `Toolbar` はボタンが常時横並びで見える構成 (`src/App.tsx:359-385`)。設計の Before/After 図の書き方 (`File: Open Folder / Reload`) は、古典的な OS 風メニューバー (`File` をクリックしてドロップダウンを開き、`Open Folder` / `Reload` が項目として現れる) とも、単に見出しラベル付きでボタンが常時見えているグループ (現行 Toolbar のレイアウトをグループ分けしただけ) とも読める。両者は実装コストと必要な ARIA 実装 (`role="menubar"` / `role="menuitem"` とキーボードの矢印操作、フォーカストラップ等) が大きく異なり、「OS native menu は導入しない」という非対象の記載だけでは、React 内で擬似的にネイティブ然としたドロップダウン UI を作るのかどうかを排除できていない。Phase 3 着手時に実装者の解釈が割れると手戻りが発生する。

**推奨対応**: Phase 3 着手前に、設計書「UI / API / データモデルの変更点」または「Before / After」に、MenuBar は「常時展開されたボタン群 (グループラベル付き、クリックで即実行、ドロップダウンは持たない)」であることを明記する。将来ドロップダウン化する場合は、その際に ARIA `menubar` / `menuitem` ロールとキーボード操作の設計を別途起票する方針を follow-up に残す。

**severity**: Medium

**対応**: 対応済み。設計書の Before / After と UI 変更点に、MenuBar は `File` / `View` のグループラベル付き常時表示ボタン群であり、ドロップダウン、`role="menubar"` / `role="menuitem"`、矢印キー移動、フォーカストラップを導入しないことを追記した。将来ドロップダウン式 MenuBar が必要な場合は別 TODO として起票する方針も follow-up に追加した。

### 1.2 StatusBar の状態変化に対する aria-live 方針が未定義

**ドキュメント記載**: StatusBar は `Root:` / `File:` / `State:` / `Error:` を表示する (design 103-107 行)。「エラー・例外ハンドリング方針」(design 172-177 行) でも表示先の記述はあるが、支援技術 (スクリーンリーダー) への通知方法には触れていない。

**差異**: 現行実装は `.loading-banner` に `role="status"` を付与しており (`src/App.tsx:327`)、ローディング開始が暗黙の `aria-live="polite"` としてスクリーンリーダーに通知される。設計通り StatusBar を「常時表示の 1 つの帯」として実装すると、(a) 帯全体に `role="status"` を付けると `Root:` / `File:` の表示替えのたびにも読み上げられノイズになり得る、(b) 何も指定しないと現行の loading / error 通知が失われる退行になり得る。どちらの結果になるかは設計書からは決められず、実装者依存になる。

**推奨対応**: Phase 3 の detail design で、StatusBar 内の `State:` / `Error:` 欄のみを `aria-live="polite"` な子要素として区切り、`Root:` / `File:` 欄は非 live にする方針を明記する。

**severity**: Low

**対応**: 対応済み。設計書の UI 変更点とエラーハンドリング方針に、StatusBar 全体ではなく `State:` と `Error:` の値だけを `aria-live="polite"` にし、`Root:` / `File:` は live region に含めない方針を追記した。

---

## 2. ドキュメント不足

なし。恒久ドキュメント更新予定先 (README / basic_design / detail_design / interface_spec) は明記されており、architecture docs 側に `Toolbar` への直接参照がないことも確認済みのため、更新範囲の過不足はない。

---

## 3. 改善提案

### 3.1 StatusBar の情報量に対する視認性リスクは記載済みだが、優先順位の明記があるとよい

**推奨対応**: 「リスクと follow-up」(design 210-214 行) で StatusBar の情報競合リスクと CSS ellipsis / title による緩和方針は既に記載されている。狭幅時に `Root:` / `File:` / `State:` / `Error:` のどれを優先的に省略するか（例: `Error:` は省略せず `Root:` を先に短縮する等）まで明記すると、Phase 3 の CSS 実装判断がぶれない。必須ではないため improvement 扱い。

**severity**: Low

**対応**: 対応済み。設計書のリスクと follow-up に、狭幅時の表示優先度を `Error`、`State`、`File`、`Root` の順とし、`Root` を最初に短縮する方針を追記した。

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 設計書での対応箇所 | 結果 |
| --- | --- | --- |
| `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる | 「UI / API / データモデルの変更点」(design 97-102 行)、「受け入れ条件ごとの対応方針」表 1 行目 (design 126 行) | ✓ 整合。既存 handler / disabled 条件をそのまま再利用する方針で実装粒度も十分 |
| root path、active file、loading、error が StatusBar に表示される | 「UI / API / データモデルの変更点」(design 103-107 行)、「受け入れ条件ごとの対応方針」表 2 行目 (design 127 行) | ✓ 整合。`rootPath` / `selectedFileName` / `loadingMessage` / `errorMessage` は `src/App.tsx` に既存の派生値がそのまま存在し (`App.tsx:57-71`)、新規 state 追加なしで実装できる |
| 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない | 「受け入れ条件ごとの対応方針」表 3〜7 行目 (design 128-132 行) | ✓ 整合。対象データフロー / handler を個別に列挙し「変更しない」と明記。網羅性も現行コード (`loadRoot` / `loadMarkdown` / `plantUmlRenderState` / `renderMarkdown` の image rule / `handlePreviewClick`) と 1:1 対応している |

WBS (`wbs.md` WP-001) の `completion_criteria` および非対象・deferred 記載とも齟齬なし。

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| Toolbar 廃止・MenuBar/StatusBar 分割が `App.tsx` の既存 state / handler 構成 (`isBusy`, `loadingMessage`, `errorMessage` 等) とそのまま対応する | ✓ 整合 |
| `Reload` の disabled 条件 (`!rootPath \|\| isBusy`) が現行実装と一致 | ✓ 整合 (`App.tsx:376`) |
| OS native menu / Recent Folders / multi-tab / split view / Avalonia 変更が非対象として十分に切られている | ✓ 整合 (meta.md Non-Scope, design 27-32 行, wbs.md deferred_or_follow_up と一致) |
| 類似ロジックの重複追加・不要な互換レイヤー/fallback を前提にしていない | ✓ 整合 (「類似既存ロジックとの抽象化・共通化方針」「互換性・移行方針」で明示的に否定) |
| Tauri command / Rust backend / capability / 永続データモデルを変更しない方針 | ✓ 整合。`scan_directory` / `read_text_file` / `render_plantuml_diagrams` への言及・変更提案なし |
| 手動確認観点に `sample_docs/plantuml.md` を用いた Mermaid + PlantUML 同居確認が含まれる | ✓ 整合。ファイル実在確認済み |
| Phase 3 恒久ドキュメント更新予定先 (README / basic_design / detail_design / interface_spec) が明記され、architecture docs は対象外とする判断が現状の記載 (`Toolbar` 未参照) と整合 | ✓ 整合 |
| Phase 2 コミット (`7979fce`) が設計書 / meta.md のみの docs-only 差分である | ✓ 整合。実装コード変更は含まれていない |

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 中 | 1.1 MenuBar の操作モデル未確定 | 実装着手時に解釈が割れると UI 構造・アクセシビリティ実装のやり直しにつながる |
| 低 | 1.2 StatusBar の aria-live 方針未定義 | 現行 `role="status"` の通知挙動に対する退行リスクだが、機能要件そのものには影響しない |
| 低 | 3.1 StatusBar 省略優先順位 | 実装時に決めても大きな手戻りにはならない |

---

## 7. 残リスク / Phase 3 での注意点

- MenuBar の操作モデル (1.1) を設計書へ追記した後、`App.css` の `.toolbar` 相当スタイルを新設する `MenuBar` 用クラスへ機械的に置換するだけで実装できるかを Phase 3 冒頭で再確認する。
- StatusBar の `aria-live` 方針 (1.2) を決めた上で、既存 `.loading-banner` の `role="status"` を削除するタイミングと、新 StatusBar 側の実装が入るタイミングが同一コミットになるようにし、一時的に loading 通知が失われる期間を作らない。
- 設計書の「リスクと follow-up」に記載の通り、preview pane 上部の sticky banner 削除により長文書閲覧中の error/loading 視認位置が変わる点は、Phase 4 の手動確認で実際の見え方を確認する。
- follow-up (`TODO-2026-004` Recent Folders) は MenuBar の `File` group への追加を前提としているため、1.1 で MenuBar の操作モデルを確定する際に、項目追加後もボタン群として破綻しないレイアウト方針であることを合わせて確認する。

---

## 8. 結論

設計は TODO-2026-003 の受け入れ条件を漏れなく反映しており、既存 `App.tsx` / `App.css` の state・handler・派生値をそのまま再利用する方針で実装粒度も十分に具体的である。OS native menu、Recent Folders、multi-tab、split view、Avalonia 変更の非対象化も WBS・todo と整合している。類似ロジックの重複や不要な互換レイヤー・fallback の追加も見当たらない。

指摘は 2 件 (中 1 件、低 1 件) のみで、いずれも UI の操作モデル・アクセシビリティ方針という実装の入口で確定させておくべき詳細であり、設計全体の採用案・対象範囲・非対象を覆すものではない。初回レビューでは、Phase 3 着手前に 1.1 (MenuBar の操作モデル) を設計書へ追記することを必須条件、1.2 (StatusBar の aria-live 方針) を Phase 3 detail design 内での確定で可とする**条件付き承認**とした。

### 再確認結果 (2026-07-06, commit `bec06d5`)

設計書 (`design/tauri_menubar_statusbar_design.md`) を再確認した。

- **1.1 MenuBar の操作モデル**: Before/After 図が「File group: Open Folder button / Reload button」「View group: Theme toggle button」に修正され、「UI / API / データモデルの変更点」直前に「MenuBar は React アプリ内で常時展開されたボタン群として実装する。`File` / `View` は視覚上のグループラベルであり、クリックで開くドロップダウン、`role="menubar"` / `role="menuitem"`、矢印キーによるメニュー移動、フォーカストラップは導入しない」という一文が追記された。「UI 変更」箇条にも「`File` / `View` は grouping label であり、ドロップダウンメニューは持たない」が追加され、将来ドロップダウン化する場合は別 TODO として起票する方針が follow-up に追加されている。✓ 反映確認。
- **1.2 StatusBar の aria-live 方針**: 「UI 変更」箇条に「支援技術向けには `State:` と `Error:` の値だけを `aria-live="polite"` な子要素に分ける。`Root:` と `File:` は live region に含めず、root / active file 変更時の不要な読み上げを避ける」が追加された。「例外・エラーハンドリング方針」にも同旨と、既存 `.loading-banner` の `role="status"` が担っていた通知を StatusBar へ移す旨が追記された。✓ 反映確認。
- **3.1 StatusBar 省略優先順位 (改善提案)**: 「リスクと follow-up」に「表示優先度は `Error`、`State`、`File`、`Root` の順とし、`Root` を最初に短縮する」が追記された。✓ 反映確認。

**判定**: **承認 (Approved)**。

- すべてのレビュー指摘 (中 1 件、低 2 件) に対応が記録され、未解決指摘はゼロ。
- `meta.md` の `design_status` を `done` に更新可能な状態。
- Phase 3 (実装・恒久ドキュメント反映) への進行を承認する。Phase 3 着手時は、本 review 文書で確認した MenuBar の常時表示ボタン群方針、StatusBar の `aria-live` 分割方針、狭幅時の表示優先度をそのまま実装へ反映すること。

未解決指摘なし。本レビューでの承認をもって Phase 2 設計レビューを完了とする。
