# Image Viewer Manual Fixture

この文書はTauri版のMarkdown画像viewerで、通常画像、Mermaid、PlantUMLのzoom / pan / focus / layout非退行を確認するためのfixtureです。

## 通常画像

![Avalonia MarkdownViewer architecture](images/avalonia-markdown-viewer-architecture.png "Image viewer raster fixture")

Inline imageを含む段落の行組み確認: before ![inline architecture](images/avalonia-markdown-viewer-architecture.png) after。viewer decoration前後で本文の折り返し位置が変わらないことを確認します。

[Linked image navigation target](multi_tab_link_target.md)

[![Linked architecture image](images/avalonia-markdown-viewer-architecture.png)](multi_tab_link_target.md)

## 横長Mermaid

```mermaid
flowchart LR
  A[Open Folder] --> B[Scan Directory]
  B --> C[Open Markdown]
  C --> D[Render markdown-it]
  D --> E[Render Mermaid]
  E --> F[Decorate Visual]
  F --> G[Open Image Viewer]
  G --> H[Fit]
  H --> I[Zoom 800 percent]
  I --> J[Pan to every edge]
  J --> K[Close and Restore Focus]
```

## 縦長Mermaid

```mermaid
flowchart TD
  A[Start] --> B[Document]
  B --> C[Preview]
  C --> D[Diagram]
  D --> E[Viewer]
  E --> F[Zoom]
  F --> G[Pan]
  G --> H[Resize]
  H --> I[Fit]
  I --> J[Close]
  J --> K[Focus]
  K --> L[Done]
```

## 大規模PlantUML

```plantuml
@startuml
skinparam shadowing false
left to right direction

package "Desktop Shell" {
  [MenuBar]
  [Explorer]
  [TabStrip]
  [Preview Pane]
  [StatusBar]
}

package "Markdown Rendering" {
  [markdown-it]
  [Mermaid]
  [PlantUML]
  [DOM Adapter]
}

package "Image Viewer" {
  [Source Resolver]
  [Transform Policy]
  [Modal Dialog]
  [Zoom Controls]
  [Pan Controls]
  [Focus Manager]
}

package "Tauri Backend" {
  [DocumentStore]
  [Asset Protocol]
  [PlantUML Command]
  [App Config]
}

[MenuBar] --> [Explorer]
[Explorer] --> [TabStrip]
[TabStrip] --> [Preview Pane]
[Preview Pane] --> [markdown-it]
[markdown-it] --> [Mermaid]
[markdown-it] --> [PlantUML]
[Mermaid] --> [DOM Adapter]
[PlantUML] --> [DOM Adapter]
[DOM Adapter] --> [Source Resolver]
[Source Resolver] --> [Modal Dialog]
[Modal Dialog] --> [Transform Policy]
[Transform Policy] --> [Zoom Controls]
[Transform Policy] --> [Pan Controls]
[Modal Dialog] --> [Focus Manager]
[Preview Pane] --> [DocumentStore]
[DocumentStore] --> [Asset Protocol]
[PlantUML] --> [PlantUML Command]
[MenuBar] --> [App Config]
@enduml
```

## 通常リンク回帰

- [同一root内Markdown](multi_tab_link_target.md)
- [同一文書内anchor](#通常画像)
- [External URL](https://example.com/)
