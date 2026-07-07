# Tauri MenuBar / StatusBar 導入 履歴

## 背景

UI / UX 拡張 WBS の `WP-001` として、Tauri 版の既存 Toolbar に集約されていた操作と状態表示を分離した。後続の Recent Folders、multi-tab、split view 導入時に、操作領域、root 表示、文書表示、状態表示が衝突しない UI 契約を先に整えることが目的だった。

## 採用したアプローチ

- 既存 Toolbar を React アプリ内の `MenuBar`、`RootPathBar`、`ErrorBanner`、`StatusBar` へ分割した。
- `Open Folder` / `Reload` / theme toggle は MenuBar の常時表示ボタンとして維持し、既存 handler と busy-state disabled 条件を引き継いだ。
- root path は MenuBar 直下、active file と loading state は StatusBar、代表 error は StatusBar 直上の error strip へ分離した。
- Tauri command、Rust backend、保存データ形式、Markdown / Mermaid / PlantUML rendering flow は変更しなかった。
- app shell の全体 overflow を抑止し、Explorer / Preview pane 内だけがスクロールする layout にした。

## 結果

- Tauri 版で操作領域と状態表示領域が分離され、後続 UI 拡張の土台ができた。
- Phase 4-a の publish 確認で出た root path / Error の長文表示、全体スクロールバー、StatusBar 下余白を追加修正した。
- OS native menu は Tauri v2 API で検討可能だが、TODO-2026-003 では non-scope とし、TODO-2026-004 の Recent Folders と合わせて扱うことにした。
- component README / basic design / detail design / interface spec を更新し、完了証跡を change report と archive に集約した。

## 参照

- Design analysis: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/`
- Change report: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/change_report.md`
- Branch: `spec-change/tauri-menubar-statusbar`
- Main commits:
  - `fca3462` Initialize Tauri menu status workflow
  - `7979fce` Draft Tauri menu status design
  - `5bf3226` Approve Tauri menu status design
  - `61e4cd6` Add Tauri menu bar and status bar
  - `6b8d559` Approve Tauri menu status implementation
  - `170e798` Improve root and error status layout
  - `cbe0e55` Constrain Tauri app shell scrolling
  - `5f027b5` Pin Tauri status bar grid row
