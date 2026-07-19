# Tauri Viewer 基本設計

## 基本方針

OS 連携とファイルシステム境界は Rust command へ寄せ、画面状態と Markdown 表示は React 側で扱う。Tauri が WebView を提供し、フロントは Vite で組み立てた React アプリ。PlantUML だけは Java プロセスを使うため Rust に集約する。

## 責務

- React: MenuBar dropdown、Settings dialog、Recent Folders、root path strip、Explorer、TabStrip、Preview、error strip、StatusBar、永続 Theme / window resize queue、tab単位のエラー / loading、Markdown → HTML 変換、リンク処理。
- TypeScript renderer (`renderMarkdown`): `markdown-it` のカスタム fence / image / heading ルール。相対画像を `convertFileSrc` 経由で asset URL へ。相対 `.md` リンクをアプリ内遷移へ。
- Rust: root 配下の安全なファイル走査、Markdown 本文の UTF-8 読み込み、PlantUML レンダリング (Java プロセス起動)、Recent Folders / Viewer settings の app config JSON 永続化。
- Tauri config: dialog / opener / asset protocol の権限管理。capability で plugin 利用を許可する。

## データモデル

`FileTreeNode` は Rust とフロントエンドで camelCase で対応する。

| field | 型 | 補足 |
|---|---|---|
| `name` | string | ファイル / ディレクトリ名 |
| `path` | string | OS絶対パス。Windowsではfrontend境界で`\\?\`を除いた通常形式を返す |
| `relativePath` | string | root からの相対パス |
| `nodeType` | `"directory" \| "markdown" \| "image"` | enum |
| `children` | `FileTreeNode[]` | directory のみ非空、Directory→Markdown→Image の順で整列 |

PlantUML 結果も Rust とフロントエンドで対応する (`PlantUmlRenderResponse` / `PlantUmlDiagramResult`)。

`RecentFolderEntry` は Rust とフロントエンドで camelCase で対応し、保存時点の canonical path を正本とする。Windowsのfilesystem内部ではverbatim pathを維持し、frontend・設定保存・Java process引数の境界で通常のdrive / UNC pathへ変換する。

| field | 型 | 補足 |
|---|---|---|
| `path` | string | canonicalized absolute directory path |
| `name` | string | `record_recent_folder` 実行時に Rust 側で確定した folder name snapshot |
| `lastOpenedAt` | string | Unix seconds を文字列化した最終 open 時刻 |

`OpenDocumentTab` はfrontend内だけの型付きstateで、同一root内のMarkdownを保持する。

| field | 型 | 補足 |
|---|---|---|
| `id` | string | App内で単調増加する不透明ID |
| `path` | string | tab collection内で一意な絶対path |
| `displayName` | string | TabStrip / StatusBar表示名 |
| `markdown` | string | UTF-8本文。Reload失敗時は直前値を維持 |
| `revision` | number | 初回読込 / Reloadごとに増加するasync guard |
| `loadState` | `loading \| rendering \| ready \| error` | tab単位状態 |
| `errorMessage` | `string \| null` | tab単位代表error |
| `plantUmlDiagrams` | `PlantUmlDiagramResult[]` | tab単位のpending / SVG / error cache |

`ViewerSettings` は Rust / TypeScript / app config JSON で camelCase 対応する。

| field | 型 | 補足 |
|---|---|---|
| `theme` | `"light" \| "dark"` | 起動時復元し、View menu / Settings dialog の保存成功後に反映 |
| `windowSize` | `{ width: number, height: number }` | logical size。既定 800 x 600、有効範囲 width 640..10000 / height 480..10000 |
| `plantUmlJarPath` | `string \| null` | canonical absolute jar path。`null` はruntime directory自動探索 |

`ViewerSettingsLoadResult` は`settings`と`warnings`を返す。型として読める範囲外window sizeは既定値へ部分正規化し、Theme / jar path / Recent Foldersを維持する。malformed JSONは`Err`として保存で上書きしない。

## 依存方向

```text
React UI -> Tauri invoke -> Rust commands -> filesystem / Java
React UI -> markdown-it / mermaid -> WebView DOM
React UI -> @tauri-apps/plugin-dialog / plugin-opener -> OS
```

フロント → Rust の方向のみ。Rust 側から JS を呼び出すコールバックは使わず、結果は `invoke` の戻り値で返す。

## コンポーネント図

```plantuml
@startuml
skinparam shadowing false
skinparam componentStyle rectangle

package "Frontend (React + Vite)" as F {
  [main.tsx]
  [App / MenuBar / SettingsDialog / RootPathBar / FileTree / TabStrip / MarkdownPreview / ErrorBanner / StatusBar]
  [renderMarkdown\n(markdown-it custom rules)]
  [mermaid (client)]
  [App.css (theme / layout)]
}

package "Tauri JS API" as TJS {
  [@tauri-apps/api/core\n(invoke, convertFileSrc)]
  [plugin-dialog]
  [plugin-opener]
}

package "Tauri Runtime / WebView" as TR {
  [WebView]
  [asset protocol]
  [Capability: default]
}

package "Rust backend (lib.rs)" as R {
  [scan_directory]
  [read_text_file]
  [render_plantuml_diagrams\n(spawn_blocking)]
  [load_recent_folders]
  [record_recent_folder]
  [remove_recent_folder]
  [load_viewer_settings]
  [save_viewer_preferences]
  [save_window_size]
  [AppConfigStore]
}

package "External" as E {
  [filesystem]
  [java + plantuml.jar]
  [OS default browser]
}

[main.tsx] --> [App / MenuBar / RootPathBar / FileTree / TabStrip / MarkdownPreview / ErrorBanner / StatusBar]
[App / MenuBar / RootPathBar / FileTree / TabStrip / MarkdownPreview / ErrorBanner / StatusBar] --> TJS
[App / MenuBar / RootPathBar / FileTree / TabStrip / MarkdownPreview / ErrorBanner / StatusBar] --> [renderMarkdown\n(markdown-it custom rules)]
[App / MenuBar / RootPathBar / FileTree / TabStrip / MarkdownPreview / ErrorBanner / StatusBar] --> [mermaid (client)]
TJS --> TR
TR --> R
R --> E
TR --> E : asset:// → filesystem
@enduml
```

## 依存パッケージ図

```plantuml
@startuml
skinparam shadowing false
left to right direction

package "Frontend" {
  [React]
  [TypeScript]
  [Vite]
  [markdown-it]
  [mermaid]
  [@tauri-apps/api]
  [@tauri-apps/plugin-dialog (JS)]
  [@tauri-apps/plugin-opener (JS)]
}

package "Rust crates" {
  [tauri]
  [tauri-plugin-dialog]
  [tauri-plugin-opener]
  [serde / serde_json]
}

package "PlantUML runtime" {
  [java (PATH)]
  [plantuml.jar]
  [plantuml.config.json]
}

[App.tsx] --> [React]
[App.tsx] --> [TypeScript]
[App.tsx] --> [markdown-it]
[App.tsx] --> [mermaid]
[App.tsx] --> [@tauri-apps/api]
[App.tsx] --> [@tauri-apps/plugin-dialog (JS)]
[App.tsx] --> [@tauri-apps/plugin-opener (JS)]

[lib.rs] --> [tauri]
[lib.rs] --> [tauri-plugin-dialog]
[lib.rs] --> [tauri-plugin-opener]
[lib.rs] --> [serde / serde_json]
[lib.rs] --> [java (PATH)]
[lib.rs] --> [plantuml.jar]
[lib.rs] --> [plantuml.config.json]
@enduml
```

## 状態モデル

```plantuml
@startuml
skinparam shadowing false

[*] --> NoRoot : App 起動

state NoRoot : rootPath = null
state HasRoot : rootPath set\ntabs は0件以上
state TabLoading : active tab loadState = loading
state AppConfigUpdating : foregroundConfigOperationCount > 0
state PlantUmlPending : active tab loadState = rendering
state Error : error strip に errorMessage 表示

NoRoot --> HasRoot : Open Folder / loadRoot scan成功
HasRoot --> TabLoading : Explorer 選択 / Reload
TabLoading --> HasRoot : read_text_file 成功
TabLoading --> Error : Tauri command 失敗
HasRoot --> AppConfigUpdating : recent / theme / settings 保存
AppConfigUpdating --> HasRoot : app config JSON 更新完了
AppConfigUpdating --> Error : config command 失敗
HasRoot --> PlantUmlPending : PlantUML fence 検出
PlantUmlPending --> HasRoot : render_plantuml_diagrams 完了
PlantUmlPending --> Error : render 失敗 / firstError
Error --> HasRoot : 次の操作で復帰
@enduml
```

## Tauri 設定要点

- `assetProtocol.enable = true` + `scope = ["**"]` で `convertFileSrc` を介した相対画像参照を許可する。
- `csp = null` (MVP)。本番化時は要見直し。
- capability `default` は window `main` に対し `core:default` / `dialog:default` / `opener:default` のみを許可する。
- Recent Folders と Viewer settings は Tauri の app config directory 配下 `settings.json` に保存する。browser `localStorage` は使用しない。
- `settings.json` は sibling temporary file へ全量write / sync後にatomic replaceし、失敗時は既存fileを維持する。
