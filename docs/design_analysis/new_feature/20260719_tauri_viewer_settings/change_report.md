# Tauri Viewer 設定永続化・設定 UI 変更レポート

## 対象

- TODO: `TODO-2026-014 Tauri Viewer 設定永続化と設定 UI 導入`
- Branch: `new-feature/tauri-viewer-settings`
- Base branch: `main`
- Base / Phase 0 commit: `4b50af22aa51252f32319e6e0e7f7cc3693ce9f8`
- Report commit range: `4b50af2..dc97286`（抽出ツールは開始commitを含む）
- 作成日: 2026-07-19

## 変更概要

既存Tauri app config directoryの`settings.json`へViewer settingsを追加し、Recent Foldersと同じ型付きStoreで永続化した。

- logical window width / heightをresize後に保存し、次回起動時に復元する。
- Light / Dark Themeを`View` menuとSettings dialogのどちらからでも保存・同期する。
- canonical absolute `plantuml.jar` path、または`null`によるautomatic discoveryを保存する。
- `File > Settings...`から現在値を確認し、Themeとjar pathを変更できるmodal UIを提供する。
- 旧Recent Folders JSONをserde defaultで読み、field-specific updateとStore lockで他設定のlost updateを防ぐ。

## 実装

- `markdown-viewer-tauri/src-tauri/src/lib.rs`
  - `AppTheme`、`WindowSize`、`ViewerSettings`、`ViewerSettingsLoadResult`を追加した。
  - app configのload / partial update / atomic replaceを`AppConfigStore`へ集約した。
  - sibling temporary fileのwrite / sync後にplatform別replaceを行い、replace成功をlogical commit pointとした。
  - 起動時window restoreと、app config明示jarを最優先するPlantUML runtime解決を追加した。
- `markdown-viewer-tauri/src/App.tsx` / `App.css`
  - startup settings load、永続Theme action、500ms debounceのresize保存queueを追加した。
  - Settings dialog、Browse / Clear / Save / Cancel、validation / picker error表示を追加した。
  - dialog表示中のbackgroundを`inert`にし、保存中もfocusをdialog内へ保持する。
- `Cargo.toml` / `Cargo.lock`
  - Windows atomic replace用にtarget-specific `windows-sys` dependencyを追加した。

## ドキュメント

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`
- `markdown-viewer-tauri/README.md`

設定schema、保存契約、startup / resize、Settings UI、PlantUML runtime優先順位、エラー境界、利用方法を上記へ同期した。Viewer settingsとSplit viewはMulti-tab core後の独立work packageとし、TODO-2026-007で統合UX評価するようTODO / WBS / designも改訂した。

## レビュー

- Phase 2 design review:
  - 初回条件付き承認後、invalid window sizeの部分復旧、atomic replace、config操作の競合制御を設計へ反映し、Round 2で承認された。
- Phase 3 implementation review:
  - 初回条件付き承認後、Split view依存順、post-replace sync semantics、modal focus、failure tests、PlantUML command契約、picker error、恒久docsを修正し、Round 2で承認された。
- Phase 3未解決指摘: 0件。

## Phase 4-a ユーザー確認

ユーザーが2026-07-19に次を確認し、全項目OKと報告した。

- Settings dialogが表示される。
- Settings dialogでThemeを変更し、Save後に反映される。
- window resizeに応じてSettings dialogのcurrent window size表示が変化する。
- `plantuml.jar` pathの明示指定時と未指定時の両方でPlantUMLを描画できる。
- `View > Theme`の変更がSettings dialog側にも反映される。
- アプリ再起動後も保存済み設定が復元された状態で起動する。

## 最終自動検証

- `npm run build` in `markdown-viewer-tauri/`: 成功。既知のVite chunk size warningのみ。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `cargo test` in `markdown-viewer-tauri/src-tauri/`: 成功。10 tests、0 failed。
- `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。
- implementation review Round 2: 承認、Phase 3未解決0件。

## 生成物

- `diff.zip`: `tools/ExtractGitDiff`を使用し、`4b50af2..dc97286`を抽出した。
- 12コミット、18変更ファイルを収録した。
- archive内49 entryを`unzip -t`で検査し、エラーなしを確認した。

## 既知制約 / follow-up

- window position、maximized / minimized / fullscreen状態、folder / tab / split paneは永続化しない。
- 複数app instance間のcross-process transactionは対象外である。
- malformed JSONはRecent Folders保護のため自動上書きしない。
- Split viewとの両pane統合UXは`TODO-2026-007`で評価する。
- Windows target build、`MoveFileExW`による既存destination置換、Unicode / verbatim pathはmacOS hostで未検証のため`TODO-2026-016`で追跡する。
- Avalonia水平展開はTauri先行UX評価後の`TODO-2026-015`で行う。
