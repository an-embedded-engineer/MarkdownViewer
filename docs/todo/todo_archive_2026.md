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
