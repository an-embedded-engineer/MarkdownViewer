# TODO Archive 2026

## TODO-2026-023 Tauri pane-local tab group / pane 間移動

- Status: `done`
- Category: `new-feature`
- Created: `2026-07-28`
- Completed: `2026-07-29`
- Branch: `new-feature/tauri-pane-local-tab-groups`
- Depends on: `TODO-2026-006`
- Integrated TODO: `TODO-2026-024`
- Source design: `docs/design_analysis/new_feature/20260726_tauri_split_view/`
- Design analysis: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/`
- Change report: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/change_report.md`
- Verification: `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/verification/phase4a_user_verification.md`
- Summary:
  - global `OpenDocumentTab[]`をdocument dataの正本として維持し、primary / secondaryへordered tab IDsとactive tabを持つpane-local groupを追加した。
  - Explorer / relative linkからactive paneへtabを追加し、paneごとのactivate / close / fallback、split off / on保持、root resetをtyped transitionで一貫させた。
  - 同じdocument dataを両paneから参照しながらpreview runtimeをpane / tab / revisionで分離し、明示操作によるatomicなpane間moveとfocus復旧を実装した。
  - Phase 4-aの指摘を受けてTabStripを固定高にし、状態表示やscrollbar有無による左右paneの段差と過度な縮小を解消した。
  - Rust command、custom protocol、capability、CSP、trusted HTML security boundaryは変更していない。
- Verification:
  - ユーザーがpane-local tab追加・選択・close・pane間moveを確認し、固定高修正後に高さが一定で過度な縮小も再発しないことを2026-07-29に確認した。
  - `npm test -- --run`: 5 files / 77 tests、0 failures。`npm run build`: 成功（既知のchunk size warningのみ）。
  - `cargo fmt -- --check` / `cargo check`: 成功。`cargo test`: 22 tests、0 failures。
  - design reviewは13件、implementation reviewは初回3件と追加feedback 1件をすべて解決し、最終未解決0件でApprovedとなった。
  - `diff.zip`はbase `a97c530`からPhase 4-a確定commit `c807c1a`までのbinary full-index patchを収録し、`unzip -t`で整合確認した。
- Follow-up:
  - `TODO-2026-025`: Tauri上下・左右split方向。
  - `TODO-2026-026`: TabStrip上端indicator、compact固定高、scroll UX、pane間drag and drop移動。
  - Avalonia版のpane / multi-tab水平展開は`TODO-2026-011` / `TODO-2026-012`で扱う。
- Completion:
  - Phase 4-b成果物を作成済み。Phase 4-cの`main` mergeはユーザー承認待ち。

## TODO-2026-007 Tauri 先行 UX 評価と Avalonia 反映仕様化

- Status: `done`
- Category: `documentation`
- Created: `2026-07-05`
- Completed: `2026-07-27`
- Branch: `documentation/tauri-ux-evaluation-avalonia-spec`
- WBS:
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- Work package: `WP-005`
- Depends on: `TODO-2026-003`, `TODO-2026-004`, `TODO-2026-005`, `TODO-2026-006`, `TODO-2026-014`, `TODO-2026-017`
- Additional evaluation sources: `TODO-2026-019`, `TODO-2026-021`, `TODO-2026-022`
- Design analysis:
  - `docs/design_analysis/documentation/20260727_tauri_ux_evaluation_avalonia_spec/`
- Rollout specification:
  - `docs/components/avalonia_viewer/tauri_ux_rollout_spec.md`
- Summary:
  - Tauri先行UXを`confirmed` / `specified` / `follow-up`に分け、Avaloniaへ反映する共通outcome、stack適応、Tauri固有方式、deferred事項を確定した。
  - TODO-2026-023へ024、TODO-2026-008へ020、TODO-2026-009へ015を統合し、元IDを`integrated`記録としてarchiveへ残した。
  - Avalonia rolloutを`008 → (009 / 018並行) → 010 → 011 → 012`へ整理し、trusted HTMLをMulti-tabより先に置いた。
  - Tauriのpane-local tab group / pane間移動と上下splitは、Avaloniaの左右2pane baselineをブロックしない方針とした。
- Verification:
  - User approved the documentation and docs-only result on `2026-07-27`.
  - Design and implementation follow-up reviews were approved with no unresolved findings.
  - `git diff --check main...HEAD` passed.
  - Relative links in all changed Markdown files resolved.
  - All changed files are Markdown documents; no source, config, script, fixture, or runtime asset was changed.
  - No `diff.zip` was created because this was a docs-only workflow.
  - Merged into `main` with `--no-ff` at `f326ec0` after Phase 4-c approval.
- Follow-up:
  - Avalonia rollout continues with `TODO-2026-008`, then parallel `TODO-2026-009` / `TODO-2026-018`, followed by `TODO-2026-010`, `TODO-2026-011`, and `TODO-2026-012`.
  - Tauri Split View extensions remain in `TODO-2026-023` and `TODO-2026-025`.

## TODO-2026-024 Tauri pane間tab移動

- Status: `integrated`
- Category: `new-feature`
- Integrated: `2026-07-27`
- Integrated into: `TODO-2026-023 Tauri pane-local tab group / pane 間移動`
- Depends on: `TODO-2026-023`（統合前）
- Summary:
  - pane-local tab ownershipとpane間移動は、ordered tab IDs、active fallback、focus、pane runtime identityを同じtyped transitionで変更するため、1つのwork itemへ統合した。
  - 明示的なpane間移動、移動元 / 移動先の復旧、keyboard到達性の完了条件はTODO-2026-023へ移管した。
  - drag and drop、reorder / pinは統合後も非対象である。

## TODO-2026-020 Avalonia Explorer ツリーペイン UX 水平展開

- Status: `integrated`
- Category: `spec-change`
- Integrated: `2026-07-27`
- Integrated into: `TODO-2026-008 Avalonia shell / Explorer UX foundation`
- Source: `TODO-2026-019 Tauri Explorer ツリーペイン UX 改善`
- Summary:
  - MenuBar / StatusBarとExplorer / Preview境界はいずれも`MainWindow` shell layoutを変更するため、後続workspaceの基盤としてまとめた。
  - GridSplitter、必要時のExplorer横scroll、directory / Markdown / HTML / image icon、keyboard / accessibility outcomeをTODO-2026-008へ移管した。
  - Tauriと内部実装を共通化せず、AvaloniaのXAML / TreeView境界へ適応する方針は維持する。

## TODO-2026-015 Avalonia Viewer 設定永続化と設定 UI 水平展開

- Status: `integrated`
- Category: `new-feature`
- Integrated: `2026-07-27`
- Integrated into: `TODO-2026-009 Avalonia app settings / Recent Folders`
- Depends on: `TODO-2026-007`, `TODO-2026-009`（統合前）
- Summary:
  - Recent Folders、Theme、logical window size、PlantUML jar pathは同じtyped user config、startup load、保存失敗、schema更新を共有するため、1つのwork itemへ統合した。
  - Settings UI、現在値確認、保存、再起動復元、Recent Foldersとの共存はTODO-2026-009へ移管した。
  - Avaloniaの自然なService / ViewModel / XAML境界へ適応する方針は維持する。

## TODO-2026-006 Tauri Split view 導入

- Status: `done`
- Category: `new-feature`
- Created: `2026-07-26`
- Completed: `2026-07-26`
- Branch: `new-feature/tauri-split-view`
- WBS:
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- Work package: `WP-004`
- Depends on: `TODO-2026-005`, `TODO-2026-017`
- Design analysis:
  - `docs/design_analysis/new_feature/20260726_tauri_split_view/`
- Change report:
  - `docs/design_analysis/new_feature/20260726_tauri_split_view/change_report.md`
- Review records:
  - `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_design_review.md`
  - `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_impl_review.md`
- Summary:
  - Added single / left-right 2-pane Split View to the Tauri viewer while keeping shared document data and pane-local selection / runtime.
  - Routed Explorer, TabStrip, Reload, relative links, status, errors, Mermaid, trusted HTML, and image viewer behavior by active or originating pane.
  - Added pointer / keyboard separator resizing, active pane indication, pane-scoped DOM IDs, and accessibility state.
  - Preserved Rust commands, custom protocol, Tauri capability, CSP, settings schema, and existing single-view behavior.
- Verification:
  - User confirmed `View > Split View` toggles the layout.
  - User confirmed primary and secondary can select different tabs and preview different files simultaneously.
  - `npm run build` and 71 frontend tests passed.
  - `cargo fmt -- --check`, `cargo check`, and 22 Rust tests passed.
  - Design and implementation follow-up reviews were approved with no unresolved findings.
  - `diff.zip` generated from `c023374..f8f6136` and verified with `unzip -t`.
  - Completion artifacts were committed at `a3acab4`.
  - Merged into `main` with `--no-ff` at `834cc75` after Phase 4-c approval.
- Follow-up:
  - `TODO-2026-023` tracks pane-local tab groups.
  - `TODO-2026-024` tracks moving tabs between panes.
  - `TODO-2026-025` tracks vertical and horizontal 2-pane split orientation.
  - Avalonia rollout remains in `TODO-2026-011`; UX evaluation and common specification remain in `TODO-2026-007`.

## TODO-2026-022 Tauri Markdown画像オーバーレイ表示

- Status: `done`
- Category: `spec-change`
- Created: `2026-07-26`
- Completed: `2026-07-26`
- Branch: `spec-change/tauri-markdown-image-overlay`
- Design analysis:
  - `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/`
- Change report:
  - `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/change_report.md`
- Review records:
  - `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_design_review.md`
  - `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_impl_review.md`
- Summary:
  - Added a modal image viewer for loaded Markdown images and rendered Mermaid / PlantUML SVGs without changing the normal document layout.
  - Added fit-to-viewport, zoom up to 800%, pointer / keyboard pan, 100% reset, modal close, focus trap, and Light / Dark styling.
  - Kept linked-image navigation, SVG anchors, trusted HTML iframe security, Rust backend, asset protocol, and normal preview layout boundaries intact.
  - Split close focus restoration by pointer / keyboard activation after Phase 4-a feedback so keyboard affordances remain available without appearing after mouse use.
- Verification:
  - User confirmed pointer cursor / open, image / Mermaid / PlantUML overlay display, button / mouse / keyboard zoom and pan, and Close / Escape behavior.
  - User reconfirmed that pointer close leaves no `Open image viewer` pill, while Tab exposes the pill and Enter / Space opens the viewer with focus restored after close.
  - `npm run build` and 42 frontend tests passed.
  - `cargo fmt -- --check`, `cargo check`, and 22 Rust tests passed.
  - Design and all implementation review rounds were approved with no unresolved findings.
  - `diff.zip` generated from `d2e9fd5..64cde48` and verified with `unzip -t`.
  - Merged into `main` with `--no-ff` at `555568d` after Phase 4-c approval.
- Follow-up:
  - No new follow-up item is required. Avalonia support, trusted HTML images, download, separate windows, and transform persistence remain outside this TODO.

## TODO-2026-021 Tauri document preview 横幅の可変化

- Status: `done`
- Category: `spec-change`
- Created: `2026-07-25`
- Completed: `2026-07-25`
- Branch: `spec-change/tauri-document-preview-responsive-width`
- Design analysis:
  - `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/`
- Change report:
  - `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/change_report.md`
- Review records:
  - `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/review/tauri_document_preview_responsive_width_design_review.md`
  - `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/review/tauri_document_preview_responsive_width_impl_review.md`
- Summary:
  - Removed the fixed 980px maximum from the Tauri Markdown body and made it follow the preview pane width while retaining responsive gutters.
  - Preserved table, code, Mermaid, PlantUML, image, trusted HTML iframe, Explorer, tab, and security contracts.
  - Added a wide-content fixture and synchronized Tauri Viewer component docs and manual verification guidance.
  - Fixed the Phase 4-a Mermaid regression so unrelated window or Explorer resize renders do not replace generated SVG with diagram source.
- Verification:
  - User confirmed the responsive Markdown width behaves as expected.
  - User confirmed Mermaid initial SVG rendering, window resize, Explorer resize, Light / Dark switching, and Reload all work after the follow-up fix.
  - `npm run build` and 29 frontend tests passed.
  - `cargo fmt -- --check`, `cargo check`, and 22 Rust tests passed.
  - Design and implementation reviews were approved with no unresolved findings.
  - `diff.zip` generated from `3aaa5a2..7b6dee5` and verified with `unzip -t`.
  - Merged into `main` with `--no-ff` at `231fd7f` after Phase 4-c approval.
- Follow-up:
  - No new follow-up item is required. Avalonia width behavior and split view remain outside this TODO.

## TODO-2026-013 クロスプラットフォーム環境構築・README 整備

- Status: `done`
- Category: `documentation`
- Created: `2026-07-13`
- Completed: `2026-07-13`
- Branch: `documentation/cross-platform-setup-readmes`
- Design analysis:
  - `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/`
- Change report:
  - `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/change_report.md`
- Review records:
  - `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/review/cross_platform_setup_readmes_design_review.md`
  - `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/review/cross_platform_setup_readmes_impl_review.md`
- Summary:
  - Added the repository root README as the entry point for the Avalonia and Tauri implementations.
  - Added setup guides for Windows, macOS, and Linux from clone through build, run, and publish/bundle.
  - Documented that the current Avalonia `NativeWebView` implementation does not run on Linux and directed Linux users to the Tauri implementation.
  - Synchronized dependency restoration on `npm ci` and clarified implementation-specific PlantUML runtime directories.
- Verification:
  - User approved the documentation and docs-only result on `2026-07-13`.
  - Relative links resolved for the 11 target Markdown files.
  - `git diff --check` passed.
  - Design and implementation reviews completed with no unresolved findings.
- Follow-up:
  - OS-specific problems discovered during future Windows, macOS, or Linux use will be tracked as separate issues.

## TODO-2026-001 PlantUML Rendering Support

- Status: `done`
- Category: `new-feature`
- Created: `2026-05-20`
- Completed: `2026-05-21`
- Branch: `feature/plantuml-rendering-support`
- Design analysis:
  - `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/`
- Change report:
  - `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/change_report.md`
- Review records:
  - `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/review/plantuml_rendering_support_design_review.md`
  - `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/review/plantuml_rendering_support_impl_review.md`
- Summary:
  - Added local PlantUML rendering for `plantuml` and `puml` fenced code blocks.
  - Integrated PlantUML rendering into both Avalonia and Tauri viewers.
  - Kept `plantuml.jar` outside source control and documented runtime placement / `plantuml.config.json` usage.
  - Added shared sample Markdown with Mermaid and PlantUML diagrams.
  - Added loading feedback for slower PlantUML rendering after Phase 4-a user verification.
- Verification:
  - User confirmed PlantUML rendering in published Avalonia and Tauri apps.
  - User confirmed loading feedback is visible and understandable in both apps.
  - `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`
  - `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj -c Release --no-restore`
  - `npm run build` in `markdown-viewer-tauri/`
  - `cargo check` in `markdown-viewer-tauri/src-tauri/`
  - `cargo fmt -- --check` in `markdown-viewer-tauri/src-tauri/`
  - `git diff --check`
- Follow-up:
  - `TODO-2026-002 PlantUML Loading UX Follow-up`

## TODO-2026-002 PlantUML Loading UX Follow-up

- Status: `done`
- Category: `new-feature`
- Created: `2026-05-21`
- Completed: `2026-06-14`
- Branch: `feature/plantuml-loading-ux-follow-up`
- Design analysis:
  - `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/`
- Change report:
  - `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/change_report.md`
- Review records:
  - `docs/design_analysis/new_feature/20260613_plantuml_loading_ux_follow_up/review/plantuml_loading_ux_follow_up_impl_review.md`
- Summary:
  - Disabled overlapping busy-state operations in Avalonia and Tauri during Markdown loading and PlantUML rendering.
  - Split Tauri pending PlantUML rendering from final PlantUML error presentation with `.plantuml-loading`.
  - Updated component-level permanent docs to describe the new loading UX behavior.
  - Added a deterministic PlantUML syntax-error sample for final error-state verification.
- Verification:
  - User confirmed points 1 to 8 of the loading UX checklist in both Avalonia and Tauri.
  - User confirmed the added invalid PlantUML sample renders as a syntax error in both Avalonia and Tauri and only the target diagram fails to draw.
  - `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`
  - `npm run build` in `markdown-viewer-tauri/`
  - `cargo check` in `markdown-viewer-tauri/src-tauri/`

## TODO-2026-003 Tauri MenuBar / StatusBar 導入

- Status: `done`
- Category: `spec-change`
- Created: `2026-07-06`
- Completed: `2026-07-07`
- Branch: `spec-change/tauri-menubar-statusbar`
- WBS:
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- Work package: `WP-001`
- Design analysis:
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/`
- Change report:
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/change_report.md`
- Review records:
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_design_review.md`
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_impl_review.md`
- Summary:
  - Split the Tauri Toolbar into a React app-level MenuBar, RootPathBar, ErrorBanner, and StatusBar.
  - Moved `Open Folder` / `Reload` / theme controls to MenuBar while preserving existing handlers and busy-state disabled behavior.
  - Displayed root path under MenuBar, active file and loading state in StatusBar, and representative error above StatusBar only when present.
  - Constrained app-level overflow so only Explorer and Preview panes scroll.
  - Fixed conditional ErrorBanner layout so StatusBar position and bottom spacing stay stable with or without errors.
- Verification:
  - User confirmed root path and Error display were expected in the published Tauri app.
  - User confirmed the app-level scrollbar was removed and pane-level scrollbars remained.
  - User confirmed StatusBar bottom spacing stayed stable after the grid-row fix.
  - `npm run build` in `markdown-viewer-tauri/`
  - `cargo check` in `markdown-viewer-tauri/src-tauri/`
  - `git diff --check`
- Follow-up:
  - OS native menu integration is deferred to `TODO-2026-004 Tauri Recent Folders 導入`.

## TODO-2026-004 Tauri Recent Folders 導入

- Status: `done`
- Category: `new-feature`
- Created: `2026-07-08`
- Completed: `2026-07-09`
- Branch: `new-feature/tauri-recent-folders`
- WBS:
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- Work package: `WP-002`
- Design analysis:
  - `docs/design_analysis/new_feature/20260708_tauri_recent_folders/`
- Change report:
  - `docs/design_analysis/new_feature/20260708_tauri_recent_folders/change_report.md`
- Review records:
  - `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md`
  - `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_impl_review.md`
- Summary:
  - Added `File` / `Recent Folders` to the Tauri React app-level MenuBar dropdown.
  - Persisted successful root opens to app config JSON through Rust commands.
  - Supported duplicate promotion, maximum 10 entries, explicit entry deletion, missing path errors, and restart restoration.
  - Kept existing `Open Folder` / `Reload` / `Theme` behavior working from MenuBar.
- Verification:
  - User confirmed opening a directory adds it to `RECENT FOLDERS`.
  - User confirmed the entry `x` button deletes history.
  - User confirmed clicking a recent entry opens the target directory.
  - User confirmed existing `Open Folder` / `Reload` / `Theme` still work.
  - `npm run build` in `markdown-viewer-tauri/`
  - `cargo check` in `markdown-viewer-tauri/src-tauri/`
  - `git diff --check`
  - `diff.zip` generated from `0967086..653d075`.
  - Merged into `main` with `--no-ff` at `f68cbcd` after Phase 4-c approval.

## TODO-2026-005 Tauri Multi-tab core 導入

- Status: `done`
- Category: `new-feature`
- Created: `2026-07-12`
- Completed: `2026-07-12`
- Branch: `new-feature/tauri-multi-tab-core`
- WBS:
  - `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- Work package: `WP-003`
- Design analysis:
  - `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/`
- Change report:
  - `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/change_report.md`
- Review records:
  - `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/review/tauri_multi_tab_core_design_review.md`
  - `docs/design_analysis/new_feature/20260712_tauri_multi_tab_core/review/tauri_multi_tab_core_impl_review.md`
- Summary:
  - Replaced the Tauri single-document state with typed open tabs and an active tab identifier.
  - Added a horizontally scrollable TabStrip with activate, close, loading/error state, and keyboard navigation.
  - Cached Markdown and PlantUML results per tab and guarded asynchronous responses by tab ID and revision.
  - Integrated Explorer selection, active-tab Reload, root changes, theme, and relative Markdown links with tab state.
  - Preserved a single preview pane as the foundation for the follow-up split-view work package.
- Verification:
  - User confirmed multi-tab open, switching without reload, active/non-active/last tab close, and active-tab Reload.
  - User confirmed root changes clear old tabs and open the new root default Markdown.
  - User confirmed TabStrip overflow, ArrowLeft / ArrowRight / Home / End, and close-after-focus behavior.
  - User confirmed PlantUML error indication and no cross-tab preview/error bleed during concurrent rendering.
  - User confirmed relative Markdown links reuse or create tabs as appropriate and scroll to anchors.
  - User confirmed no regression in existing viewer features.
  - `npm run build` in `markdown-viewer-tauri/`.
  - `cargo check` in `markdown-viewer-tauri/src-tauri/`.
  - `git diff --check`.
  - `diff.zip` generated from `19e2226..785dff8`.
  - Completion artifacts are ready for Phase 4-c merge approval.

## TODO-2026-014 Tauri Viewer 設定永続化と設定 UI 導入

- Status: `done`
- Category: `new-feature`
- Created: `2026-07-19`
- Completed: `2026-07-19`
- Branch: `new-feature/tauri-viewer-settings`
- Depends on: `TODO-2026-005 Tauri Multi-tab core 導入`
- Design analysis:
  - `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/`
- Change report:
  - `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/change_report.md`
- Review records:
  - `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/review/tauri_viewer_settings_design_review.md`
  - `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/review/tauri_viewer_settings_impl_review.md`
- Summary:
  - Persisted logical window size、Theme、canonical `plantuml.jar` path in the existing typed Tauri app config JSON while preserving Recent Folders.
  - Added `File > Settings...` for reviewing current values and changing Theme / jar path.
  - Restored saved window size and Theme at startup and used the app config jar path as the highest-priority PlantUML runtime setting.
  - Added field-specific Store updates、atomic replace、resize debounce / queue、modal focus containment、picker error handling.
  - Kept Viewer settings and Split view as independent post-Multi-tab work packages that converge in `TODO-2026-007`.
- Verification:
  - User confirmed Settings display、Theme changes from Settings and View、window size display、explicit / automatic PlantUML runtime、restart restoration.
  - `npm run build` in `markdown-viewer-tauri/` succeeded with the existing chunk size warning only.
  - `cargo check`、`cargo test` (10 tests)、`cargo fmt -- --check` succeeded in `markdown-viewer-tauri/src-tauri/`.
  - Design and implementation reviews were approved with no Phase 3 unresolved findings.
  - `diff.zip` generated from `4b50af2..dc97286` and verified with `unzip -t`.
- Follow-up:
  - `TODO-2026-007` evaluates Settings and Split view together before Avalonia rollout.
  - `TODO-2026-015` rolls the evaluated UX out to Avalonia.
  - `TODO-2026-016` tracks Windows target / `MoveFileExW` / Unicode and verbatim path verification.

## TODO-2026-017 Tauri HTML形式仕様書表示対応

- Status: `done`
- Category: `spec-change`
- Created: `2026-07-19`
- Completed: `2026-07-19`
- Branch: `spec-change/tauri-html-document-viewing`
- Depends on: `TODO-2026-005 Tauri Multi-tab core 導入`
- Source report:
  - `docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md`
- Design analysis:
  - `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/`
- Change report:
  - `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/change_report.md`
- Review records:
  - `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_design_review.md`
  - `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_impl_review.md`
- Summary:
  - Generalized the Tauri Explorer, open command, tab state, and preview into a typed Markdown / HTML document model.
  - Added a root-scoped custom URI protocol for trusted UTF-8 HTML and allowlisted relative resources.
  - Rendered HTML in a CSP-protected sandboxed iframe without parent DOM, Tauri IPC, external network, popup, or top-level navigation access.
  - Delegated user-clicked `http:` / `https:` links to the OS browser after source, activation, and scheme validation.
  - Preserved existing Markdown, relative image / link, Mermaid, PlantUML, and Multi-tab behavior.
- Verification:
  - User confirmed HTML / inline SVG display, external browser delegation, and `javascript:` URL rejection on macOS.
  - User confirmed relative PNG display from both HTML and Markdown fixtures.
  - `npm run build` and 20 frontend tests passed.
  - `cargo fmt -- --check`, `cargo check`, and 22 Rust tests passed.
  - Design and implementation follow-up reviews were approved with no unresolved findings.
  - `diff.zip` generated from `24bcfb5..a9193cf` and verified with `unzip -t`.
- Follow-up:
  - Windows / Linux and remaining platform-specific security matrix checks will be performed separately.
  - A platform-specific problem found later will be filed under `docs/issues/` and handled through the issue-resolution or bugfix workflow.

## TODO-2026-019 Tauri Explorer ツリーペイン UX 改善

- Status: `done`
- Category: `spec-change`
- Created: `2026-07-22`
- Completed: `2026-07-22`
- Branch: `spec-change/tauri-explorer-pane-ux`
- Design analysis:
  - `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/`
- Change report:
  - `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/change_report.md`
- Review records:
  - `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/review/tauri_explorer_pane_ux_design_review.md`
  - `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/review/tauri_explorer_pane_ux_impl_review.md`
- Summary:
  - Added pointer and keyboard resizing between the Tauri Explorer and Preview with bounded width policy and separator ARIA semantics.
  - Added Explorer-local horizontal scrolling for deep paths and long names without changing app-shell scrolling.
  - Added distinct folder, Markdown, HTML, and image SVG icons while preserving selection, expansion, and disabled behavior.
  - Kept Explorer width session-only and left Rust tree/data contracts unchanged.
- Verification:
  - User confirmed Explorer width resizing.
  - User confirmed the horizontal scrollbar appears for a selected file with a long path.
  - User confirmed folder, Markdown, HTML, and image icons are displayed.
  - `npm run build` and 29 frontend tests passed.
  - `cargo fmt -- --check`, `cargo check`, and 22 Rust tests passed.
  - Design and implementation follow-up reviews were approved with no unresolved findings.
  - `diff.zip` generated from `dc4fc398..c9a0153` and verified with `unzip -t`.
  - Completion artifacts are ready for Phase 4-c merge approval.
- Follow-up:
  - Avalonia Explorer UX rolloutは、旧`TODO-2026-020`を統合した`TODO-2026-008`で追跡する。
