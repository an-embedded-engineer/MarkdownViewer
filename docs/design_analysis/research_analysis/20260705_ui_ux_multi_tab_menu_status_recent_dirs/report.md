# UI/UX改善 調査レポート

## 調査目的

Markdown Viewer の次期 UI/UX 改善として、複数タブ対応、並べて表示、メニューバー化、ステータスバー表示、最近開いたディレクトリを実現する方法を、既存の Avalonia/C# 版と Tauri/React/Rust 版の現状実装に基づいて整理する。

この調査では実装変更は行わず、次の仕様変更または新機能 workflow へ渡すための実装方針、影響範囲、リスク、未解決事項を明確にする。

## 調査対象

- Avalonia UI 実装
  - `Avalonia/MarkdownViewer.Avalonia/ViewModels/MainWindowViewModel.cs`
  - `Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml`
  - `Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml.cs`
- Tauri / React / Rust 実装
  - `markdown-viewer-tauri/src/App.tsx`
  - `markdown-viewer-tauri/src/App.css`
  - `markdown-viewer-tauri/src-tauri/src/lib.rs`
- 既存設計文書
  - `docs/components/avalonia_viewer/*.md`
  - `docs/components/tauri_viewer/*.md`
  - `docs/architecture/*.md`
  - `docs/rules/*.md`

## 非対象

- この調査 workflow 内でのアプリ実装変更。
- 最終 UI デザインの確定。
- 永続化形式の詳細スキーマ確定。
- OS ネイティブメニューのプラットフォーム差分の完全検証。

## 根拠ソース

### 共通設計

- `docs/architecture/overview.md`: 両実装の主要ファイル、基本フロー、Markdown 表示方式。
- `docs/architecture/code_patterns.md`: Avalonia は ViewModel / Service 分離、Tauri は React state と Rust command 境界を維持する方針。
- `docs/rules/language_rules.md`: UI 文字列は英語、docs は日本語。
- `docs/rules/development_workflow.md`: UI 変更時のビルド・手動確認項目。

### Avalonia 実装

- `MainWindowViewModel` は `RootPath`、`CurrentPath`、`StatusMessage`、`IsBusy`、`IsDarkTheme` と `_currentBodyHtml` を持つ単一ドキュメント状態である。`OpenMarkdownAsync` は 1 パスを読み、1 つの HTML を `PreviewRequested` で View へ渡す。
- `MainWindow.axaml` は上段全幅 Toolbar (`Grid.ColumnSpan="2"`)、下段左 Explorer / 右 1 つの `NativeWebView`、busy overlay の 2 行 2 列構成である。
- `MainWindow.axaml.cs` はフォルダ選択、テーマ切替、Reload、TreeView 選択を code-behind で ViewModel へ中継する。

### Tauri 実装

- `App.tsx` は `selectedFilePath`、`selectedMarkdown`、`previewRevision`、`plantUmlRenderState`、`previewRef` を単一プレビュー用に保持する。
- `Toolbar` は `Open Folder`、`Theme`、`Reload` と path 表示を持つ header コンポーネントで、メニューバーではない。
- `MarkdownPreview` は 1 つの `article.markdown-body` に `dangerouslySetInnerHTML` で描画する。
- `src-tauri/src/lib.rs` の command は `scan_directory`、`read_text_file`、`render_plantuml_diagrams` であり、最近開いたディレクトリなどの設定永続化 command は存在しない。

## 現状整理

### 1. 単一ファイル表示前提

Avalonia は `CurrentPath` と `_currentBodyHtml` が 1 件だけで、`PreviewRequestedEventArgs` も HTML 文字列 1 件だけを送る。UI 側も `PreviewWebView` が 1 つだけである。このため、複数タブ化には「開いているファイル一覧」と「アクティブファイル」を ViewModel の正本として追加する必要がある。

Tauri は `selectedFilePath` / `selectedMarkdown` / `previewRevision` / `pendingAnchor` / `plantUmlRenderState` / `previewRef` が単一ファイルを前提に結合している。複数タブ化では `OpenDocumentTab[]` と `activeTabId` を追加し、Markdown 本文、revision、anchor、PlantUML 結果、scroll 状態をタブ単位へ移す必要がある。

### 2. 操作領域と状態表示が Toolbar に混在

Avalonia の上段領域には `Open Folder`、`Theme`、`Reload`、`StatusMessage`、`ProgressBar` が同居している。Tauri も header に操作ボタンと root path / selected file 表示が混在している。メニューバー化とステータスバー化を行うなら、コマンド起動領域と状態表示領域を分離するのが自然である。

### 3. 最近開いたディレクトリの永続化機構が未実装

両実装とも root はメモリ上の状態のみで、アプリ再起動後に最近開いたディレクトリを復元する仕組みはない。Tauri backend にも設定ファイル読み書き command はなく、Avalonia 側にも設定 service はない。

### 4. 並べて表示はタブ状態モデルの後に実装すべき

並べて表示は、少なくとも 2 つ以上の開いている Markdown 文書と、それぞれのプレビュー状態を独立管理できることが前提になる。現在の単一プレビューから直接 split view を実装すると、リンク遷移、テーマ切替、Reload、PlantUML pending、Mermaid 再描画の責務がさらに混線する。

## 要求別の実現方法

### 1. 複数タブ対応

#### 推奨する状態モデル

共通概念として `OpenDocumentTab` を導入する。

```text
OpenDocumentTab
- id
- filePath
- displayName
- markdownText / bodyHtml
- previewRevision
- isLoading
- loadError
- pendingAnchor
- plantUmlRenderState または cached bodyHtml
```

Avalonia では ViewModel に `ObservableCollection<OpenDocumentTabViewModel> OpenTabs`、`OpenDocumentTabViewModel? ActiveTab`、`OpenMarkdownInTabAsync(path)`、`CloseTabAsync(tabId)`、`ActivateTab(tabId)` を追加する。`CurrentPath` は互換用に残すより、`ActiveTab?.Path` 相当に置き換える方が状態の正本が二重化しない。

Tauri では `selectedFilePath` / `selectedMarkdown` を `tabs: OpenDocumentTab[]` と `activeTabId` へ置き換える。`loadMarkdown` は既存タブがあれば activate、なければ新規タブ作成または既定方針に応じて active tab を差し替える。Explorer クリックの挙動は「通常クリックは既存タブを再利用せず開く」または「既存なら activate」を設計で固定する必要がある。

タブは現在開いている `rootPath` 内の Markdown ファイルに限定する。別ディレクトリのファイルを開く場合は `Open Folder` で root を変更し、既存タブを閉じるか root 変更後に再構築する扱いにする。この前提を置くことで、Tauri の `read_text_file(rootPath, path)` の root 境界チェックと Explorer の 1 ツリー構成を維持できる。

Explorer クリックは「同一パスのタブが既に存在すれば activate、存在しなければ新規タブで開く」を推奨する。重複タブを防ぎつつ、ファイル選択が現在タブを破壊しないため、複数タブ UI の期待に合う。

#### UI 方式

- Avalonia: `TabControl` を Explorer 右側の上部に置き、各 tab item の content に `NativeWebView` もしくはプレビュー領域を持たせる。
- Tauri: `div.tab-strip` + `button.tab` + `MarkdownPreview` で実装し、アクティブタブだけを描画する方式から始める。

#### WebView / Preview の扱い

Avalonia で全タブ分の `NativeWebView` を保持するとメモリ負荷が上がる可能性がある。初期実装はアクティブタブだけ `PreviewWebView.NavigateToString` へ反映し、各タブには body HTML fragment と path を保持する方式が現実的である。これならテーマ切替時も各タブの body HTML から document HTML を再構築できる。

Tauri は React の DOM と Mermaid の `data-processed` の関係があるため、アクティブタブ切替時は `key={`${activeTab.id}-${theme}-${activeTab.previewRevision}`}` のようにタブ単位 key で DOM を張り替える。PlantUML 結果も tab id と revision で紐づける。

#### リンク遷移

Markdown 内リンクをクリックした場合、既存タブ方式では「現在のタブで遷移する」か「新規タブで開く」かを決める必要がある。最小実装では現在のアクティブタブをリンク先ファイルへ置き換えるのではなく、リンク先を新規または既存タブとして開く方が複数タブ UI の期待に合う。ただし履歴戻る機能がないため、既存タブ置換は避けるのがよい。

### 1-補足. 並べて表示

並べて表示は複数タブ実装後の追加機能として扱うのが妥当である。

推奨モデルは、タブ自体と表示レイアウトを分ける。

```text
OpenTabs: OpenDocumentTab[]
Layout:
- mode: single | split
- primaryTabId
- secondaryTabId?
```

初期 split は 2 ペイン固定で十分である。任意数分割やドラッグ移動は後続課題に分離する。

Avalonia では右側領域を `Grid` で 1 列 / 2 列切替し、各 pane にアクティブ tab selector + preview を置く。Tauri では `.preview-grid[data-mode="split"]` で 2 カラム化し、各 pane に `MarkdownPreview` を描画する。PlantUML と Mermaid の再描画は pane ごとの ref が必要になる。

### 2. メニューバー化

#### メニュー構成案

UI 文字列はプロジェクトルールに従い英語とする。

```text
File
- Open Folder...
- Recent Folders
- Reload
- Close Tab
- Close Other Tabs

View
- Theme: Light
- Theme: Dark
- Split View

Help
- About
```

最初の実装では `About` は省略可能である。`Recent Folders` は最近開いたディレクトリ実装と同時に追加する。メニューバー / ステータスバーを複数タブより先に実装する場合、`Close Tab` / `Close Other Tabs` はその段階では省略するか disabled 表示にし、複数タブ実装時に有効化する。

#### Avalonia

`MainWindow.axaml` の Toolbar button 群を `Menu` / `NativeMenu` 相当へ移す。クロスプラットフォームの表示一貫性を優先するなら Window 内 `Menu` が実装容易で、macOS ネイティブメニューバーらしさを優先するなら `NativeMenu` の採用可否を別途確認する。既存 code-behind の `OpenFolderButton_OnClick` などはメニュー item の click handler に置き換えられる。

#### Tauri

Tauri は Rust 側の native menu API を使う方法と、React 内で疑似メニューバーを実装する方法がある。既存 UI が React で完結しているため、最初は React 内 `MenuBar` コンポーネントで実装するのが低リスクである。OS ネイティブメニュー化は Tauri v2 menu API と権限・イベント配線の確認が必要で、別作業に分ける方がよい。

### 3. ステータスバー表示

#### 表示項目

ステータスバーには、操作ボタンではなく現在状態のみを表示する。

- 開いている root directory。
- アクティブファイルまたはタブ数。
- loading 状態。
- エラーの短い要約。
- 必要に応じて PlantUML rendering 状態。

#### Avalonia

Grid を `RowDefinitions="Auto,*,Auto"` に変更し、最下段へ `StatusBar` 相当の `Border` / `Grid` を追加する。`StatusMessage` は上部 Toolbar から移し、`RootPath`、`ActiveTab.DisplayName`、`IsBusy` を個別 binding する。既存 `StatusMessage` は当面維持できるが、将来的には `StatusText`、`RootDisplayText`、`BusyText` など表示目的別プロパティへ分ける方がよい。

#### Tauri

`.app-shell` を `grid-template-rows: menu tabs/workspace status` へ変更し、`StatusBar` コンポーネントを追加する。既存の `loadingMessage` と `errorMessage` はプレビュー上部 banner とステータスバーの両方で使えるが、長文エラーは banner、短い状態は status bar へ分ける。

### 4. 最近開いたディレクトリ

#### 推奨データ

```text
RecentDirectory
- path
- displayName
- lastOpenedAt
```

`displayName` は `Path.GetFileName(path)` 相当のディレクトリ名を基本とし、同名ディレクトリの区別と詳細確認は tooltip / status bar でフルパスを表示する。保持件数は 10 件程度から開始する。存在しない path は選択時にエラー表示し、一覧から削除する操作を用意する。

#### Avalonia

`IAppSettingsService` を追加し、user config directory 配下に JSON を保存する。ViewModel の `OpenFolderAsync` 成功時に最近開いたディレクトリへ追加し、起動時に読み込む。保存は Service に閉じ込め、ViewModel は `ObservableCollection<RecentDirectoryViewModel>` を持つ。

#### Tauri

Rust command として `load_app_settings` / `save_recent_directory` / `remove_recent_directory` を追加する案が自然である。フロントエンドの localStorage だけで完結させる案もあるが、デスクトップアプリとして OS の app config directory に置く方が将来の移行や検証がしやすい。Rust 側では `serde` 付き settings struct を定義し、Tauri の path API または標準的な config directory 解決 crate の導入を検討する。

## 推奨方針

### 推奨実装順

1. UI 状態モデルの整理
   - `OpenDocumentTab` と `RecentDirectory` の設計を先に文書化する。
   - 単一ファイル状態を active tab から導出する形へ移す。
2. メニューバーとステータスバー
   - 既存 Toolbar の操作と状態表示を分離する。
   - まだ複数タブを実装しなくても移行できるため、先に UI 構造を整えられる。
3. 最近開いたディレクトリ
   - メニューバーの `Recent Folders` と連動させる。
   - 永続化 service / command を追加する。
4. 複数タブ
   - active tab 方式から開始し、複数タブを開く、切替、閉じる、Reload、テーマ切替、リンク遷移を通す。
5. 並べて表示
   - 2 ペイン固定 split から開始する。
   - タブ状態の安定後に pane ごとの preview ref / WebView 更新制御を追加する。

### Avalonia 推奨アーキテクチャ

- Model: `OpenDocumentTab`, `RecentDirectory`, `PreviewLayoutMode` を追加する。
- ViewModel: `OpenTabs`, `ActiveTab`, `RecentDirectories`, `StatusText`, `OpenMarkdownInTabAsync`, `CloseTab`, `ActivateTab`, `OpenRecentDirectoryAsync` を追加する。
- Service: `IAppSettingsService` を追加し、最近開いたディレクトリ永続化を担当する。
- View: `Menu`、`TabControl`、下部 status bar を追加する。初期段階では `NativeWebView` は 1 つのまま active tab の HTML を表示する。

### Tauri 推奨アーキテクチャ

- TypeScript type: `OpenDocumentTab`, `RecentDirectory`, `PreviewLayoutState` を追加する。
- React component: `MenuBar`, `TabStrip`, `StatusBar`, `PreviewWorkspace` を追加する。
- State: `selectedFilePath` / `selectedMarkdown` から `tabs` / `activeTabId` へ移行する。
- Rust command: settings 永続化 command を追加する。`scan_directory` / `read_text_file` は既存契約を維持する。
- 初期段階では React 内メニューバーを推奨し、OS native menu は別検討にする。

## 論点と選択肢

### 論点 1: 複数タブの HTML / Markdown キャッシュ単位

| 選択肢 | 概要 | 評価 |
| --- | --- | --- |
| Markdown 本文だけ保持 | タブ切替時に毎回 render | 実装は単純だが PlantUML が重い |
| body HTML / PlantUML 結果も保持 | 初回読み込み結果をタブ単位に保持 | 推奨。テーマ切替やタブ切替が軽い |
| WebView / DOM をタブごと保持 | 各タブの表示状態を完全保持 | メモリ負荷と制御複雑度が高い |

推奨は body HTML / PlantUML 結果も保持する方式である。

### 論点 2: メニューバーを OS native にするか

| 選択肢 | 概要 | 評価 |
| --- | --- | --- |
| アプリ内メニューバー | 両実装で見た目と操作を揃えやすい | 初期実装に推奨 |
| OS native menu | macOS らしいが stack 差分が大きい | 後続改善として検討 |

比較実装としては、まずアプリ内メニューバーで UX と状態モデルを固めるのが妥当である。

### 論点 3: 最近開いたディレクトリをどこに保存するか

| 選択肢 | 概要 | 評価 |
| --- | --- | --- |
| メモリのみ | 再起動で消える | 要求を満たさない |
| frontend localStorage | Tauri は簡単、Avalonia では不一致 | 比較実装として不統一 |
| app config JSON | 両実装で自然に実装可能 | 推奨 |

## リスク

- 複数タブ化により `isBusy` / `IsBusy` が「アプリ全体 busy」か「タブ単位 busy」か曖昧になる。特に Tauri の `loadMarkdown` 冒頭にある `isBusy` guard はタブ単位の `isLoading` 判定へ置き換え、グローバル `isBusy` は Open Folder など root 全体を変更する操作の抑止に限定する必要がある。
- Tauri の Mermaid は DOM に対して `data-processed` を付けるため、複数 preview ref / split view で再描画条件を誤ると図が空白または古いままになる。
- Avalonia の `NativeWebView` をタブごとに増やすとリソース消費が大きくなる可能性がある。
- 最近開いたディレクトリは存在しない path、権限不足、外部ドライブ切断を扱う必要がある。
- メニューバー化で既存 button 操作が移動するため、最低限のキーボードアクセラレータと disabled 状態設計が必要になる。
- 並べて表示を同時に進めると、タブ状態モデル、pane 状態、preview ref、WebView 更新が一度に変わり、検証範囲が大きくなる。

## 未解決事項

- Markdown 内リンクは同じタブで遷移するか、新規タブで開くか。
- タブの未保存概念は現時点では不要だが、将来編集機能を持つ可能性があるなら close confirmation をどう扱うか。
- 多数タブ時の overflow 表示を、横スクロールにするか、ドロップダウン化するか。
- 最近開いたディレクトリの最大件数と削除 UI。
- Tauri で app config directory を Tauri path API で扱うか、Rust crate を追加するか。
- Avalonia / Tauri で OS native menu まで揃えるか、アプリ内メニューバーで比較するか。
- split view の最初の仕様を 2 ペイン固定にするか、任意 pane を見据えるか。

## 次 workflow への推奨入力

この改善は UI 状態モデルと複数コンポーネントにまたがるため、`spec-change-workflow` が妥当である。実装単位は以下に分割することを推奨する。

1. メニューバー / ステータスバー化
2. 最近開いたディレクトリ永続化
3. 複数タブ対応
4. 2 ペイン split view

最初の work package では、単一ファイル表示のまま UI 領域分離だけを完了させると、後続のタブ実装で変更差分を抑えやすい。
