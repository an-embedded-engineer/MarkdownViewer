# Tauri Viewer 設定永続化・設定 UI 実装記録

## 1. 対象

- TODO: `TODO-2026-014 Tauri Viewer 設定永続化と設定 UI 導入`
- Design: `design/tauri_viewer_settings_feature_design.md`
- Branch: `new-feature/tauri-viewer-settings`

## 2. 実装概要

既存Tauri app config directoryの`settings.json`を型付き`AppConfig`として拡張し、Recent Foldersと次のViewer settingsを同一Storeで永続化した。

- Theme: `light` / `dark`
- logical window width / height
- canonical absolute `plantuml.jar` path、またはautomatic discoveryを表す`null`

Reactには`File > Settings...` modal、永続Theme切替、startup settings load、500ms debounceのwindow resize保存を追加した。Rustにはfield-specific command、Store lock内read-modify-write、cross-platform atomic replace、起動時window size復元、明示PlantUML path優先を追加した。

## 3. Source変更

### 3.1 Rust backend

対象: `markdown-viewer-tauri/src-tauri/src/lib.rs`

- `AppTheme`、`WindowSize`、`ViewerSettings`、`ViewerSettingsLoadResult`を追加した。
- `AppConfig`に`#[serde(default)]`付き`viewerSettings`を追加し、Recent Foldersだけの旧JSONをmigrationなしで読めるようにした。
- `AppConfigStore::load` / `update`へlockとread-modify-writeを集約し、Recent Folders commandも同じ経路へ統合した。
- `load_viewer_settings`、`save_viewer_preferences`、`save_window_size`を追加した。
- 範囲外window sizeは800 x 600へ部分正規化しwarningを返す。malformed JSONは`Err`とし、自動上書きしない。
- app configはsibling temporary fileへ全量write / `sync_all`後に置換する。Unixはrename、Windowsは`MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)`を使う。replace成功をlogical commit pointとし、後続directory sync失敗はlogical saveを失敗に戻さずdurability warningとしてstderrへ記録する。
- Windows APIはtarget-specific `windows-sys` dependencyとして追加し、Unix buildへ混入させない。
- `Builder::setup`でmain windowへ保存済みlogical sizeを適用する。
- PlantUML command開始時にStoreからruntimeを1回解決し、全diagramへ共有する。明示pathがある場合はinvalid / missingでもautomatic discoveryへfallbackしない。

### 3.2 React frontend

対象: `markdown-viewer-tauri/src/App.tsx`, `App.css`

- startupで`load_viewer_settings` / `load_recent_folders`を`Promise.allSettled`し、Dark theme flashを避けるloading shellを追加した。
- foreground config操作はoperation count、background resizeは独立したserial queueとして管理した。
- `View > Theme`を`save_viewer_preferences`経由へ変更し、保存成功後だけThemeへ反映する。
- `File > Settings...`と`SettingsDialog`を追加した。Theme、current logical window size、jar path、Browse、Clear、Save / Cancelを提供する。
- dialogはdraft state、dialog内validation error、initial focus、Escape / backdrop close、Tab focus loopを持つ。backgroundは`inert`にし、保存中に全controlがdisabledでもdialog containerへfocusを保持する。
- PlantUML jar file pickerのplugin / OS errorをdialog内alertへ表示し、Cancelはerrorにしない。
- Tauri window resizeをlogical sizeへ変換し、maximized / minimized / fullscreen中を除外して500ms後に保存する。
- resize eventにはrevision guard、save commandにはsingle-flight + latest pending queueを使い、古いevent / completionが最新値を上書きしないようにした。
- Settings dialog用Light / Dark CSS、狭いwindow向けresponsive layoutを追加した。

### 3.3 Manifest / capability

- `Cargo.toml` / `Cargo.lock`: Windows atomic replace用`windows-sys 0.61`をtarget-specific追加。
- `capabilities/default.json`: 変更なし。window size read / resize eventは既存`core:default`、file pickerは既存`dialog:default`で利用できる。
- frontend package追加なし。

## 4. 設計との差分

- 設計どおり`SettingsDialog`は`App.tsx`内のtyped componentとし、I/OはApp / Rust Storeへ残した。独立fileへの分割は不要と判断した。
- 設計のresize revision方針を、event解決順のrevision guardとsingle-flight pending queueの組合せで具体化した。
- 範囲外window sizeのwarningはstartupで表示し、同じstartup処理から正規化sizeを`save_window_size`へ送り修復する。resize event発火だけには依存しない。
- platform固有atomic replace helperはframework contract境界のmodule-level functionとした。Storeのwrite経路からだけ呼び、一般用途APIにはしない。
- 初回実装レビューを受け、replace操作とdirectory syncを注入可能なhelper境界へ分離した。pre-commit replace失敗は旧documentを維持し、post-commit directory sync失敗は新documentを保持したlogical successとしてtestする。
- TODO/WBS/Phase 2設計の実行順を正式改訂した。Viewer settings（TODO-2026-014）とSplit view（TODO-2026-006）はMulti-tab core（TODO-2026-005）後の独立work packageとし、TODO-2026-007で両機能を統合UX評価する。

## 5. 恒久ドキュメント反映

- `docs/components/tauri_viewer/README.md`: Settings機能、command、Store責務。
- `docs/components/tauri_viewer/basic_design.md`: typed settings model、state / dependency。
- `docs/components/tauri_viewer/detail_design.md`: JSON schema、atomic write、startup / resize / PlantUML優先順位、error handling。
- `docs/components/tauri_viewer/interface_spec.md`: UI操作、dialog、commands、frontend types。
- `docs/rules/development_workflow.md`: Tauri PlantUML設定優先順位、unit test、手動確認項目。
- `markdown-viewer-tauri/README.md`: 利用者向けSettings機能。

## 6. Automated verification

2026-07-19実行:

| Command | Result |
| --- | --- |
| `cd markdown-viewer-tauri && npm run build` | Pass。TypeScript / Vite build成功。既存のchunk size warningのみ |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | Pass |
| `cd markdown-viewer-tauri/src-tauri && cargo test` | Pass。10 tests、0 failed |
| `cd markdown-viewer-tauri/src-tauri && cargo fmt -- --check` | Pass |
| `git diff --check` | Pass。レビュー指摘対応working treeにwhitespace errorなし |

Rust tests:

- 旧Recent Folders JSONのdefault settings migration。
- 無効window sizeの部分正規化と有効preferences維持。
- window size境界。
- `.jar` / `.JAR` validation。
- atomic config replace成功。
- temporary file作成失敗時の旧config維持。
- 注入したreplace失敗時の旧config維持。
- replace成功後のdirectory sync失敗がwarningとなり、新configとlogical successが一致すること。
- 無効な明示PlantUML pathがautomatic discoveryへfallbackしないこと。
- 既存Windows path boundary test。

検証hostにinstall済みのRust targetは`aarch64-apple-darwin`だけであり、Windows target build / `MoveFileExW`実環境testは未実施。target-specific dependencyと`#[cfg(windows)]`境界はmacOSのdependency解決・source reviewで確認し、Windows実機検証はPhase 4のplatform verification項目として明示的に残す。

## 7. Integration smoke test

`cd markdown-viewer-tauri && npm run tauri dev`を実行し、次を確認した。

- Vite dev server起動。
- Rust dev build成功。
- `target/debug/markdown-viewer-tauri`起動。
- `@tauri-apps/api/window` dependency最適化後のreload。
- startup command登録、window restore、WebView初期化でterminal errorなし。

専用E2E test frameworkは未整備である。実filesystem I/OはRust testがtemporary directoryへ書き込み、旧config保持とatomic replaceを検証した。

## 8. Phase 4-a ユーザー動作確認

2026-07-19にユーザーがTauriアプリで次を確認し、全項目OKと報告した。

1. `File > Settings...`からSettings dialogが表示される。
2. Settings dialogでThemeを変更し、Save後にアプリへ反映される。
3. app windowのresizeに応じてSettings dialog内の現在window size表示が変化する。
4. `plantuml.jar` pathの明示指定時と未指定時のautomatic discoveryのどちらでもPlantUMLを正しく描画できる。
5. `View > Theme`からの変更がSettings dialog側の現在値にも反映される。
6. アプリ再起動後も保存済みwindow size、Theme、PlantUML jar path設定が復元された状態で起動する。

以上により、TODO-2026-014のPhase 4-aユーザー動作確認は完了した。

## 9. 既知制約・Phase 4引き継ぎ

- window position、maximized / minimized / fullscreen状態、folder / tab / split paneは永続化しない。
- 複数app instance間のcross-process transactionは対象外。単一process内はStore lockで直列化する。
- 明示jar pathを設定後にfileを削除した場合はPlantUML errorとなり、Settingsで修正またはClearするまでfallbackしない。
- malformed JSONは既定Themeで閲覧を継続するが、Recent Folders保護のため設定更新で上書きしない。
- Viewer settingsと`TODO-2026-006 Tauri Split view`はMulti-tab core後の独立work packageである。本featureのPhase 4では現行single-pane回帰を確認し、Split view完了後の両pane統合回帰は両機能を完了条件とする`TODO-2026-007`で実施する。
- Windows target build、既存destination置換、Unicode / verbatim pathはmacOS hostでは実施できないため、Windows環境でのplatform verificationへ引き継ぐ。
