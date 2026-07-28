# 実装履歴

## 目的

大きな実装変更の経緯と判断根拠を記録し、将来の参照に供する。

## ドキュメント作成ガイドライン

- ファイル名: `<topic>_<YYYY>.md` または `<topic>_<YYYY-MM-DD>.md`
- 内容: 背景、課題、採用したアプローチ、結果
- 対象: アーキテクチャ変更、大規模リファクタリング、パフォーマンス改善等

## 履歴一覧

- 初期MVP実装は `git log` と `docs/design_analysis/new_feature/markdown_viewer_mvp_comparison_initial_design/markdown_viewer_mvp_design_tauri_avalonia.md` を参照する。
- PlantUML表示対応: `docs/history/plantuml_rendering_support_2026-05-21.md`
- PlantUML loading UX follow-up: `docs/history/plantuml_loading_ux_follow_up_2026-06-14.md`
- Tauri MenuBar / StatusBar 導入: `docs/history/tauri_menubar_statusbar_2026-07-07.md`
- Tauri Recent Folders 導入: `docs/history/tauri_recent_folders_2026-07-09.md`
- Tauri Multi-tab core 導入: `docs/history/tauri_multi_tab_core_2026-07-12.md`
- Tauri Viewer 設定永続化・設定 UI 導入: `docs/history/tauri_viewer_settings_2026-07-19.md`
- Tauri HTML形式仕様書表示対応: `docs/history/tauri_html_document_viewing_2026-07-19.md`
- Tauri Explorer ツリーペイン UX 改善: `docs/history/tauri_explorer_pane_ux_2026-07-22.md`
- Tauri document preview 横幅の可変化: `docs/history/tauri_document_preview_responsive_width_2026-07-25.md`
- Tauri Markdown画像オーバーレイ表示: `docs/history/tauri_markdown_image_overlay_2026-07-26.md`
- Tauri Split view 導入: `docs/history/tauri_split_view_2026-07-26.md`
- Tauri先行UX評価・Avalonia反映仕様化: `docs/history/tauri_ux_evaluation_avalonia_spec_2026-07-27.md`
- Tauri pane-local tab group / pane間移動: `docs/history/tauri_pane_local_tab_groups_2026-07-29.md`
- 大きな仕様変更、採用判断、publish方式の変更が発生した場合に履歴文書を追加する。
