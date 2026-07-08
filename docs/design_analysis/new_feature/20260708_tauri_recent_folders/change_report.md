# Tauri Recent Folders 導入 変更レポート

## 対象

- TODO: `TODO-2026-004 Tauri Recent Folders 導入`
- Branch: `new-feature/tauri-recent-folders`
- Base branch: `main`
- Base commit: `09670869c7db43989f2e3ae9c0734cc03d5f055e`
- Report commit range: `0967086..653d075`
- 作成日: 2026-07-09

## 変更概要

Tauri 版 Markdown Viewer に、最近開いた root directory を `File` / `Recent Folders` から再オープンする機能を追加した。

- React アプリ内 MenuBar の `File` dropdown に `Open Folder...`、`Recent Folders`、`Reload` を集約した。
- root open 成功時に recent entry を app config JSON へ永続化する Rust command を追加した。
- Recent Folders は最大 10 件、重複時は先頭へ昇格、明示削除、存在しない path の error 表示に対応した。
- 起動時に保存済み一覧を復元するが、最後の root は自動 open しない方針にした。
- OS native menu は、React state / busy-state 同期の複雑さに対して今回の最小提供範囲では過剰と判断し、React app-level MenuBar dropdown を採用した。

## Tauri 変更

- `markdown-viewer-tauri/src/App.tsx`
  - `RecentFolderEntry` と recent folders state / busy state を追加した。
  - `loadRoot(path, { recordRecent })` を導入し、`Open Folder...` と Recent Folders entry click の root open 経路を統一した。
  - `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` command を呼び出し、戻り値を UI state に反映するようにした。
  - `File` dropdown 内に Recent Folders list、entry open button、entry delete button、empty state を追加した。
  - Markdown 読み込み失敗と recent 保存失敗が同時に起きた場合は、preview が空になる直接原因の Markdown error を優先表示するようにした。
- `markdown-viewer-tauri/src/App.css`
  - MenuBar dropdown、File menu、Recent Folders list / row / delete button / empty state の style を追加した。
- `markdown-viewer-tauri/src-tauri/src/lib.rs`
  - `RecentFolderEntry`、`AppConfig`、`AppConfigStore` を追加した。
  - app config directory 配下の `settings.json` を read / write する helper を追加した。
  - `AppConfigStore { lock: Mutex<()> }` で read-modify-write を直列化した。
  - `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` command を追加した。

## ドキュメント

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/design_analysis/new_feature/20260708_tauri_recent_folders/`

上記を Recent Folders の責務、UI 操作、app config JSON、Rust command、失敗時動作、既知制約へ同期した。

## レビュー

- Phase 2 design review:
  - `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md`
  - 初回は条件付き承認。
  - command 責務、config write の排他制御、表示名の正本、恒久 docs の旧記述置換、no-markdown root 記録方針を明確化し、follow-up review で承認。
- Phase 3 implementation review:
  - `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_impl_review.md`
  - 初回は条件付き承認。
  - `role="menubar"` の過剰付与を外し、`loadRoot` の二重障害時 error 優先順位を修正して follow-up review で承認。

## Phase 4-a ユーザー確認

ユーザーは Tauri アプリで次を確認した。

- 起動後にディレクトリを開くと、`RECENT FOLDERS` に開いたディレクトリ履歴が表示されること。
- Recent Folders entry の `x` button で履歴を削除できること。
- Recent Folders entry をクリックすると対象ディレクトリが open されること。
- 既存の `Open Folder` / `Reload` / `Theme` が引き続き動作すること。

## 検証結果

自動 / コマンド検証:

- `npm run build` in `markdown-viewer-tauri/`: 成功。Vite の chunk size warning のみ。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。

ユーザー確認:

- Phase 4-a の Tauri アプリ動作確認で、Recent Folders の追加、削除、entry click による再 open、既存 Open / Reload / Theme 操作が期待通りであることを確認済み。

## 生成物

- `diff.zip`: `0967086..653d075` の差分 patch を zip 化したもの。

## 既知制約 / follow-up

- Recent Folders は保存済み一覧の復元のみを行い、最後の root は自動 open しない。
- 存在しない path を Recent Folders から選択した場合は error 表示に留め、自動削除しない。削除は entry の `x` button で明示的に行う。
- OS native menu は今回の最小範囲では採用しない。必要になった場合は、React state / busy-state との同期設計を別途扱う。
- Multi-tab、split view、Avalonia 版 Recent Folders は後続 TODO で扱う。
