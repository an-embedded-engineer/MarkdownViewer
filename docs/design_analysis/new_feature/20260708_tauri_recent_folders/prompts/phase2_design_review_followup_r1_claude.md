# Phase 2 design review follow-up r1: Tauri Recent Folders

レビュー指摘の対応が完了しました。

対象:

- workflow: new-feature
- review kind: Phase design review follow-up
- issue id/title: `TODO-2026-004 Tauri Recent Folders 導入`
- review document path: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md`
- previous review commit: `dec7482 Phase 2 add Tauri recent folders design review`
- fix commit: `25d3082 Phase 2 address Tauri recent folders design review`

確認してほしいこと:

- 1.1: 追加 command 一覧が `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` に統一され、`save_recent_folders` は不採用理由としてのみ残っているか。
- 1.2: app config JSON の read-modify-write を `tauri::State<AppConfigStore>` + `std::sync::Mutex<()>` で直列化する方針が明記されたか。
- 1.3: Recent Folders の主表示は `entry.name` を正本にし、リネーム後の既知挙動が明記されたか。
- 2.1: Phase 3 docs 更新で既存の「ドロップダウンを導入しない」記述を追記ではなく置換する方針が明記されたか。
- 3.1: Markdown file が 1 つもない root でも `scan_directory` 成功後は recent entry 保存対象とする方針が明記されたか。

未解決指摘があれば `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md` に追記して commit してください。

問題なければ、承認したことが分かる形で出力してください。レビュー文書を更新した場合のみ commit してください。
