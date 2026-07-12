# TODO Archive 2026

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
  - Completion artifacts are ready for Phase 4-c merge approval.

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
