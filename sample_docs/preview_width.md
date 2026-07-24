# Responsive Preview Width Fixture

This document verifies that the Tauri Markdown preview uses the available preview pane width instead of stopping at a fixed 980px maximum.

## Wide Table

| Requirement | Explorer | Tabs | Markdown | HTML | Mermaid | PlantUML | Images | Theme | Reload | Security |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Expected behavior | Resizable pane remains independent | Active document remains selected | Body follows pane width minus gutter | Iframe follows the full pane width | Wide diagram uses the expanded body | Wide SVG uses the expanded body | Image scales within the body | Light and Dark remain readable | Layout remains stable | HTML sandbox and protocol remain unchanged |

## Wide Mermaid Diagram

```mermaid
flowchart LR
    Window[Window viewport] --> Workspace[Workspace]
    Workspace --> Explorer[Resizable Explorer]
    Workspace --> Preview[Preview workspace]
    Preview --> Tabs[Tab strip]
    Preview --> Pane[Document preview pane]
    Pane --> Body[Markdown body]
    Body --> Table[Wide table]
    Body --> Mermaid[Mermaid diagram]
    Body --> PlantUML[PlantUML diagram]
    Body --> Image[Responsive image]
```

## Wide PlantUML Diagram

```plantuml
@startuml
left to right direction
rectangle "Window viewport" as Window
rectangle "Workspace" as Workspace
rectangle "Resizable Explorer" as Explorer
rectangle "Preview workspace" as Preview
rectangle "Document preview pane" as Pane
rectangle "Markdown body" as Body
rectangle "Wide content" as Content

Window --> Workspace
Workspace --> Explorer
Workspace --> Preview
Preview --> Pane
Pane --> Body
Body --> Content
@enduml
```

## Responsive Image

![Avalonia MarkdownViewer architecture used as a wide responsive image fixture](./images/avalonia-markdown-viewer-architecture.png)

## Long Code Line

```text
window viewport -> workspace -> resizable explorer + preview workspace -> tab strip + document preview pane -> responsive Markdown body -> wide table / Mermaid / PlantUML / image
```
