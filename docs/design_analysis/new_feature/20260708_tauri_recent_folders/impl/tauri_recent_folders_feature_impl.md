# Tauri Recent Folders 導入 実装記録

## 対象

- TODO: `TODO-2026-004 Tauri Recent Folders 導入`
- Branch: `new-feature/tauri-recent-folders`
- Design: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/design/tauri_recent_folders_feature_design.md`
- Review: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md`

## 実装方針

Phase 2 の承認済み設計に従い、OS native menu ではなく React app-level の window-top MenuBar dropdown を採用した。`File` dropdown に `Open Folder...`、`Recent Folders`、`Reload` を集約し、Recent Folders の表示・操作は React、永続化・path 検証・最大件数・重複更新は Rust command に集約した。

## 実装差分

### Frontend

- `markdown-viewer-tauri/src/App.tsx`
  - `RecentFolderEntry`、`ActiveMenu`、`recentFolders`、`activeMenu`、`isRecentFoldersBusy` を追加。
  - 起動時に `load_recent_folders` を呼び、保存済み Recent Folders を復元。
  - `loadRoot(path, { recordRecent })` を導入し、`Open Folder...` と Recent Folders entry click の root open 経路を統一。
  - `scan_directory` 成功後は initial Markdown の有無や読み込み成否に関わらず `record_recent_folder` を呼ぶ。
  - Recent Folders entry click で missing path の error を表示し、entry は自動削除しない。
  - Recent Folders delete button で `remove_recent_folder` を呼び、明示削除する。
  - `isBusy` に `isRecentFoldersBusy` を含め、Recent Folders 更新中の重複操作を抑止。
  - `MenuBar` を dropdown UI に変更し、top-level trigger は native button + `aria-haspopup="menu"` / `aria-expanded`、dropdown は `role="menu"` / `role="menuitem"`、layout wrapper は `role="none"` とした。outside click close、Escape close を追加。
  - `loadRoot` 内で initial Markdown 読み込みと recent 保存が同時に失敗した場合、Markdown 読み込み失敗を recent 保存失敗で上書きしないようにした。

- `markdown-viewer-tauri/src/App.css`
  - `.menu-trigger`、`.menu-dropdown`、`.file-menu-dropdown`、Recent Folders list / row / delete button / empty state のスタイルを追加。
  - 既存 app-shell、RootPathBar、ErrorBanner、StatusBar の grid 構成は維持。

### Backend

- `markdown-viewer-tauri/src-tauri/src/lib.rs`
  - `RecentFolderEntry`、`AppConfig`、`AppConfigStore` を追加。
  - `load_recent_folders`、`record_recent_folder`、`remove_recent_folder` command を追加。
  - `AppConfigStore { lock: Mutex<()> }` を Tauri state として登録し、app config JSON の read-modify-write を直列化。
  - Tauri app config directory 配下 `settings.json` に `recentFolders` を pretty JSON で保存。
  - `record_recent_folder` で canonical path を正本化し、同一 path の重複削除、先頭挿入、最大 10 件 truncate、`name` snapshot、`lastOpenedAt` 更新を実施。
  - `remove_recent_folder` は path の存在確認をせず、保存済み entry の明示削除だけを行う。

## 恒久ドキュメント反映

- `docs/components/tauri_viewer/README.md`
  - Recent Folders の責務、追加 command、app config JSON への永続化を反映。
- `docs/components/tauri_viewer/basic_design.md`
  - React / Rust 責務、`RecentFolderEntry`、state model、Rust command 群を反映。
- `docs/components/tauri_viewer/detail_design.md`
  - TODO-2026-003 由来の「ドロップダウンを導入しない」記述を、新しい MenuBar dropdown 仕様へ置換。
  - Recent Folders の data model、settings JSON、排他制御、UI 操作、失敗時動作を追加。
- `docs/components/tauri_viewer/interface_spec.md`
  - File / View dropdown 操作、Recent Folders entry / delete UI、追加 command、frontend type を追加。

## 設計差分

- Phase 2 設計からの意図的な仕様変更はない。
- `MenuBar` は review 指摘を受け、`role="menubar"` を付与しない方針へ戻した。矢印キー移動とフォーカストラップは引き続き非対象であり、top-level trigger は native button として扱う。
- `lastOpenedAt` は設計通り Unix seconds の decimal string とし、UI 表示には使わない。

## 検証結果

| コマンド | 結果 | 備考 |
| --- | --- | --- |
| `npm run build` (`markdown-viewer-tauri/`) | Pass | Vite の既存 chunk size warning のみ |
| `cargo check` (`markdown-viewer-tauri/src-tauri/`) | Pass | `dev` profile |
| `git diff --check` | Pass | whitespace error なし |

## 実装レビュー対応

### 1.1 MenuBar ARIA role 過剰付与

`App.tsx` から `header.menu-bar` の `role="menubar"` と `File` / `View` trigger の `role="menuitem"` を削除した。trigger は native button のまま `aria-haspopup="menu"` / `aria-expanded` を持つ構成に戻した。

`role="menu"` 配下の `.recent-folder-list` / `.recent-folder-row` などの layout wrapper には `role="none"` を付与し、recent entry open button と delete button はどちらも menu action として `role="menuitem"` に揃えた。empty state は disabled menu item として `role="menuitem"` / `aria-disabled="true"` を付与した。

### 3.1 `loadRoot` の二重障害時エラー上書き

`loadMarkdown` が失敗 message を戻り値として返すようにし、`loadRoot` は Markdown 読み込み失敗がある場合に `recentError` で error strip を上書きしないようにした。これにより、initial Markdown 読み込み失敗と recent 保存失敗が同時に起きた場合は、preview が空になる直接原因の Markdown エラーを優先表示する。

## 手動確認観点

- `Open Folder...` から folder を開くと Recent Folders に追加される。
- 同じ folder を再度開くと重複せず先頭へ移動する。
- 11 件以上開くと最大 10 件に丸められる。
- Recent Folders entry click で root / Explorer / initial Markdown が再オープンされる。
- Recent Folders entry の delete button で一覧から消え、再起動後も消えたままになる。
- 存在しない path の entry click で ErrorBanner に代表 error が出て、現在の root は維持される。
- app 再起動後に Recent Folders 一覧が復元される。
- busy 中は Open Folder / Recent Folders / Reload / Theme が重複実行されない。

## 既知制約

- Recent Folders は保存済み一覧の復元のみを行い、最後の root を自動 open しない。
- 保存後に folder が OS 側でリネームされた場合、`name` は保存時点の snapshot のまま残る。
- config JSON parse 失敗時は自動修復せず、ErrorBanner に表示する。
- 矢印キー移動、typeahead、roving tabindex は今回の対象外。
