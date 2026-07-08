# Tauri Recent Folders 導入 実装レビュー

**レビュー日**: 2026-07-08
**対象ドキュメント**: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/design/tauri_recent_folders_feature_design.md`
**対象 impl 記録**: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/impl/tauri_recent_folders_feature_impl.md`
**対象 meta**: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-004
**対象コミット**: `3a33830 Phase 3 implement Tauri recent folders`
**判定**: **条件付き承認 (Conditionally Approved)**。1.1 (MenuBar の ARIA role 過剰付与) を対応後、Phase 4 進行可。

---

## 概要

TODO-2026-004 (Tauri Recent Folders 導入) の Phase 3 実装レビュー。承認済み設計 (`review/tauri_recent_folders_design_review.md`、Approved) に対して、`markdown-viewer-tauri/src/App.tsx` / `App.css` / `src-tauri/src/lib.rs` の実装差分、`docs/components/tauri_viewer/*` の反映内容、`npm run build` / `cargo check` / `git diff --check` の再実行結果を確認した。

---

## 1. 齟齬・不整合

### 1.1 MenuBar に Phase 2 設計が明記していない `role="menubar"` / `role="menuitem"` を付与しており、キーボード操作モデルと矛盾する

**ドキュメント記載**: 承認済み設計の「アクセシビリティ」節 (design 158-165 行) は次の 4 点のみを規定する。

```text
- header.menu-bar は既存の aria-label="Application menu" を維持する。
- dropdown trigger は aria-haspopup="menu"、aria-expanded を持つ。
- dropdown container は role="menu"、実行 item は role="menuitem" とする。
- entry 削除 button は aria-label="Remove <path> from recent folders" を持つ。
- 矢印キー移動と roving tabindex は最小範囲では導入しない。既存 button focus と Escape close を優先する。
```

`header.menu-bar` 自体に `role` を付与する記載、および `File` / `View` の trigger button に `role="menuitem"` を付与する記載は設計書のどこにもない。さらに、この設計判断は TODO-2026-003 の Phase 2 design review で「`role="menubar"` / `role="menuitem"` を導入すると、矢印キー移動・roving tabindex・フォーカストラップを伴う ARIA menubar パターンの実装を利用者/支援技術に期待させてしまう」という理由で明示的に見送られた経緯があり (`docs/components/tauri_viewer/detail_design.md` の旧記述、および `spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_design_review.md` 1.1)、今回の設計もその制約を覆すとは明記していない。

**実装**: `App.tsx:503` で `<header ref={menuBarRef} className="menu-bar" role="menubar" aria-label="Application menu">`、`App.tsx:508` と `App.tsx:581` で `File` / `View` の trigger button に `role="menuitem"` を付与している。加えて `role="menu"` の直下 (`App.tsx:516`) には `.recent-folder-list` / `.recent-folder-row` という非 `menuitem` の `<div>` ラッパーが挟まり (`App.tsx:530-532`)、削除 button (`App.tsx:544-556`, `.recent-folder-remove`) には `role="menuitem"` が付与されていない。

**差異**: WAI-ARIA の `menubar` パターンは、Tab キーではなく矢印キー (Left/Right) で top-level item 間を移動する roving tabindex を前提とする。今回の実装は各 button が個別の native tab stop のままで、矢印キー移動・Home/End・typeahead は未実装 (設計が非対象と明記した通り)。この状態で `role="menubar"` / `role="menuitem"` を付与すると、スクリーンリーダーは「メニューバー」として読み上げ、矢印キー操作を利用者に期待させるが実際には何も起きず、素の button 群として扱うより体験が悪化する。また `role="menu"` の子要素が `<div>` ラッパー越しの `menuitem` と非 `menuitem` (`recent-folder-remove`)混在になっている点も ARIA menu パターン (`menu` の直接の子はすべて `menuitem` 系である必要がある) から外れる。これは Phase 2 で明示的に承認された範囲を超えた実装であり、TODO-2026-003 で一度見送られたのと同じリスクを再導入している。

**推奨対応**: `header.menu-bar` から `role="menubar"`、`File` / `View` trigger button から `role="menuitem"` を外し、承認済み設計の記載通り `aria-haspopup="menu"` / `aria-expanded` のみを top-level trigger に残す。矢印キー移動を実装しない限り `menubar` / 対応する `menuitem` は導入しない、という TODO-2026-003 の既存方針を維持する。`role="menu"` 配下も `.recent-folder-list` / `.recent-folder-row` の non-semantic `<div>` を `menuitem` の直接の親子関係を崩さない形 (例: `role="none"` を明示するか、削除 button も含めて `role="menuitem"` に揃える) に整理する。矢印キー対応を後日実装するなら、その時点で `role="menubar"` / `role="menuitem"` を導入する方が安全。

**severity**: Medium

---

## 2. ドキュメント不足

なし。`docs/components/tauri_viewer/README.md` / `basic_design.md` / `detail_design.md` / `interface_spec.md` はいずれも Recent Folders の責務、`load_recent_folders` / `record_recent_folder` / `remove_recent_folder` command、`AppConfigStore` の Mutex 排他制御、`RecentFolderEntry` データモデル、失敗時動作を反映済みで、Phase 2 承認内容との齟齬はない。TODO-2026-003 由来の「ドロップダウン、`role="menubar"` / `role="menuitem"` は導入しない」という旧記述も `detail_design.md:384` で新しい dropdown 仕様の記述に置換されており、追記に留まらず古い否定文を残していないことを確認した (`grep` で該当文言の残存なしを確認済み)。ただし 1.1 の指摘により、置換後の記述自体が実装の ARIA 過剰付与をそのまま追認してしまっている点は 1.1 の対応と合わせて見直すこと。

---

## 3. 改善提案

### 3.1 `loadRoot` が `record_recent_folder` の失敗を、直前の `loadMarkdown` 失敗より常に優先して表示する

**該当箇所**: `App.tsx:108-133` の `loadRoot`。`recordRecentFolder(path)` の結果 (`recentError`) は `loadMarkdown` 呼び出しより前に確定するが、`errorMessage` への反映 (`if (recentError) { setErrorMessage(recentError); }`) は `loadMarkdown` 実行後、関数の最後で無条件に行われる。`loadMarkdown` は自身の `try/catch` で `read_text_file` 失敗時に `setErrorMessage(toErrorMessage(error))` を呼ぶが (`App.tsx:193-214`)、その直後にこの無条件 `setErrorMessage(recentError)` が走ると、initial Markdown 読み込み失敗のメッセージが recent folder 保存失敗のメッセージで上書きされ、利用者からは「なぜプレビューが空なのか」が見えなくなる。

**差異**: 設計書の「失敗時動作とデフォルト挙動」(design 272-280 行) は各失敗パターンを個別に記述しているが、両方が同時に発生した場合の優先順位には触れていない。発生頻度は低い (`read_text_file` 失敗と app config 書き込み失敗が同一 root open で同時に起きる) が、発生した場合に片方のエラーが完全に隠れる点は受け入れ条件の「失敗時に代表 error を確認できる」という前提をやや損なう。

**推奨対応**: `loadMarkdown` がすでに `errorMessage` を設定している (＝失敗した) 場合は `recentError` で上書きしない、もしくは両者を連結して表示する。必須修正ではなく改善提案として扱ってよい。

**severity**: Low

---

## 4. 受け入れ条件トレース確認

| `docs/todo/todo.md` completion 条件 | 実装確認 | 結果 |
| --- | --- | --- |
| `Recent Folders` が MenuBar dropdown として `File` 配下に表示・実行できる | `MenuBar` の `File` dropdown に `Recent Folders` セクション、entry ごとの open/delete button を実装 (`App.tsx:528-562`) | ✓ 整合 (ARIA role の付与範囲は 1.1 で指摘) |
| `Open Folder` / `Reload` / `Recent Folders` が MenuBar から利用でき、busy 中は重複操作が抑止される | `isBusy = isMarkdownLoading \|\| isPlantUmlRendering \|\| isRecentFoldersBusy` (`App.tsx:76`) を全 command button の `disabled` に反映 (`App.tsx:520,538,549,566,590`) | ✓ 整合 |
| root open 成功時に最近開いたディレクトリが app config JSON へ保存される | `loadRoot` が `scan_directory` 成功後、initial markdown の有無に関わらず `record_recent_folder` を呼ぶ (`App.tsx:108-133`)。Rust 側は `settings.json` へ pretty JSON で永続化 (`lib.rs:215-226`) | ✓ 整合 |
| 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する | `record_recent_folder` が canonical path で重複除去 → 先頭挿入 → `MAX_RECENT_FOLDERS=10` truncate (`lib.rs:141-165`)。存在しない path は `scan_directory` / `record_recent_folder` の canonicalize 失敗が `errorMessage` に表示され、recent list からの自動削除はしない (`App.tsx:130-131`, `openRecentFolder` 経由)。`remove_recent_folder` が明示削除を担当 (`lib.rs:168-182`, `App.tsx:157-172`) | ✓ 整合 |
| 再起動後も一覧が復元される | mount 時 `useEffect` で `load_recent_folders` を invoke し `recentFolders` state を復元 (`App.tsx:255-279`) | ✓ 整合 |
| 既存の root path strip、Explorer、Markdown preview、Mermaid、PlantUML、ErrorBanner、StatusBar が退行しない | `loadMarkdown` / `renderMarkdown` / PlantUML effect / Mermaid effect / `RootPathBar` / `ErrorBanner` / `StatusBar` の実装はロジック上変更なし (`App.tsx:193-249, 306-405, 600-661`) | ✓ 整合 |

Phase 2 design review で確認された 5 点も実装済みであることを確認した。

- command 一覧が `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` のみ (`lib.rs:123-182`, `generate_handler!` at `lib.rs:692-699`)。`save_recent_folders` / `validate_recent_folder` 相当の経路は存在しない。✓
- app config JSON の read-modify-write が `AppConfigStore { lock: Mutex<()> }` で直列化され (`lib.rs:61-64, 128-131, 146-149, 174-177`)、`_guard` がリード〜ライトの全体を通して保持されている。✓
- `RecentFolderEntry.name` は `record_recent_folder` 実行時に Rust 側で確定するスナップショットを正本とし、frontend は `entry.name || entry.path` で表示するのみで `getFileName` による再導出はしていない (`App.tsx:541`, `lib.rs:235-241`)。✓
- 恒久ドキュメントの旧「ドロップダウンを導入しない」記述は置換され、追記による併存はない (`detail_design.md:384`)。✓
- Markdown file が 1 つもない root でも `scan_directory` 成功後は無条件に `record_recent_folder` が呼ばれる (`App.tsx:117-125`)。✓

---

## 5. 検証結果確認

| 検証 | impl 記録の結果 | 再実行結果 |
| --- | --- | --- |
| `npm run build` (`markdown-viewer-tauri/`, `tsc && vite build`) | Pass。chunk size warning のみ | 再実行し成功 (`✓ built in 5.44s`)。chunk size warning のみで新規エラーなし |
| `cargo check` (`markdown-viewer-tauri/src-tauri/`) | Pass (`dev` profile) | 再実行し成功 (`Finished dev profile ... in 0.91s`)。warning なし |
| `git diff --check` | Pass | `25d3082..3a33830` の diff で再実行し whitespace error なしを確認 |

いずれも impl 記録の記載と一致する。

---

## 6. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 中 | 1.1 MenuBar の ARIA role 過剰付与 | 矢印キー操作が未実装のまま `role="menubar"` / `role="menuitem"` を付与すると、支援技術利用者への案内と実際の操作性が食い違い、TODO-2026-003 で一度回避したリスクを再導入する |
| 低 | 3.1 `record_recent_folder` 失敗が `loadMarkdown` 失敗を上書きする | 発生頻度が低い二重障害時のみ影響し、受け入れ条件そのものは大きく損なわれない |

---

## 7. 残リスク / Phase 4 での注意点

- 1.1 を修正する場合、`App.css` の `.menu-trigger[aria-expanded="true"]` 等スタイル面への影響はないため、`role` 属性の削除のみで完結する規模である。Phase 4 着手前に対応することを推奨する。
- Phase 4 の手動確認 (`impl/tauri_recent_folders_feature_impl.md` 記載) に加え、スクリーンリーダー (VoiceOver 等) で `File` / `View` トリガーを操作した際の読み上げ内容が、1.1 対応後の role 構成と一致することを確認するとよい (必須ではない)。
- リスク表に記載済みの「config JSON 破損時に recent list が使えない」「native menu を採用しないことへの UX 差」は Phase 4 の UX 評価・手動確認でそのまま踏襲する。
- `docs/todo/todo.md` の `TODO-2026-004` は Phase 4 (Verification and completion) 完了時に `status: done` へ更新する。今回のコミットでは未更新であり、これは本 Phase の対象外として妥当。

---

## 8. 結論

実装は Phase 2 承認済み設計をほぼ忠実に反映している。command 一覧の統一 (`load_recent_folders` / `record_recent_folder` / `remove_recent_folder` のみ)、`AppConfigStore` の `Mutex` による排他制御、`RecentFolderEntry.name` の正本方針、no-markdown root でも recent 記録する方針は、いずれもソースコード上でレビュー観点通りに確認できた。frontend は duplicate promotion / truncate / path validation を重複実装せず、Rust command の戻り値をそのまま `recentFolders` state に反映しており、既存の Markdown 表示・Mermaid・PlantUML・相対画像・リンク遷移の経路もコード上変更されていない。恒久ドキュメント (README / basic_design / detail_design / interface_spec) も実装と一致し、旧「ドロップダウンを導入しない」記述も適切に置換されている。`npm run build` / `cargo check` / `git diff --check` はいずれも再実行で成功を確認した。

一方で、MenuBar の `header` に `role="menubar"`、`File` / `View` trigger に `role="menuitem"` を付与する変更 (1.1) は、Phase 2 承認済み設計のアクセシビリティ節が明記した範囲を超えており、矢印キー移動が非対象のままこれらの role を導入すると、TODO-2026-003 で一度明示的に回避した ARIA menubar パターンの期待値ミスマッチを再導入する。これは受け入れ条件そのものを破壊するものではないが、Phase 2 で確定した設計方針からの逸脱であり、Phase 4 着手前に是正することを条件に**条件付き承認**とする。3.1 (二重障害時のエラー上書き) は改善提案として記録し、対応有無は実装判断に委ねる。

未解決指摘: 中 1 件、低 1 件。
