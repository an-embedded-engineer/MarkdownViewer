---
title: "PlantUML Rendering Support"
category: "new_feature"
created: "2026-05-20"
created_date: "2026-05-20"
todo_id: "TODO-2026-001"
work_branch: "feature/plantuml-rendering-support"
components:
  - "Avalonia Viewer"
  - "Tauri Viewer"
  - "PlantUML runtime setup"
status: "draft"
design_status: "done"
impl_status: "draft"
completion_status: "not_started"
related_commits:
  - "6d0c0ec : Phase 0 Define PlantUML rendering feature"
  - "a33db00 : Phase 2 Draft PlantUML rendering design"
  - "201c0cf : Phase 2 Design review (conditional approval)"
  - "010ff41 : Phase 2 Address PlantUML design review feedback"
---

# PlantUML Rendering Support Meta

## Scope

- Add local PlantUML diagram rendering for Markdown fenced code blocks.
- Integrate the feature into both Avalonia and Tauri viewer implementations.
- Document Java and `plantuml.jar` setup, usage, constraints, and verification.

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 0 Requirements | Done |
| Phase 1 Branch and meta | Done |
| Phase 2 Design review | Done (approved 2026-05-20) |
| Phase 3 Implementation and docs review | Implementation draft in progress |
| Phase 4 Verification and completion | Not started |
