# Tauri Multi-tab core 導入 実装記録

## 実装概要

Phase 2承認設計に従い、Tauri frontendの単一Markdown stateを`OpenDocumentTab[]`と`activeTabId`へ移行し、TabStripを追加した。Rust command契約、Tauri capability、永続化形式は変更していない。

## 設計と実装の対応

| 設計項目 | 実装 |
| --- | --- |
| tab collectionを文書stateの正本にする | `OpenDocumentTab`、`tabs`、`activeTabId`を追加し、旧`selectedFilePath` / `selectedMarkdown` / global PlantUML stateを削除 |
| open-or-activate | Explorerとrelative Markdown linkを`openOrActivateTab`へ統合。同一pathを重複openしない |
| async競合guard | `updateTabIfCurrent(tabId, revision, updater)`でMarkdown / PlantUML / Mermaid結果をguard |
| tab単位cache | Markdown、loadState、error、PlantUML結果を各tabへ保持。activate / themeだけではPlantUMLを再実行しない |
| close規則 | activeは右隣→左隣、非activeはselection維持、最後は未選択 |
| pane-level anchor | `pendingNavigation: { tabId, anchor } | null`をApp直下に保持 |
| TabStrip | active/loading/rendering/error、横overflow、独立close button、roving tabindex、ArrowLeft / ArrowRight / Home / End |
| root変更 | `scan_directory`成功後にroot / tree / tabsを交換。scan失敗は旧state維持 |
| Reload | tree scan後にactive tabだけrevisionを増やして再読込。失敗時は直前contentを保持 |
| busy分離 | `isRootLoading || isRecentFoldersBusy`だけをglobal busyとし、tab処理中もactivate / close / openを許可 |
| StatusBar | `Loading folder...` > `Updating recent folders...` > active loading > active rendering > Ready |

## 変更ファイル

- `markdown-viewer-tauri/src/App.tsx`
  - tab型、tab state、操作handler、async guard、TabStrip、tab-aware preview effects。
- `markdown-viewer-tauri/src/App.css`
  - PreviewWorkspace 2行grid、TabStrip、active / loading / error / focus、horizontal overflow。
- `markdown-viewer-tauri/README.md`
  - tabsがMVP外という旧記載を削除し、multi-tab操作と非対象を更新。
- `docs/components/tauri_viewer/README.md`
  - TabStripとtab state責務を追加。
- `docs/components/tauri_viewer/basic_design.md`
  - `OpenDocumentTab` data contractとcomponent / state構成を更新。
- `docs/components/tauri_viewer/detail_design.md`
  - state、open / activate / close / Reload、async guard、link / diagram flowを更新。
- `docs/components/tauri_viewer/interface_spec.md`
  - ユーザー操作、TabStrip、StatusBar値、frontend typeを更新。

## 設計差分

- 設計差分なし。
- 設計レビューRound 2で確定したroving focus、pane-level navigation、StatusBar優先順位、PlantUML並行実行の許容、非active close規則を実装へ反映した。

## エラー・競合制御

- root scan errorは`rootOperationError`へ置き、root / tabsをrollback不要なcommit前stateのまま維持する。
- tab read / diagram errorはtabへ保持し、active tabだけErrorBannerへ表示する。非active errorはTabStripのError表示で確認できる。
- Reload前、close済み、旧rootのresponseはtab lookupまたはrevision不一致により無視する。
- 複数tabのPlantUML commandは並行し得る。MVPでは直列queueや上限を追加せず、Phase 4手動確認で問題があればfollow-up化する。

## 恒久ドキュメント反映

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `markdown-viewer-tauri/README.md`

## 検証結果

- `npm run build` in `markdown-viewer-tauri/`: 成功。既知のVite chunk size warningのみ。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。
- 専用自動test / integration test: projectに未整備。主要導線変更のためPhase 4でpublish appを手動確認する。

## Phase 4手動確認項目

- 複数Markdown open、同一path再選択、active / inactive / last tab close。
- Reload active tab、theme、relative Markdown link / anchor、relative image、external URL。
- Mermaid / PlantUML混在、pending / success / syntax error、複数PlantUML文書の連続open。
- 描画中のtab切替 / closeでactive preview / errorが上書きされないこと。
- root変更成功 / scan失敗、Recent Folders、StatusBar / ErrorBanner。
- 多数tab horizontal overflow、ArrowLeft / ArrowRight / Home / End、close後focus。

## 既知制約

- split view、tab永続化、reorder、pin、drag and drop、tab別scroll位置は対象外。
- 多数の巨大文書をopenした場合のmemory上限とPlantUML並行数制限は設けていない。
- 自動UI testは未整備。
