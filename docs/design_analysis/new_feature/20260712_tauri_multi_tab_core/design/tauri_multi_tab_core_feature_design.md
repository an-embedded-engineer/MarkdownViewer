# Tauri Multi-tab core 導入 設計

## 背景・要求・完了条件

`TODO-2026-005` は、Tauri 版 Markdown Viewer の単一文書状態を複数タブ状態へ移行し、同一 root 内の複数 Markdown を短い操作で切り替えて参照できるようにする新機能である。先行して完了した MenuBar / StatusBar と Recent Folders を維持し、後続の `TODO-2026-006 Tauri Split view` が利用できる tab core を構築する。

対象ユーザーは、同一フォルダ内の複数 Markdown、Mermaid、PlantUML を行き来しながら確認する利用者である。

完了条件:

- Explorer で未オープンの Markdown を選ぶと新規タブを開き、同一 path が既に開いていればそのタブを activate する。
- TabStrip で active tab を識別し、activate / close できる。active tab close 後は右隣、右隣がなければ左隣へ移る。最後のタブ close 後は未選択表示になる。
- Reload は active tab のみを再読込し、theme は全タブに共通して反映する。
- 相対 Markdown リンクも同一 path の既存タブを再利用し、未オープンなら新規タブを開いて anchor へ移動する。
- root 変更成功時に旧 root のタブを破棄し、新 root の初期 Markdown だけを開く。root scan 失敗時は既存 root / tabs を維持する。
- タブ切替や非同期処理の完了順にかかわらず、Markdown、相対画像、Mermaid、PlantUML、anchor、loading / error 表示が別タブへ混線しない。
- 多数タブは横スクロールで任意のタブへ到達できる。

## ユースケースと操作導線

1. 利用者が Explorer の Markdown をクリックする。
2. path が `tabs` に存在すれば `activeTabId` を既存タブへ変更する。
3. 存在しなければ loading 状態のタブを末尾へ追加して activate し、本文と PlantUML を非同期読込する。
4. TabStrip のタブ本体をクリックすると activate、close ボタンをクリックすると対象タブを閉じる。
5. `File > Reload` は Explorer tree を再 scan した後、active tab の revision を進めて再読込する。
6. Markdown 内の相対 `.md` / `.markdown` リンクは Explorer 選択と同じ open-or-activate 経路を使い、anchor を対象タブへ渡す。
7. `Open Folder` / `Recent Folders` は root scan 成功後に旧タブを破棄し、新 root の README または最初の Markdown を1タブだけ開く。

## 対象範囲と非対象

対象範囲:

- `OpenDocumentTab` 型、`tabs`、`activeTabId`、root 操作中状態、tab 単位 loading / error / revision / PlantUML 結果。
- `TabStrip` React component と Light / Dark、active、close、loading、overflow の CSS。
- Explorer、Reload、relative Markdown link、MarkdownPreview、Mermaid / PlantUML、ErrorBanner、StatusBar の tab state 統合。
- Tauri Viewer の恒久ドキュメント更新。

非対象:

- split view、複数 pane、タブの pane 間移動。`TODO-2026-006` で扱う。
- タブ永続化、再起動復元、pin、reorder、drag and drop、編集、未保存状態、close confirmation。
- root 外 Markdown、3ペイン以上、Avalonia multi-tab。
- Rust command の新設・変更。既存 command 契約をそのまま利用する。
- tab ごとのスクロール位置保存と Arrow key による tab roving focus。必要なら UX 評価後に follow-up とする。

## 最小提供範囲と後続拡張

最小提供範囲は、単一 preview pane に対する複数タブの open / activate / close / Reload / link navigation と、タブ単位の非同期状態分離である。TabStrip overflow は CSS の横スクロールを採用し、dropdown や reorder は導入しない。

後続 split view では `tabs` を文書データの正本として再利用し、pane 側は参照する `activeTabId` を持てる。今回の `activeTabId` は単一 pane の選択として `App` に置くが、tab 自体へ pane 固有状態を埋め込まない。

## 採用案・不採用案・判断理由

### 採用: tab collection に本文と PlantUML 結果を保持

`OpenDocumentTab` に Markdown 本文、revision、PlantUML 結果を保持する。タブ切替だけでは `read_text_file` と `render_plantuml_diagrams` を再実行しない。PlantUML の SVG は現行と同様に theme 非依存で保持し、theme 切替時は active preview の Mermaid だけを再描画する。

理由:

- PlantUML command の再実行を抑え、タブ切替を軽量化できる。
- tab ごとの loading / error と非同期結果の所有者が明確になる。
- 後続 split view でも同じ tab data を複数 pane から参照できる。

### 不採用: active tab の Markdown だけを保持

切替ごとに本文と図を読み直す方式は state が小さい一方、PlantUML の待ち時間が毎回発生し、複数文書を比較するユーザ価値を損なうため採用しない。

### 不採用: tab ごとに DOM / WebView を保持

スクロール位置を自然に保持できるが、非 active DOM の Mermaid 管理と後続 split view の表示所有権が複雑になり、メモリ消費も増える。今回は active tab だけを単一 `MarkdownPreview` に描画する。

### 採用: 横スクロール TabStrip

`overflow-x: auto` と縮まない tab item により、多数タブ時も全タブへ到達可能にする。dropdown 状態や二重の activate / close 導線を増やさず最小範囲を満たす。

### 不採用: 旧単一文書 state の互換維持

`selectedFilePath` / `selectedMarkdown` / global `plantUmlRenderState` を tab state と並存させない。active tab から必要な派生値を得る単一路線へ置換し、同期漏れを避ける。

## Before / After

| 観点 | Before | After |
| --- | --- | --- |
| 文書 state | `selectedFilePath` / `selectedMarkdown` が単一 | `tabs: OpenDocumentTab[]` と `activeTabId` |
| loading | global `isMarkdownLoading` | root / recent 操作は global、文書・PlantUML は tab 単位 |
| PlantUML | active 文書の `{ key, diagrams }` 1件 | 各 tab が revision に対応する results を保持 |
| Explorer click | global state を上書き | path で open-or-activate |
| link navigation | 同じ preview を上書き | open-or-activate 後に対象 tab の anchor へ移動 |
| Reload | root + 単一文書 | root + active tab のみ |
| root change | 単一選択を置換 | scan 成功時に tab collection を交換 |
| preview | 単一 DOM | 引き続き単一 DOM、active tab data のみ描画 |

## データ設計

```ts
type TabLoadState = "loading" | "rendering" | "ready" | "error";

type OpenDocumentTab = {
  id: string;
  path: string;
  displayName: string;
  markdown: string;
  revision: number;
  loadState: TabLoadState;
  errorMessage: string | null;
  pendingAnchor: string | null;
  plantUmlDiagrams: PlantUmlDiagramResult[];
};
```

- `id`: App 内で単調増加する counter から生成する不透明 ID。path と分離し、後続 pane state が文書 identity を安定参照できるようにする。
- `path`: 現 root 内の絶対 path。同一 root の `tabs` 内で一意とし、open-or-activate の照合キーにする。
- `revision`: 初回読込と Reload のたびに増加する。async response 適用時に `tabId + revision` が現在値と一致する場合だけ更新する。
- `loadState`: Markdown 読込と PlantUML 描画を tab 単位で表す。PlantUML fence がなければ Markdown 成功時点で `ready`。
- `errorMessage`: 対象 tab の Markdown / PlantUML / Mermaid 代表 error。active tab の error だけを ErrorBanner に表示する。
- `pendingAnchor`: 対象 tab activate 後、active preview の描画完了時に消費する。

App 全体には次を保持する。

- `rootPath`, `fileTree`, `tabs`, `activeTabId`, `theme`, `recentFolders`, `activeMenu`。
- `rootOperationError`: root scan、recent folder、root 全体操作の代表 error。
- `isRootLoading`, `isRecentFoldersBusy`: root collection を交換する操作だけの global busy。
- `nextTabIdRef`: state 更新を発生させず一意 tab ID を採番する `useRef<number>`。

`activeTab`、`activeTabError`、`activeLoadingMessage`、`selectedFilePath` は state として重複保持せず、`tabs` と `activeTabId` から導出する。

## 責務分割と共通化方針

`App.tsx` の既存 renderer / path helper は再利用する。新しい tab 操作は以下の責務へまとめ、Explorer と link navigation で重複実装しない。

- `openOrActivateTab(rootPath, filePath, anchor?)`: path 検索、既存 activate、loading tab 作成、読込開始。
- `loadTab(tabId, rootPath, filePath, revision, anchor?)`: `read_text_file` と PlantUML command を実行し、guard 付きで対象 tab を更新。
- `updateTabIfCurrent(tabId, revision, updater)`: tab が存在し revision が一致する場合だけ immutable update。
- `activateTab(tabId)`: active ID 更新。tab の pending anchor は preview effect が消費する。
- `closeTab(tabId)`: 対象削除と deterministic な隣接 tab 選択。
- `reloadActiveTab()`: root scan 後に active tab の revision を増やし、同じ tab identity へ再読込。

これらは App state を直接調停するため `App` 内 handler とする。renderer / path helper のような純粋処理ではなく、現段階で別 service や汎用 global utility へ抽象化しない。後続 split view で state transition が複雑化した時点で reducer 抽出を判断する。

`TabStrip` は表示とイベント通知だけを担当し、tab collection を独自 state として複製しない。

## 非同期処理と競合制御

1. 新規 tab を `revision = 1`, `loadState = loading` で先に追加する。
2. `read_text_file` 成功時、`tabId + revision` が一致すれば Markdown を格納する。
3. PlantUML source があれば同じ tab を `rendering` とし、pending placeholders を設定して command を開始する。
4. command 完了時も `tabId + revision` を照合し、一致時だけ result を適用する。
5. Reload は revision を増やすため、旧 request の遅延 response は無視される。
6. close 済み tab は lookup できないため response を無視する。
7. active tab の変更は response 適用条件に含めない。非 active tab の正しい cache 更新は許可するが、active preview / ErrorBanner は active tab から導出するため上書きされない。

Tauri invoke の cancellation API は導入せず、結果適用 guard に統一する。不要な cancellation fallback を併設しない。

## UI設計

`preview-pane` を `preview-workspace` とし、内部を `TabStrip` と scrollable preview content の2行 grid にする。

```text
workspace
├── Explorer
└── PreviewWorkspace
    ├── TabStrip (horizontal overflow)
    └── PreviewContent (single active MarkdownPreview)
```

TabStrip:

- container は `role="tablist"`, `aria-label="Open Markdown files"`。
- activate button は `role="tab"`, `aria-selected`, `aria-controls="markdown-preview"` を持つ。
- close は activate button とネストしない独立 button とし、`aria-label="Close <name>"` を持つ。
- active、loading / rendering、error を text / title / class で識別できる。色だけに依存しない。
- tab item は `flex: 0 0 auto`、container は `overflow-x: auto`。長い file name は ellipsis、絶対 path は `title` で確認できる。
- active tab 変更時は対象要素を `scrollIntoView({ block: "nearest", inline: "nearest" })` し、横スクロール範囲内へ表示する。

PreviewContent は従来どおり1つだけ描画する。active tab がなければ `No Markdown file selected.` を表示する。

Explorer の selected 表示は `activeTab?.path` と一致する Markdown に付ける。文書 loading / PlantUML rendering 中も別 tab の activate と close、Explorer からの open-or-activate を許可する。root 変更、Recent Folders config 更新中は既存どおり root 競合操作を抑止する。

StatusBar の `File` は active tab name、`State` は active tab の `Loading Markdown...` / `Rendering PlantUML diagrams...` / `Ready` を表示する。将来 tab count を追加可能だが、今回の最小範囲では既存2項目構成を維持する。

## Root変更・Reload・失敗時動作

### Root変更

- `scan_directory` 成功を commit point とする。失敗時は既存 `rootPath`, `fileTree`, `tabs`, `activeTabId` を維持し、`rootOperationError` を表示する。
- scan 成功後に root / tree を交換し、旧 tabs を破棄する。
- README または最初の Markdown があれば新 tab を1つ作成して読込する。なければ tabs は空。
- Recent Folders 記録失敗は新 root 表示を rollback せず、global error として表示する。
- 新 root の初期 Markdown 読込失敗はその tab を error 状態で残し、root / Explorer は利用可能にする。

### Reload

- `scan_directory` 失敗時は tree と active tab content を維持する。
- scan 成功後、active tab があれば同じ `id` の revision を進めて再読込する。
- read 失敗時は直前の Markdown / PlantUML 結果を保持しつつ tab を error とし、利用者が別 tab へ移動または再試行できるようにする。
- active tab がなければ tree scan だけを行う。

### エラー優先順位

`ErrorBanner` は `rootOperationError ?? activeTab.errorMessage` を表示する。次の root 全体操作開始時に root error をclearし、tab error は対象 tab の再読込成功時にclearする。非 active tab error はその tab の error indicator で示し、activate 時に banner へ表示する。

## Mermaid・PlantUML・anchor

- PlantUML は tab load handler 内で抽出・invokeし、結果を tab cache に保存する。theme と activate だけでは再実行しない。
- Mermaid は active `MarkdownPreview` DOM の生成後に `activeTab.id`, `activeTab.revision`, `theme`, `activeTab.plantUmlDiagrams` を依存として `mermaid.run` する。
- Mermaid error は処理開始時の `tabId + revision` が現在も一致する場合だけ対象 tab error へ反映する。
- anchor は link target tab の `pendingAnchor` に格納する。active preview 描画後に scroll し、同じ tab revision を guard してclearする。
- 同一ページ `#anchor` は現在の active preview 内ですぐ scroll し、tab state を変更しない。

## 互換性・移行方針

- 永続データ、Rust command、Tauri capability、設定ファイルの migration は不要。
- 起動直後と root 未選択時の表示は維持する。
- root open 時に README / 最初の Markdown を自動選択する既存挙動は、新規1タブを開く挙動として維持する。
- Markdown HTML無効、相対画像、外部URL、heading slug、Mermaid security level、PlantUML sanitization の既存契約を維持する。
- 旧単一文書 state や互換 adapter は残さず、tab state へ一括移行する。

## 影響範囲

- `markdown-viewer-tauri/src/App.tsx`
  - state model、handlers、async guard、TabStrip、preview effects、StatusBar / ErrorBanner 派生値。
- `markdown-viewer-tauri/src/App.css`
  - PreviewWorkspace 2行 layout、TabStrip、tab states、horizontal overflow、theme。
- `docs/components/tauri_viewer/README.md`
  - 責務、主要要素、TabStrip と tab state の概要。
- `docs/components/tauri_viewer/basic_design.md`
  - data model、component / state diagram、依存関係。
- `docs/components/tauri_viewer/detail_design.md`
  - tab state、open / activate / close / Reload、async guard、render flow。
- `docs/components/tauri_viewer/interface_spec.md`
  - UI操作、TabStrip、close selection、root / link / overflow / error 契約。
- `markdown-viewer-tauri/README.md`
  - `tabs` がMVP外という古い記載を除去し、現在の制約へ更新。

Rust backend、Cargo、Tauri config / capability に変更は予定しない。

## 恒久ドキュメント更新予定先

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `markdown-viewer-tauri/README.md`
- 実装上の再利用可能な非同期 guard 判断が確定した場合のみ `docs/architecture/code_patterns.md` / `common_pitfalls.md` を更新する。案件固有に留まる場合は追加しない。

## テスト・ユーザ確認観点

自動 / command確認:

- `npm run build` in `markdown-viewer-tauri/`
- `cargo check` in `markdown-viewer-tauri/src-tauri/`
- `git diff --check`

手動確認:

1. Explorer から3つ以上の Markdown を開き、順序、active 表示、同一 path 再選択で重複しないことを確認する。
2. inactive / active / 最後の tab をcloseし、active選択規則と未選択表示を確認する。
3. active tab Reload で他 tab の内容・revisionが変わらないことを確認する。
4. Light / Dark 切替で active Mermaid が再描画され、PlantUML command の不要な再実行がないことを確認する。
5. 相対 Markdown link が既存 tab をactivateまたは新規 tabを開き、anchorへ移動することを確認する。
6. 相対画像、外部URL、同一ページanchorを確認する。
7. Mermaid / PlantUML 混在文書、PlantUML pending / success / syntax error を確認する。
8. PlantUML描画中に別tabへ切替・対象tabをcloseし、遅延結果がactive preview / errorを上書きしないことを確認する。
9. root変更成功で旧tabsが破棄され、scan失敗では旧root / tabsが維持されることを確認する。
10. 多数tabを開き、横scrollで任意tabへ到達してactivate / closeできることを確認する。
11. Recent Folders、MenuBar、RootPathBar、ErrorBanner、StatusBarの既存機能が退行しないことを確認する。

## リスクとfollow-up

- `App.tsx` の状態更新が増える。今回の操作が immutable helper で明瞭に保てない場合は reducer 抽出を実装前に再評価するが、互換経路との二重管理は行わない。
- 大量・巨大文書を多数tabへ保持するとメモリ使用量が増える。上限やLRU cacheは実測要件がないため導入せず、問題が確認された場合にfollow-up化する。
- tabごとのscroll位置は保持しない。Tauri先行UX評価で必要性を確認し、Avalonia反映仕様化前に判断する。
- 横scrollの操作性やArrow key navigationはUX評価対象とし、必要なら独立TODOへ分離する。
- StatusBarへのtab count表示は現行レイアウトを変えるため今回含めず、UX評価で判断する。

## 設計完了条件

- review担当Agentの指摘がすべて解決され、`design_status=done` になっている。
- 最小提供範囲、非対象、既存統合点、後続split viewへの拡張点が合意されている。
- 実装前にtab identity、async guard、close選択、root変更、link、overflow、errorの契約が確定している。
