# PlantUML Sample

This document is used to verify PlantUML rendering in both desktop viewers.

```plantuml
@startuml
actor User
participant "Markdown Viewer" as Viewer
participant "PlantUML CLI" as PlantUML

User -> Viewer: Open Markdown file
Viewer -> PlantUML: Render plantuml fence
PlantUML --> Viewer: SVG
Viewer --> User: Inline diagram
@enduml
```

The shorthand form is also supported.

```puml
class MarkdownRenderService
class PlantUmlRenderService
class PlantUmlRuntimeResolver

MarkdownRenderService --> PlantUmlRenderService
PlantUmlRenderService --> PlantUmlRuntimeResolver
```
