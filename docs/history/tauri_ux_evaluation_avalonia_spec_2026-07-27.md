# Tauri先行UX評価・Avalonia反映仕様化 履歴

## 背景

Tauri版でMenu / Status、Recent Folders、Multi-tab、Settings、trusted HTML、Explorer UX、responsive preview、image viewer、左右2pane Split Viewの主要機能が揃った。一方、Avalonia追随todoは機能追加のたびに増え、同じ`MainWindow` shellやuser config基盤を別workflowで繰り返し変更する構成になっていた。Split Viewにもpane-local tab group、pane間移動、上下splitのfollow-upが個別登録されていた。

## 採用した整理

- Tauriの評価結果を`confirmed` / `specified` / `follow-up`に分け、未実施のplatform / accessibility matrixを成功扱いしない。
- 共通の利用者outcomeと、React / Rust / Tauri固有の内部方式を分離し、AvaloniaではXAML / MVVM / NativeWebView / .NET Serviceへ適応する。
- TODO-2026-023へTODO-2026-024を統合し、pane-local ownershipとpane間移動を同じtyped transitionで扱う。
- TODO-2026-008へTODO-2026-020を統合し、Menu / StatusとExplorer layoutをshell foundationとしてまとめる。
- TODO-2026-009へTODO-2026-015を統合し、Recent FoldersとViewer settingsを同じtyped user config基盤へまとめる。
- trusted HTML (TODO-2026-018)をMulti-tab (TODO-2026-010)より先に置き、typed Markdown / HTML document modelを一度だけ構築する。
- Multi-tabとSplit ViewはNativeWebView lifecycleのリスク境界が異なるため分離を維持する。

## 結果

Avalonia rolloutは次の順序へ整理された。

1. TODO-2026-008 shell / Explorer UX foundation
2. TODO-2026-009 settings / Recent FoldersとTODO-2026-018 trusted HTML（並行可能）
3. TODO-2026-010 Multi-tab
4. TODO-2026-011 Split View baseline
5. TODO-2026-012 final docs sync

Tauri TODO-2026-023 / 025はAvaloniaの左右2pane baselineをブロックしない。完了時の両実装への採否はTODO-2026-012で再評価する。

## 参照

- Avalonia反映仕様: `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`
- Design analysis: `docs/design_analysis/documentation/20260727_tauri_ux_evaluation_avalonia_spec/`
- Updated WBS: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`
- Active todo: `docs/todo/todo.md`
- Integrated todo records: `docs/todo/todo_archive_2026.md`
