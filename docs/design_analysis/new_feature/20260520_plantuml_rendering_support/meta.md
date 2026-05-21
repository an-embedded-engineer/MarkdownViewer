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
status: "implemented"
design_status: "done"
impl_status: "done"
completion_status: "not_started"
related_commits:
  - "6d0c0ec : Phase 0 Define PlantUML rendering feature"
  - "a33db00 : Phase 2 Draft PlantUML rendering design"
  - "201c0cf : Phase 2 Design review (conditional approval)"
  - "010ff41 : Phase 2 Address PlantUML design review feedback"
  - "ac29f0b : Phase 2 Approve PlantUML rendering design"
  - "7c4acc6 : Phase 3 Implement PlantUML rendering support"
  - "07ce356 : Phase 3 Implementation review (conditional approval)"
  - "632019e : Phase 3 Address PlantUML implementation review feedback"
  - "732fbc4 : Phase 3 Approve PlantUML rendering implementation"
  - "cf18d24 : Phase 4 Add PlantUML rendering loading indicators"
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
| Phase 3 Implementation and docs review | Done (approved 2026-05-21) |
| Phase 4 Verification and completion | In progress (user verification feedback) |
