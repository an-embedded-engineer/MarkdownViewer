# Tauri Recent Folders 導入 履歴

## 背景

UI / UX 拡張 WBS の `WP-002` として、Tauri 版で最近開いた root directory へ短い操作で戻れる導線を追加した。TODO-2026-003 で整えた React app-level MenuBar を利用し、後続の multi-tab / split view 導入前に root 切り替えの基本 UX を固めることが目的だった。

## 採用したアプローチ

- OS native menu は platform 差分と React state / busy-state 同期が大きいため、今回の最小提供範囲では React app-level MenuBar dropdown を採用した。
- `File` dropdown に `Open Folder...`、`Recent Folders`、`Reload` を配置し、`View` dropdown に既存 Theme 操作を維持した。
- Recent Folders の表示と操作は React、永続化・path canonicalization・最大件数・重複更新・削除は Rust command に集約した。
- app config directory 配下の `settings.json` に recent folders を保存し、`AppConfigStore` の `Mutex` で read-modify-write を直列化した。
- ARIA は native button と dropdown `role="menu"` / item `role="menuitem"` の範囲に留め、矢印キー移動を伴う `role="menubar"` は導入しなかった。

## 結果

- Tauri 版で root open 成功時に Recent Folders が保存され、起動後に一覧が復元されるようになった。
- Recent Folders entry click で root / Explorer / initial Markdown を再オープンできるようになった。
- Recent Folders entry の `x` button で履歴を明示削除できるようになった。
- `Open Folder` / `Reload` / `Theme` の既存導線は維持された。
- component README / basic design / detail design / interface spec を更新し、完了証跡を change report と archive に集約した。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/`
- Change report: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/change_report.md`
- Branch: `new-feature/tauri-recent-folders`
- Main commits:
  - `0967086` Phase 0 define TODO-2026-004 scope
  - `ecab28a` Phase 1 initialize Tauri recent folders workflow
  - `a6da60a` Phase 2 complete Tauri recent folders design
  - `3a33830` Phase 3 implement Tauri recent folders
  - `632f0a2` Phase 3 address implementation review
  - `653d075` Phase 3 complete Tauri recent folders implementation
