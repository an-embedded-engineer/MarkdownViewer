# Tauri MenuBar / StatusBar 導入 設計

## 背景・要求・完了条件

`TODO-2026-003` は、Tauri 版の既存 Toolbar に集約されている操作と状態表示を、React アプリ内の MenuBar と StatusBar へ分離する仕様変更である。後続の Recent Folders、multi-tab、split view 導入時に、操作領域、文書表示領域、状態表示領域が衝突しない UI 契約を先に作る。

完了条件:

- `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる。
- root path、active file、loading、error が RootPathBar / StatusBar / ErrorBanner で確認できる。
- 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない。

## 対象範囲と非対象

対象範囲:

- `markdown-viewer-tauri/src/App.tsx`
  - `Toolbar` を廃止し、アプリ内 `MenuBar`、`RootPathBar`、`ErrorBanner`、`StatusBar` コンポーネントへ分割する。
  - root path、active file、loading、error 表示用の派生値を RootPathBar / ErrorBanner / StatusBar props として渡す。
  - 既存の `openFolder`、`reload`、theme toggle、`isBusy` による操作抑止は維持する。
- `markdown-viewer-tauri/src/App.css`
  - `app-shell` を MenuBar / RootPathBar / workspace / ErrorBanner / StatusBar のレイアウトに変更する。
  - MenuBar、RootPathBar、ErrorBanner、StatusBar のスタイルを追加し、既存 `.toolbar` / `.path-display` スタイルを置換する。
- `docs/components/tauri_viewer/`
  - README、basic design、detail design、interface spec を新 UI 契約へ同期する。

非対象:

- OS native menu は導入しない。
- Recent Folders、multi-tab、split view は後続 TODO で扱う。
- Avalonia 版の UI 変更は TODO-2026-008 以降で扱う。
- Tauri command、Rust backend、capability、保存データ形式は変更しない。

## 採用案 / 不採用案 / 判断理由

採用案: React アプリ内 MenuBar と StatusBar を `App.tsx` の表示コンポーネントとして追加する。

- 既存の操作はすべて React state と Tauri JS plugin 呼び出しに閉じており、OS native menu へ移す必要がない。
- 後続の Recent Folders は React 側の menu item 拡張として扱える。
- StatusBar は `rootPath`、`selectedFilePath`、`loadingMessage`、`errorMessage` から派生表示でき、追加 state を増やさずに実装できる。
- Tauri/Rust 境界を変えないため、既存 Markdown 表示、PlantUML、相対画像、リンク遷移の副作用を限定できる。

不採用案: OS native menu を導入する。

- Tauri menu API と platform 差分を扱う必要があり、WP-001 の目的である UI 領域分離に対して過剰である。
- 後続で Tauri 先行 UX を Avalonia へ反映する前提では、React 内 MenuBar の方が見た目と操作を短いサイクルで評価しやすい。

不採用案: 既存 Toolbar を名前だけ MenuBar に変更する。

- root path と active file が上段操作領域に残り、後続タブ UI と表示責務が衝突しやすい。
- loading / error 表示が preview pane 上部だけに残ると、ユーザーが状態を常に確認できる StatusBar 契約にならない。

## Before / After

Before:

```text
<main.app-shell>
  <Toolbar>
    Open Folder / Theme / Reload / root path / selected file
  </Toolbar>
  <section.workspace>
    <aside.explorer-pane/>
    <section.preview-pane>
      error-banner / loading-banner / MarkdownPreview
    </section>
  </section>
</main>
```

After:

```text
<main.app-shell>
  <MenuBar>
    File group: Open Folder button / Reload button
    View group: Theme toggle button
  </MenuBar>
  <section.workspace>
    <aside.explorer-pane/>
    <section.preview-pane>
      MarkdownPreview
    </section>
  </section>
  <StatusBar>
    root path / active file / loading state / error state
  </StatusBar>
</main>
```

Preview 内の inline PlantUML pending / error 表示は維持する。代表 loading / error は StatusBar に移し、preview pane 上部の sticky banner は削除する。

MenuBar は React アプリ内で常時展開されたボタン群として実装する。`File` / `View` は視覚上のグループラベルであり、クリックで開くドロップダウン、`role="menubar"` / `role="menuitem"`、矢印キーによるメニュー移動、フォーカストラップは導入しない。各 command は通常の `button` としてクリックまたはキーボード activation で即実行する。

## UI / API / データモデル / ドメインルールの変更点

UI 変更:

- `MenuBar` はアプリ内 header として実装する。
- MenuBar の command は常時表示のボタンとして `File` と `View` のグループに分ける。
  - `File`: `Open Folder`, `Reload`
  - `View`: `Theme: Light/Dark`
- `File` / `View` は grouping label であり、ドロップダウンメニューは持たない。
- `Reload` は `rootPath` がない場合、または `isBusy` の場合に disabled。
- `Open Folder` と theme toggle は既存と同じく `isBusy` 中 disabled。
- `StatusBar` は常時下部に表示し、次を表示する。
  - `Root: <rootPath>` または `Root: No folder selected`
  - `File: <selectedFileName>` または `File: No file selected`
  - `State: Ready` / `Loading Markdown...` / `Rendering PlantUML diagrams...` / `Loading Markdown and rendering PlantUML diagrams...`
  - `Error: <errorMessage>` または `Error: None`
- 支援技術向けには `State:` と `Error:` の値だけを `aria-live="polite"` な子要素に分ける。`Root:` と `File:` は live region に含めず、root / active file 変更時の不要な読み上げを避ける。

API / データモデル変更:

- Tauri command の追加・変更は行わない。
- Rust / TypeScript の永続データモデルは変更しない。
- `Theme`、`FileTreeNode`、`PlantUmlRenderResponse` の型は維持する。

ドメインルール:

- 単一 root / 単一 active Markdown の表示モデルを維持する。
- `isBusy` 中の重複操作抑止は維持する。
- PlantUML 図単位の inline pending / error 表示は維持する。
- Markdown 内 HTML は引き続き許可しない。

## 受け入れ条件ごとの対応方針

| 受け入れ条件 | 対応方針 |
| --- | --- |
| `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる | `Toolbar` を `MenuBar` に置換し、既存 handler をそのまま props で渡す。`Reload` と busy disabled 条件も維持する。 |
| root path、active file、loading、error が StatusBar に表示される | `StatusBar` を追加し、`rootPath`、`selectedFileName`、`loadingMessage`、`errorMessage` を表示する。loading がない場合は `Ready`、error がない場合は `None` を表示する。 |
| 既存単一ファイル表示が退行しない | `loadRoot`、`loadMarkdown`、`selectedMarkdown`、`previewRevision`、`MarkdownPreview` のデータフローは変更しない。 |
| Mermaid が退行しない | `mermaid.initialize` / `mermaid.run` の effect と依存配列は変更しない。 |
| PlantUML が退行しない | `plantUmlRenderState`、`extractPlantUmlSources`、`render_plantuml_diagrams` invoke、inline placeholder は変更しない。 |
| 相対画像が退行しない | `renderMarkdown` の image rule、`resolveSiblingPath`、`convertFileSrc` は変更しない。 |
| リンク遷移が退行しない | `handlePreviewClick`、`openUrl`、anchor scroll、相対 `.md` 読み込みは変更しない。 |

## 影響コンポーネント別の変更範囲

| コンポーネント | 変更範囲 |
| --- | --- |
| `App.tsx` | `Toolbar` component を `MenuBar` / `StatusBar` へ分割。`App` の JSX を 3 領域構成へ変更。既存 handler と派生 state は再利用。 |
| `App.css` | `app-shell` の grid rows を `MenuBar / workspace / StatusBar` に変更。`.toolbar` / `.path-display` を新 class へ置換。StatusBar の overflow / ellipsis / error 表示を定義。 |
| `docs/components/tauri_viewer/README.md` | 主要要素と責務の記述を Toolbar から MenuBar / StatusBar へ更新。 |
| `docs/components/tauri_viewer/basic_design.md` | React 責務、コンポーネント図、状態モデルの UI 表現を更新。 |
| `docs/components/tauri_viewer/detail_design.md` | 状態管理、モジュール図、UI レイアウト、エラーハンドリング表示先を更新。 |
| `docs/components/tauri_viewer/interface_spec.md` | ユーザー操作と StatusBar 表示契約を更新。 |

## コンポーネント責務と依存方向

`App` は引き続き画面状態の正本を持つ。`MenuBar` と `StatusBar` は props を受け取る presentational component とし、Tauri command 直接呼び出しや独自 state を持たせない。

```text
App state / handlers
  -> MenuBar props: theme, rootPath, isBusy, onOpenFolder, onReload, onToggleTheme
  -> StatusBar props: rootPath, selectedFileName, loadingMessage, errorMessage
  -> FileTree / MarkdownPreview
  -> Tauri invoke / plugin-dialog / plugin-opener
```

この変更では、Rust backend から React UI への逆方向通知や追加 command は導入しない。

## 類似既存ロジックとの抽象化・共通化方針

- `Toolbar` の handler 受け渡しは `MenuBar` へ移し、重複した `openFolder` / `reload` wrapper は作らない。
- root path / active file の表示は既存 `path-display` 相当を StatusBar に移す。表示用の別 state は追加せず、既存 state からの派生値に限定する。
- loading / error の文言生成は既存 `loadingMessage` と `errorMessage` を使う。StatusBar 用に別の error state や fallback message を持たない。

## 互換性・移行方針

- 保存データや外部 API はないため、データ移行は不要。
- 操作名は既存 UI と同じ英語文言を維持する。
- `Open Folder` / `Reload` / theme の disabled 条件は維持する。
- preview pane 上部の sticky error/loading banner は StatusBar へ役割を移すため削除する。PlantUML 図単位の inline loading/error は維持し、詳細位置を失わない。

## 例外・エラーハンドリング方針

- Tauri command / Mermaid / PlantUML の代表エラーは `errorMessage` に集約し、StatusBar の `Error:` 欄に表示する。
- PlantUML 図単位の失敗は引き続き Markdown 本文内の該当箇所にも `.plantuml-error` として表示する。
- StatusBar は代表メッセージを省略せず、横幅不足時は CSS ellipsis と `title` で全文確認できるようにする。
- StatusBar 全体を live region にはしない。`State:` と `Error:` の値だけを `aria-live="polite"` にし、既存 `.loading-banner` の `role="status"` が担っていた loading 通知を StatusBar へ移す。
- 既存仕様不一致を吸収するための追加 fallback は実装しない。

## 恒久ドキュメント更新予定先

Phase 3 の実装差分と同時に次を更新する。

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`

Architecture docs は Tauri Viewer の詳細な UI 構成名変更に留まるため、Phase 3 時点で横断的判断が増えない限り更新しない。ADR 追加も不要見込み。

## テスト・ユーザ確認観点

自動 / build check:

- `cd markdown-viewer-tauri && npm run build`
- `cd markdown-viewer-tauri/src-tauri && cargo check`

手動確認:

- Open Folder が MenuBar から実行でき、Explorer と初期 Markdown が表示される。
- Reload が MenuBar から実行でき、同一 Markdown でも Mermaid / PlantUML が再描画される。
- Theme toggle が MenuBar から実行でき、Light / Dark が切り替わる。
- StatusBar に root path と active file が表示される。
- Markdown 読み込み中または PlantUML 描画中に StatusBar が loading 状態を表示する。
- エラー発生時に StatusBar が代表 error を表示する。
- `sample_docs/plantuml.md` で Mermaid と PlantUML が同居して表示される。
- 相対画像と相対 Markdown リンク遷移が維持される。

## リスクと follow-up

リスク:

- preview pane 上部の banner を削除すると、長い文書閲覧中に error / loading の視認位置が下部へ変わる。StatusBar は常時表示し、error 文言を省略しすぎないことで補う。
- MenuBar の見た目が OS native menu と誤認される可能性がある。設計上は React 内 MenuBar であり、platform native shortcut や OS menu integration は扱わない。
- StatusBar の情報量が多く、狭い幅で root path と error が競合する。表示優先度は `Error`、`State`、`File`、`Root` の順とし、`Root` を最初に短縮する。CSS grid / flex と ellipsis / title で破綻を避ける。

follow-up:

- Recent Folders は TODO-2026-004 で MenuBar の `File` group または Tauri native menu (`@tauri-apps/api/menu`) へ追加する。publish 確認で OS 標準 menu への期待が出たため、TODO-2026-004 の設計で app-wide / window menu の platform 差分と React state 連携を扱う。
- Multi-tab 導入時は active file 表示を active tab 表示に拡張する。
- Split view 導入時は StatusBar の active pane / active tab 表示要否を再評価する。
- ドロップダウン式の React 内 MenuBar が必要になった場合は、ARIA `menubar` / `menuitem` ロール、矢印キー操作、フォーカス管理を含む別 TODO として起票する。

## Phase 4 publish 動作確認フィードバック反映

2026-07-07 の publish 動作確認で、長い root path / error が StatusBar 内では見切れやすいことを確認した。完了時点仕様では、初期設計の「StatusBar に root path / active file / loading / error を集約する」方針を次のように補正する。

- `RootPathBar` を MenuBar 直下に常時表示し、`Root: <rootPath>` または `Root: No folder selected` を表示する。
- `ErrorBanner` を StatusBar 直上に追加し、代表 error がある場合だけ薄い赤背景で表示する。
- `StatusBar` は `State` と `File` に絞る。
- `RootPathBar` / `ErrorBanner` / `StatusBar` は追加 state を持たず、既存 `rootPath` / `errorMessage` / `selectedFileName` / `loadingMessage` から派生表示する。
- `State` の値だけ `aria-live="polite"` とし、代表 error は `ErrorBanner` の `role="alert"` で通知する。

また、Tauri v2 の local API 型定義では `@tauri-apps/api/menu` に `Menu.setAsAppMenu()` / `Menu.setAsWindowMenu()` があり、OS native menu は技術的に検討可能である。ただし TODO-2026-003 の non-scope として維持し、Recent Folders を導入する TODO-2026-004 で platform 差分と React state / handler 連携を設計する。
