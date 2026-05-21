# TODO

## TODO-2026-002 PlantUML Loading UX Follow-up

- Status: `open`
- Category: `new-feature`
- Created: `2026-05-21`
- Source:
  - `docs/design_analysis/new_feature/20260520_plantuml_rendering_support/review/plantuml_rendering_support_impl_review.md` section 9.
- Target users:
  - Developers and project maintainers using PlantUML preview in the Avalonia and Tauri viewers.
- User value:
  - PlantUML rendering feedback remains clear during longer renders, repeated actions, and error/pending states.
- Scope:
  - Avalonia: consider disabling Open Folder, Theme, and Reload while `IsBusy=true`, or add cancellation / in-flight render handling before allowing repeated actions.
  - Tauri: replace the pending inline PlantUML placeholder that currently uses `.plantuml-error` styling with a dedicated loading style such as `.plantuml-loading`.
  - Tauri: revisit whether Markdown loading and PlantUML rendering states should be shown together, or folded into a single generic loading state.
  - Avalonia: decide whether the loading overlay should remain opaque or use a semi-transparent background.
- Acceptance criteria:
  - Busy-state controls cannot cause confusing overlapping renders or stale preview updates.
  - Pending PlantUML content is visually distinct from final PlantUML errors.
  - Loading state behavior is documented in the relevant component detail design.
  - Avalonia build, Tauri frontend build, and Tauri Rust check complete after the change.
