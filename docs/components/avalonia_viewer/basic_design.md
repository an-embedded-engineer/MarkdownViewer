# Avalonia Viewer 基本設計

## 基本方針

MVVM 構成で UI 状態と処理を分離する。Markdown 変換やファイル走査は Service へ寄せ、ViewModel は操作の調停と表示状態の管理に集中する。Markdown プレビューは `NativeWebView` 上で HTML を表示し、Mermaid と PlantUML はそれぞれクライアント JS と外部 Java プロセスへ委譲する。

## Planned UX rollout

Tauri先行評価を受けたMenu / Status、Explorer、typed settings、trusted HTML、Multi-tab、左右2pane Split Viewは段階導入する。共通UX outcome、Avaloniaの責務境界、導入順序は[tauri_ux_rollout_spec.md](tauri_ux_rollout_spec.md)を正とする。現在の単一Markdown実装を説明する以下の設計と、未実装のtarget contractを混在させない。

## 責務

- View: レイアウト、バインディング、WebView ホスト、StorageProvider 経由のフォルダ選択。
- ViewModel: 選択中 root、ファイルツリー、選択 Markdown、テーマ、エラー / busy 状態、WebView へ渡す HTML の生成依頼。
- Service: ファイル走査、Markdown 変換、PlantUML レンダリング、PlantUML runtime 解決、HTML 文書テンプレート組み立て。
- Models: Explorer 用ノードと型、テーマ enum。

## 主要クラス

- `MainWindowViewModel`: Open Folder、Reload、Markdown 選択、テーマ切替、WebMessage ハンドリング。`IsBusy` / `StatusMessage` を保持。
- `FileTreeNodeViewModel`: Explorer ノード表示と選択状態。子ノードは `ObservableCollection`。
- `FileTreeService`: 除外ディレクトリ (`.git` / `node_modules` / `bin` / `obj` / `target` / `.venv` / `__pycache__`) を考慮した再帰走査。Directory→Markdown→Image の順で整列。
- `MarkdownRenderService`: Markdig (Advanced extensions) による Markdown HTML 化。`mermaid` / `plantuml` / `puml` の fence はプレースホルダで抽出し、Mermaid は DOM、PlantUML は SVG / エラー HTML に差し替える。
- `PlantUmlRenderService`: `IPlantUmlRuntimeResolver` から得た jar path を使い、Java を `ArgumentList` で起動して `-tsvg -pipe` で SVG を得る。10 秒タイムアウト。`<script>` 要素と `on*` 属性を除去してサニタイズ。
- `PlantUmlRuntimeResolver`: working directory と `AppContext.BaseDirectory` を探索し、`plantuml.config.json` の `plantUmlJarPath` を解決、もしくは同階層の `plantuml.jar` を採用する。
- `HtmlTemplateService`: `<base>` + CSS + Mermaid script + リンクハンドラ JS を含む HTML 文書を組み立てる。テーマに合わせて `html.dark` クラスと Mermaid テーマを切り替える。

## レイヤー構成（コンポーネント図）

```plantuml
@startuml
skinparam shadowing false
skinparam componentStyle rectangle

package "View (XAML)" as V {
  [MainWindow.axaml]
  [MainWindow.axaml.cs]
  [NativeWebView]
}

package "ViewModels" as VM {
  [MainWindowViewModel]
  [FileTreeNodeViewModel]
}

package "Services" as S {
  [FileTreeService]
  [MarkdownRenderService]
  [PlantUmlRenderService]
  [PlantUmlRuntimeResolver]
  [HtmlTemplateService]
}

package "Models" as M {
  [FileTreeNode]
  [FileNodeType]
  [AppTheme]
}

package "External" as E {
  [Avalonia StorageProvider]
  [Markdig]
  [Java + plantuml.jar]
  [Mermaid.min.js (Asset)]
}

V --> VM : DataContext / bindings
V --> E : Folder picker
VM --> S : invoke
S --> M : produce / consume
S --> E : Markdown / PlantUML / Mermaid
V --> E : NativeWebView host
@enduml
```

## 依存方向

```text
View -> ViewModel -> Services -> Models
                              -> External (Markdig / Java / Mermaid asset)
```

ViewModel は View へ依存しない。Service は UI 状態へ依存しない。Service 間の依存は `MarkdownRenderService → PlantUmlRenderService → PlantUmlRuntimeResolver` の一方向。

## 依存パッケージ図

```plantuml
@startuml
skinparam shadowing false
left to right direction

package "MarkdownViewer.Avalonia" {
  [App / MainWindow]
  [ViewModels]
  [Services]
  [Models]
}

package "Avalonia stack" {
  [Avalonia]
  [Avalonia.Desktop]
  [Avalonia.Themes.Fluent]
  [Avalonia.Controls.WebView]
}

package "Markdown / MVVM" {
  [Markdig]
  [CommunityToolkit.Mvvm]
}

package "PlantUML runtime" {
  [java (PATH)]
  [plantuml.jar]
  [plantuml.config.json]
}

[App / MainWindow] --> [Avalonia]
[App / MainWindow] --> [Avalonia.Desktop]
[App / MainWindow] --> [Avalonia.Themes.Fluent]
[App / MainWindow] --> [Avalonia.Controls.WebView]
[ViewModels] --> [CommunityToolkit.Mvvm]
[Services] --> [Markdig]
[Services] --> [java (PATH)]
[Services] --> [plantuml.jar]
[Services] --> [plantuml.config.json]
@enduml
```

## 状態モデル

`MainWindowViewModel` のメイン状態は次の遷移をとる。

```plantuml
@startuml
skinparam shadowing false

[*] --> Idle : App 起動

state Idle : No root selected
state Scanning : IsBusy = true\nFileTree 構築中
state Ready : root と FileTree あり\n選択 Markdown は任意
state Rendering : IsBusy = true\nMarkdown→HTML, PlantUML 描画
state Error : StatusMessage = 失敗内容

Idle --> Scanning : Open Folder
Scanning --> Ready : Scan 完了
Scanning --> Error : Scan 失敗
Ready --> Rendering : Markdown 選択 / Reload
Rendering --> Ready : 描画完了
Rendering --> Error : 失敗
Ready --> Scanning : Reload (root 再走査)
Error --> Ready : 次の操作で復帰
@enduml
```
