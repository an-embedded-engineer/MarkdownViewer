# Tauri Viewer 設定永続化・設定 UI 設計

## 1. 背景

Tauri 版は Recent Folders を Tauri の app config directory にある `settings.json` へ保存している一方、Theme は React state のみ、ウィンドウサイズは `tauri.conf.json` の固定値、PlantUML の明示 path は runtime directory の `plantuml.config.json` で管理している。そのため、利用者は再起動後に表示環境を復元できず、PlantUML path の確認・変更には JSON の手編集が必要である。

`TODO-2026-014` では Tauri 版を先行実装し、`TODO-2026-007` の UX 評価後に確定仕様を `TODO-2026-015` で Avalonia 版へ水平展開する。

## 2. 要求と完了条件

### 2.1 対象ユーザーとユーザ価値

- Tauri 版を継続利用し、起動のたびに表示環境を調整したくない利用者。
- `plantuml.config.json` を直接編集せず、アプリ内から PlantUML runtime を設定したい利用者。
- 前回のウィンドウサイズと Theme が復元され、設定値を MenuBar から確認・変更できることを価値とする。

### 2.2 ユースケース

1. 利用者が通常状態のウィンドウを resize し、操作停止後にサイズが保存される。再起動時に同じ論理サイズへ復元される。
2. 利用者が `View > Theme` で Theme を切り替えると、表示へ反映され app config JSON に保存される。
3. 利用者が `File > Settings...` を開き、現在の Theme、ウィンドウサイズ、PlantUML jar path を確認する。
4. 利用者が Settings dialog で Theme を選び、jar path を入力または `Browse...` で選択して保存する。
5. 利用者が jar path を `Clear` すると、明示設定を解除して既存の runtime directory 自動探索へ戻す。
6. 既存利用者が Recent Folders だけを含む `settings.json` で起動しても、履歴を失わず新しい既定設定を利用できる。

### 2.3 受け入れ条件

- window width / height、Theme、`plantuml.jar` path が既存 app config JSON に保存され、再起動後に復元される。
- MenuBar から Settings dialog を開き、現在値を確認し、Theme / jar path を変更・保存できる。
- 無効な jar path は Settings dialog または PlantUML error として表示され、Markdown / Mermaid 閲覧を妨げない。
- 既存 Recent Folders と、追加設定を持たない既存 JSON を保持したまま読み書きできる。
- `npm run build`、`cargo check`、Rust unit test と手動 UI 確認が成功する。

## 3. 対象範囲と非対象

### 3.1 最小提供範囲

- app config schema と Store 更新 API の拡張。
- 起動時のウィンドウサイズ／Theme 復元。
- 通常ウィンドウ resize の debounce 保存。
- 既存 Theme menu 操作の永続化。
- `File > Settings...` と modal dialog。
- jar path の入力、file picker、clear、検証、PlantUML runtime への反映。
- 既存 Recent Folders、Markdown、Mermaid、PlantUML、Multi-tab、Split view の回帰確認。

### 3.2 非対象

- Avalonia 実装。`TODO-2026-015` で扱う。
- ウィンドウ位置、最大化／最小化／fullscreen 状態。
- open folder、open tab、tab 順、split pane、scroll 位置。
- Java の導入、jar download、PlantUML version 管理。
- OS native settings window、設定の import/export、複数 profile、クラウド同期。

## 4. 採用案・不採用案

### 4.1 採用案: 既存 app config JSON の型付き拡張

Recent Folders と同じ `settings.json` に `viewerSettings` を追加する。

```json
{
  "recentFolders": [],
  "viewerSettings": {
    "theme": "light",
    "windowSize": {
      "width": 800,
      "height": 600
    },
    "plantUmlJarPath": null
  }
}
```

Rust では `AppConfig`、`ViewerSettings`、`WindowSize`、`AppTheme` を型として定義する。`AppConfig` と nested settings に `Default` と `#[serde(default)]` を設定し、既存 JSON の「フィールド欠落」だけを migration 対象として既定値で補う。malformed JSON、未知 Theme、型不一致は黙って補正せず明示エラーにする。

採用理由:

- 既存 Store lock と app config path を再利用でき、Recent Folders と設定の競合更新を一か所で防げる。
- browser localStorage と Rust JSON の二重正本を作らない。
- Avalonia 水平展開でも同等の型付き user config を設計しやすい。

### 4.2 不採用案

| 案 | 不採用理由 |
| --- | --- |
| `localStorage` に Theme / window size を保存 | Rust の Recent Folders / PlantUML path と正本が分散し、バックアップ・障害時の挙動も分かれる。 |
| `tauri.conf.json` を実行時に更新 | bundle resource はユーザー設定の保存先ではなく、配布後に安全に変更できない。 |
| `plantuml.config.json` だけを Settings UI から編集 | app config と runtime directory config の書き込み責務が分散し、bundle directory が書き込み不可の場合もある。 |
| resize ごとに app config 全体を frontend から保存 | 高頻度 I/O に加え、古い Recent Folders / Theme snapshot で新しい値を上書きする lost update が起こり得る。 |
| Avalonia と同時実装 | Tauri 先行 UX 評価後に stack 固有の責務へ水平展開する既存方針に反する。 |

## 5. Before / After

| 項目 | Before | After |
| --- | --- | --- |
| Theme | React state、起動時 Light | app config から復元。View menu と Settings dialog の変更を同じ保存処理へ集約 |
| Window size | `tauri.conf.json` の 800 x 600 | 通常状態の論理 width / height を保存し、起動時に復元 |
| PlantUML path | runtime directory の jar / `plantuml.config.json` | app config の明示 path を最優先。未指定時だけ既存自動探索 |
| 設定確認 | UI なし | `File > Settings...` modal で確認 |
| Recent Folders | `settings.json` に保存 | 同じ schema 内で保持し、設定更新と lock を共有 |

## 6. データ設計

### 6.1 Rust model

```text
AppTheme = Light | Dark

WindowSize
  width: u32
  height: u32

ViewerSettings
  theme: AppTheme
  window_size: WindowSize
  plant_uml_jar_path: Option<String>

AppConfig
  recent_folders: Vec<RecentFolderEntry>
  viewer_settings: ViewerSettings
```

- serde の `rename_all = "camelCase"` で TypeScript と JSON を一致させる。
- default は Theme `light`、width `800`、height `600`、jar path `None`。
- 保存サイズは physical pixel ではなく logical size とする。HiDPI 環境では frontend が `innerSize / scaleFactor` で変換する。
- 有効範囲は width `640..=10000`、height `480..=10000` とする。範囲外は保存 command でエラーにし、起動復元時は既定値を使って原因を stderr と frontend error strip に残す。
- jar path は空白だけなら `None`、値がある場合は absolute path、通常ファイル、拡張子 `.jar` を必須とし、canonical path を保存する。

### 6.2 互換性と migration

- `recentFolders` だけの既存 JSON は `viewerSettings = default` として読み込む。次回の成功した設定保存または resize 保存で新 schema を書き出す。
- `viewerSettings` 内の将来追加フィールドも `#[serde(default)]` で補える構造にする。
- malformed JSON、既知フィールドの型不一致、未知 Theme は自動修復や上書きをしない。ロードエラーを表示し、アプリ本体はコンパイル時既定値で閲覧可能にする。以後の保存も parse error を返し、Recent Folders を失う上書きを防ぐ。
- schema version は追加しない。現時点の migration は欠落フィールドの default 補完だけであり、変換手順を分岐する versioned migration は不要である。

## 7. Rust backend 設計

### 7.1 `AppConfigStore` の責務

既存の module-level `read_app_config` / `write_app_config` と command ごとの lock 操作を増やさず、`AppConfigStore` の method へ集約する。

```text
AppConfigStore
  load(app) -> Result<AppConfig, String>
  update(app, updater) -> Result<AppConfig, String>
  viewer_settings(app) -> Result<ViewerSettings, String>
  update_viewer_preferences(app, input) -> Result<ViewerSettings, String>
  update_window_size(app, input) -> Result<WindowSize, String>
  effective_plantuml_runtime(app) -> Result<PlantUmlRuntimeOptions, String>
```

- `update` が lock 内で read-modify-write を完了させる。
- Recent Folders command も同じ `update` を使うよう整理し、設定追加で重複する lock / serialization 処理を作らない。
- 設定 UI の保存と resize 保存は別の部分更新 method とし、古い frontend snapshot で他フィールドを上書きしない。
- JSON I/O 失敗は `Result<T, String>` で command 境界へ返し、握りつぶさない。

### 7.2 Tauri command

| command | 入力 | 出力 | 責務 |
| --- | --- | --- | --- |
| `load_viewer_settings` | なし | `ViewerSettings` | app config から設定を読む |
| `save_viewer_preferences` | `theme`, `plantUmlJarPath` | `ViewerSettings` | Theme と jar path を検証し、部分更新する |
| `save_window_size` | `width`, `height` | `WindowSize` | logical size を検証し、window size だけを部分更新する |

既存の `load_recent_folders` / `record_recent_folder` / `remove_recent_folder` は API を維持し、内部だけ Store method へ寄せる。

### 7.3 起動時 window restore

- `Builder::setup` で main window を取得し、Store から保存済み `WindowSize` を読む。
- 有効値なら `tauri::LogicalSize` で `set_size` する。未設定なら `tauri.conf.json` の 800 x 600 を維持する。
- malformed JSON または無効 size では起動を失敗させず既定サイズを維持し、原因を stderr に記録する。frontend の `load_viewer_settings` も同じエラーを error strip へ通知する。
- monitor work area に応じた位置補正は行わない。位置を保存しないため、window placement は OS / Tauri に委ねる。

### 7.4 PlantUML runtime 解決

`render_plantuml_diagrams` は command 開始時に Store から明示 jar path を 1 回だけ取得し、blocking task へ `PlantUmlRuntimeOptions` を渡す。各 diagram ごとに JSON を読み直さない。

解決優先順位:

1. `viewerSettings.plantUmlJarPath` の canonical absolute path。
2. path が `None` の場合だけ、現在の runtime directory 内 `plantuml.config.json`。
3. 同じく `None` の場合だけ、runtime directory 内 `plantuml.jar`。
4. いずれもなければ既存同様の PlantUML error。

明示 path が保存されているのに実行時に削除された場合、2 / 3 へ fallback しない。設定不整合を明示エラーにして Settings dialog で修正させる。`Clear` した場合だけ自動探索へ戻る。Theme 変更だけでは既存 tab の PlantUML SVG を再生成しない。

## 8. Frontend / UI 設計

### 8.1 状態

```text
viewerSettings: ViewerSettings | null
settingsDraft: ViewerPreferencesDraft | null
currentWindowSize: WindowSize
isAppConfigBusy: boolean
settingsError: string | null
```

- `theme` は既存の描画 state として維持するが、ロード／保存成功時に `viewerSettings.theme` と同時更新する。別の永続化経路は作らない。
- Recent Folders と settings command の busy は `isAppConfigBusy` に統合し、同じ Store を更新する操作の重複を防ぐ。Markdown tab 操作は従来どおり妨げない。
- Settings dialog は保存済み値の copy を `settingsDraft` として持つ。入力途中に app 全体の Theme や PlantUML runtime を変えない。

### 8.2 起動フロー

1. `load_viewer_settings` と `load_recent_folders` を起動 effect から実行する。
2. 設定ロード成功時に Theme と settings state を反映する。
3. ロード完了までは軽量な `Loading settings...` 表示を使い、Light theme の app shell を一瞬描画してから Dark へ切り替わる flash を避ける。
4. settings load が失敗した場合は既定 Theme で app shell を表示し、error strip に原因を出す。Recent Folders load の成否は個別に扱う。
5. `getCurrentWindow().innerSize()` と `scaleFactor()` から Settings dialog 表示用の現在 logical size を取得する。

### 8.3 MenuBar と Settings dialog

- `File` dropdown の `Reload` 後へ separator と `Settings...` を追加する。PlantUML path を含む application-wide 操作であり、`View` dropdown には置かない。
- 既存 `View > Theme` は残し、クリック時に `save_viewer_preferences` を通して永続化する。保存失敗時は Theme を変更せず error strip へ出す。
- dialog は `role="dialog"`、`aria-modal="true"`、見出しとの `aria-labelledby` を持つ。
- 項目:
  - `Theme`: Light / Dark select。
  - `Window size`: 現在の logical `width x height` を read-only 表示し、「resize で自動保存」と説明する。
  - `PlantUML jar`: path text input、`Browse...`、`Clear`。file picker は単一 file と `.jar` filter を使う。
- `Save` は draft を検証・保存し、成功後に Theme と保存済み state を反映して閉じる。
- `Cancel`、Escape、close button は draft を破棄する。保存中は二重操作を無効化する。
- validation / save error は dialog 内 `role="alert"` に表示し、dialog を閉じない。
- open 時に Theme select へ focus、close 時に `Settings...` menu item 相当の trigger へ focus を戻す。背景 content は dialog 表示中操作不可にする。

### 8.4 Window resize 保存

- `getCurrentWindow().onResized` を 1 回 subscribe し、unmount 時に unlisten する。
- 連続 event は 500 ms debounce し、最後の physical size を `scaleFactor` で logical size に変換して `save_window_size` へ渡す。
- `isMaximized()` / `isMinimized()` / `isFullscreen()` のいずれかが true の間は保存しない。最大化解除後の通常サイズ event だけを保存する。
- command 失敗は error strip に表示する。同じ error の resize event 連打を避けるため、失敗後も debounce 単位で通知する。

## 9. 操作フロー

### 9.1 Settings 保存

```text
User -> File > Settings...
App -> saved ViewerSettings を draft へ copy
User -> Theme / jar path を編集
User -> Save
App -> invoke(save_viewer_preferences)
Rust -> AppConfigStore.update(read -> validate -> partial update -> write)
Rust --> App: normalized ViewerSettings
App -> theme / viewerSettings 更新
App -> dialog close
```

### 9.2 PlantUML render

```text
App -> invoke(render_plantuml_diagrams)
Rust -> AppConfigStore.viewer_settings
alt explicit jar path
  Rust -> configured jar を検証
else path is null
  Rust -> legacy config / colocated jar を自動探索
end
Rust -> spawn_blocking(render sources, resolved runtime)
```

## 10. 影響範囲

### 10.1 Source

- `markdown-viewer-tauri/src/App.tsx`
  - typed settings state、startup load、persistent Theme action、resize listener、Settings dialog。
- `markdown-viewer-tauri/src/App.css`
  - modal backdrop、dialog、form、validation、responsive layout。
- `markdown-viewer-tauri/src-tauri/src/lib.rs`
  - config model / Store methods / commands、window restore、PlantUML resolver integration、unit tests。
- `markdown-viewer-tauri/src-tauri/capabilities/default.json`
  - window API のうち default capability に含まれない権限が必要な場合だけ明示追加する。dialog plugin は既存 permission を再利用する。
- manifest / lock files
  - 新規 package は原則追加しない。既存 Tauri API と dialog plugin で実装する。

### 10.2 Existing behavior

- Recent Folders の最大件数、重複 promotion、削除、missing path error は変更しない。
- `View > Theme` の見える操作は維持し、保存処理だけ追加する。
- 明示 jar path 未設定時の既存 runtime directory 探索を維持する。
- Markdown / Mermaid は PlantUML 設定失敗から独立して表示する。
- Multi-tab の tab cache と Theme による Mermaid 再描画を維持する。
- `TODO-2026-006` の Split view が Phase 3 着手前に完了していることを前提とし、実装時点の pane state を回帰対象へ追加する。

## 11. 恒久ドキュメント更新予定

- `docs/components/tauri_viewer/README.md`: 機能一覧、主要 command、設定保存先。
- `docs/components/tauri_viewer/basic_design.md`: AppConfig / settings model と責務境界。
- `docs/components/tauri_viewer/detail_design.md`: startup、resize、Settings、PlantUML runtime 解決フロー。
- `docs/components/tauri_viewer/interface_spec.md`: MenuBar / dialog UI、command / TypeScript 型、validation。
- `docs/rules/development_workflow.md`: app config の利用方法と `plantuml.config.json` / colocated jar との優先順位。
- `docs/architecture/overview.md`, `code_patterns.md`, `common_pitfalls.md`: 横断的に再利用すべき Store 部分更新、logical size、明示 path の優先順位が生じた場合に必要箇所だけ更新する。
- `README.md`, `markdown-viewer-tauri/README.md`: 利用者導線に Settings の説明が必要な場合だけ追加する。

ADR は Phase 2 時点で追加しない。app config JSON は既存採用方式の拡張であり、Tauri 固有の案件設計として恒久 component docs へ反映できる。Avalonia 水平展開後に両実装共通の判断となった場合、`TODO-2026-012` で ADR 起票要否を再評価する。

## 12. テスト・ユーザー確認

### 12.1 Automated verification

- `npm run build`
- `cargo check`
- `cargo test`
- `cargo fmt -- --check`

Rust unit test:

- Recent Folders だけの旧 JSON が default `viewerSettings` で deserialize される。
- 新 schema の serialize / deserialize で Recent Folders と settings が保持される。
- width / height の最小値・最大値境界と範囲外が区別される。
- Theme enum と jar path validation が typed error になる。
- 明示 jar path がある場合は自動探索へ fallback せず、`None` の場合だけ既存探索を使う。

### 12.2 Manual verification

1. 設定ファイルなしで 800 x 600 / Light / automatic PlantUML として起動する。
2. 通常 window を resize し 500 ms 以上待って終了後、再起動で logical size が復元される。
3. 最大化／fullscreen 中の size が保存されず、通常状態の最終サイズが復元される。
4. `View > Theme` と Settings dialog の両方で Theme を変更し、再起動後に復元される。
5. valid jar を Browse / text input で設定し、`sample_docs/plantuml.md` の Mermaid / PlantUML が描画される。
6. invalid path の Save が dialog 内 error になり、保存済み設定と Markdown / Mermaid 表示が維持される。
7. 保存後に jar を削除した場合、PlantUML は明示エラーになり自動探索へ逃げない。Settings で Clear 後は自動探索へ戻る。
8. Recent Folders を含む旧 `settings.json` で起動し、履歴を保持したまま設定を保存できる。
9. malformed JSON では error strip を表示し、既定 Theme で Markdown / Mermaid を閲覧できるが設定保存で既存ファイルを上書きしない。
10. Settings dialog の keyboard focus、Escape / Cancel、validation alert、狭い window での dialog scroll を確認する。
11. Open Folder、Recent Folders、Reload、tab activate / close、相対画像、内部／外部 link、Mermaid、PlantUML loading / error、Split view を回帰確認する。

## 13. リスクと対策

| リスク | 対策 |
| --- | --- |
| resize event が app config を高頻度更新する | 500 ms debounce と通常状態だけの保存を行う。 |
| resize / settings / Recent Folders が互いの値を上書きする | Store lock 内の read-modify-write と field-specific command を使う。 |
| HiDPI で保存／復元サイズがずれる | physical size を scale factor で logical size に変換し、JSON は logical size に統一する。 |
| 最大化サイズを通常サイズとして保存する | maximized / minimized / fullscreen 中は保存しない。 |
| malformed JSON の保存で Recent Folders を失う | parse error 時は update / write を中止し、自動初期化しない。 |
| 明示 jar path の削除が別 jar へ黙って切り替わる | explicit path がある場合は fallback せずエラーにする。 |
| Dark theme の startup flash | settings load 完了まで軽量 loading state を表示する。 |
| Settings dialog が `App.tsx` を肥大化させる | 初期実装は同 file の typed component とし、設計／実装レビューで責務が独立・再利用可能と判断した場合は `SettingsDialog.tsx` へ分離する。永続化ロジックは App / Rust Store に置き、dialog に I/O を持たせない。 |

## 14. Follow-up

- `TODO-2026-007`: Tauri の Settings 導線、window size 自動保存、Theme／jar path 操作を UX 評価へ含める。
- `TODO-2026-015`: 評価済み仕様を Avalonia の ViewModel / Service / user config JSON へ水平展開する。
- window position、maximized state、session / tab restore が必要になった場合は個別 TODO とし、本 schema へ安易に混在させない。

