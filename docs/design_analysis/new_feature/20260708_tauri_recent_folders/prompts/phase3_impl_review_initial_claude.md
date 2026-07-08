# Phase 3 implementation review: Tauri Recent Folders

あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: new-feature
review kind: Phase impl review
issue id/title: `TODO-2026-004 Tauri Recent Folders 導入`
issue directory: `docs/design_analysis/new_feature/20260708_tauri_recent_folders`
review target commit: `3a33830 Phase 3 implement Tauri recent folders`
review document path: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_impl_review.md`

下記を確認し、レビュー結果を review document path に反映し、コミットまで実施してください。

## Primary review inputs

- `docs/design_analysis/new_feature/20260708_tauri_recent_folders/meta.md`
- `docs/design_analysis/new_feature/20260708_tauri_recent_folders/design/tauri_recent_folders_feature_design.md`
- `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md`
- `docs/design_analysis/new_feature/20260708_tauri_recent_folders/impl/tauri_recent_folders_feature_impl.md`
- `docs/todo/todo.md`

## Implementation files

- `markdown-viewer-tauri/src/App.tsx`
- `markdown-viewer-tauri/src/App.css`
- `markdown-viewer-tauri/src-tauri/src/lib.rs`

## Permanent docs

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`

## Review checkpoints

- Phase 2 承認済み設計と実装が一致しているか。
- `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` だけが追加 command として実装され、不要な `save_recent_folders` / `validate_recent_folder` 相当の経路が増えていないか。
- app config JSON の read-modify-write が `AppConfigStore` の `Mutex` で直列化され、race を持ち込んでいないか。
- `record_recent_folder` が canonical path、重複の先頭移動、最大 10 件 truncate、`entry.name` snapshot、no-markdown root の保存を満たしているか。
- Recent Folders entry click の missing path は error 表示に留め、自動削除しない設計になっているか。
- frontend が duplicate promotion / truncate / path validation を重複実装せず、Rust command 戻り値を `recentFolders` state に反映しているか。
- MenuBar dropdown が `Open Folder...`、`Recent Folders`、`Reload`、`Theme` の既存導線を壊していないか。
- `isBusy` が Markdown / PlantUML / Recent Folders を含み、重複操作を抑止できているか。
- 恒久 docs が今回仕様へ同期され、旧「ドロップダウンを導入しない」制約が恒久 docs に残っていないか。
- 検証結果 (`npm run build`, `cargo check`, `git diff --check`) が impl doc と一致しているか。

未解決指摘がある場合は severity と根拠ファイル/行を明記してください。問題なければ Phase 3 実装レビュー承認と分かる結論を記載してください。
