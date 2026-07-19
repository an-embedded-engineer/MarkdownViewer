# Tauri Viewer 設定永続化・設定 UI 導入 履歴

## 背景

Tauri版を継続利用する際、window sizeとThemeを起動ごとに調整し直し、PlantUML runtimeを利用するために配置や設定ファイルを手作業で管理する必要があった。既存Recent Foldersが使用するapp config JSONを拡張し、Viewer設定の正本とアプリ内変更導線を提供することにした。

## 採用したアプローチ

- `settings.json`を`AppConfig { recentFolders, viewerSettings }`として型付き管理し、旧Recent FoldersだけのJSONはserde defaultで互換読込する。
- Theme、logical window size、canonical absolute `plantuml.jar` pathをRust `AppConfigStore`のfield-specific updateで保存する。
- frontend startupではsettingsとRecent Foldersを読み、保存Themeを描画前に適用してDark theme flashを避ける。
- window resizeはphysical sizeからlogical sizeへ変換し、maximized / minimized / fullscreenを除外して500ms debounceで保存する。
- `File > Settings...`にTheme、current window size、jar path、Browse / Clear / Save / Cancelを集約し、`View > Theme`と同じ永続化経路を使う。
- app configはtemporary fileの全量write / sync後にplatform別atomic replaceする。replace成功をlogical commit pointとし、その後のdirectory sync失敗はlogical success + durability warningとする。
- app config明示jarがある場合は最優先し、missingでも別jarへ黙ってfallbackしない。Clearした場合だけ従来のruntime directory探索へ戻る。

## 結果

- window size、Theme、PlantUML jar pathがアプリ再起動後も復元されるようになった。
- Settings dialogとView menuのTheme変更が同じ保存値へ同期されるようになった。
- 明示jar pathとautomatic discoveryの両方でPlantUMLを利用できるようになった。
- 既存Recent FoldersとViewer settingsを単一Storeで安全に共存させた。
- atomic writeのpre/post commit境界、modal focus containment、file picker error handlingを実装レビューで補強した。
- Viewer settingsとSplit viewをMulti-tab core後の独立work packageとし、Tauri UX評価で合流する順序へ整理した。

## 検証

- ユーザーがSettings表示、両導線からのTheme同期、window size表示、明示／未指定jar描画、再起動復元を確認した。
- `npm run build`、`cargo check`、`cargo test`（10件）、`cargo fmt -- --check`、`git diff --check`が成功した。
- design / implementation reviewはいずれも最終承認され、Phase 3未解決指摘は0件となった。
- Windows実環境検証は`TODO-2026-016`へ引き継いだ。

## 参照

- Design analysis: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/`
- Change report: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/change_report.md`
- Branch: `new-feature/tauri-viewer-settings`
- Main commits:
  - `4b50af2` Phase 0 requirements
  - `0d7342e` Phase 2 design approved
  - `0923219` Phase 3 implementation
  - `cd13c37` Phase 3 review response
  - `5321270` Phase 3 implementation approved
  - `dc97286` Phase 4-a user verification
- Completed: `2026-07-19`
