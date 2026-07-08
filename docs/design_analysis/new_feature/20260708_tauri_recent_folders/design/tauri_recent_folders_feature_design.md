# Tauri Recent Folders 導入 設計

## 背景・要求・完了条件

`TODO-2026-004 Tauri Recent Folders 導入` は、Tauri 版 Markdown Viewer で最近開いた root directory を保存し、MenuBar の `File` / `Recent Folders` から再オープンできるようにする新機能である。

対象ユーザは、複数のドキュメントフォルダを切り替えながら Markdown を確認する利用者と、アプリ再起動後に直近の作業フォルダへ短い操作で戻りたい利用者である。

完了条件:

- `Recent Folders` はウィンドウ top の MenuBar dropdown として `File` 配下に表示・実行できる。
- `Open Folder` / `Reload` / `Recent Folders` が MenuBar から利用でき、busy 中は重複操作が抑止される。
- root open 成功時に最近開いたディレクトリが app config JSON へ保存される。
- 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。
- 再起動後も一覧が復元される。
- 既存の root path strip、Explorer、Markdown preview、Mermaid、PlantUML、ErrorBanner、StatusBar が退行しない。

## 対象範囲と非対象

対象範囲:

- Tauri / React 版のみ。
- `App.tsx` の MenuBar を、ウィンドウ top の menu name クリックで item を展開する dropdown UI へ変更する。
- `File` menu に `Open Folder...`、`Recent Folders`、`Reload` を表示する。
- `Recent Folders` は最大 10 件とし、最近使ったものを先頭に並べる。
- root open 成功時に recent entry を追加または先頭へ移動する。
- recent entry の削除 UI を `Recent Folders` menu 内に持つ。
- app config JSON の読み書きと path existence validation を Rust command で行う。
- Tauri capability / config に必要な command 権限を追加する。
- 恒久 docs を Tauri Recent Folders 仕様へ同期する。

非対象:

- Multi-tab、split view、Avalonia 版 Recent Folders。
- 最近開いた Markdown file、pin / favorite、drag reorder、履歴検索。
- OS native menu の完全再現。
- app config JSON のユーザ編集 UI。

## 採用案 / 不採用案 / 判断理由

### 採用案: React アプリ内 MenuBar dropdown + Rust app config command

既存 `MenuBar` は React 内にあり、`openFolder`、`reload`、theme toggle、`isBusy` disabled 条件がすべて React state と handler で完結している。Recent Folders も同じ境界に置き、表示と操作を React、永続化と filesystem 検証を Rust command が担当する。

採用理由:

- ユーザ要件の「メニューバーと同じような動作」を満たせる。
- 既存 `MenuBar` / `RootPathBar` / `ErrorBanner` / `StatusBar` の構成を保ったまま拡張できる。
- native menu action から React state へ戻す bridge を新設せず、`isBusy`、`errorMessage`、`rootPath`、`fileTree` の正本を React に保てる。
- `@tauri-apps/api/menu` は project 内 `@tauri-apps/api` 2.11 系に `Menu.setAsAppMenu()` / `Menu.setAsWindowMenu()` を持つが、macOS global menubar では top-level が `Submenu` のみなど platform 差分がある。今回の価値は recent folders であり、native menu parity を主目的にしない。
- Phase 3 の手動確認対象を Tauri app 内 UI に集約できる。

### 不採用案: OS native menu を正本にする

`@tauri-apps/api/menu` の native menu API で `File` / `Recent Folders` を構築し、macOS では app menu、Windows / Linux では window menu として使う案。

不採用理由:

- menu item の有効 / 無効、recent entry 更新、削除 UI、busy state を React state と同期する bridge が必要になる。
- macOS と Windows / Linux で app-wide / window menu の扱いが異なり、今回の最小価値に対して検証範囲が大きい。
- 削除 UI を menu item 内に自然に表現しにくく、React 内 dropdown の方が一覧・削除・empty state を明確にできる。

### 不採用案: localStorage 永続化

browser localStorage に recent folders を保存する案。

不採用理由:

- WBS で localStorage は採用しないと定義済み。
- filesystem path はアプリ設定として Rust 側で JSON 管理した方が、後続 Avalonia 版の user config JSON 方針と比較しやすい。
- path existence validation を Rust command と同じ境界で扱える。

## Before / After

Before:

- `MenuBar` は `File` / `View` group label と常時表示 button の集合で、dropdown を持たない。
- root folder はメモリ上の `rootPath` のみで、アプリ終了後に復元されない。
- Rust command は `scan_directory`、`read_text_file`、`render_plantuml_diagrams` のみで、設定永続化はない。

After:

- `MenuBar` は `File` / `View` menu trigger をウィンドウ top に表示し、クリックで menu item を展開する。
- `File` menu は `Open Folder...`、`Recent Folders`、`Reload` を持つ。
- `Recent Folders` の各 entry を選択すると `loadRoot(path)` を実行する。
- `Open Folder` または Recent Folders から root open に成功した場合、recent entry を更新して app config JSON へ保存する。
- 最近開いたフォルダは再起動後の初期表示時に command から読み込む。ただし自動 open はしない。

## 影響範囲

Frontend:

- `markdown-viewer-tauri/src/App.tsx`
  - `RecentFolderEntry` type を追加する。
  - `recentFolders` state と `activeMenu` state を追加する。
  - 初期 mount で `load_recent_folders` command を呼ぶ。
  - `loadRoot(path, options?)` を root open 成功後の recent 更新に対応させる。
  - `MenuBar` props を recent folders、削除 handler、recent open handler、active menu handler に拡張する。
  - `File` / `View` dropdown menu component を追加する。
- `markdown-viewer-tauri/src/App.css`
  - `.menu-trigger`、`.menu-dropdown`、`.recent-folder-row`、`.recent-folder-remove`、empty state、disabled state を追加する。
  - 既存 app-shell grid row、RootPathBar、ErrorBanner、StatusBar の配置は維持する。

Backend:

- `markdown-viewer-tauri/src-tauri/src/lib.rs`
  - app config JSON schema と command を追加する。
  - `load_recent_folders() -> Result<Vec<RecentFolderEntry>, String>`
  - `save_recent_folders(entries: Vec<RecentFolderEntry>) -> Result<(), String>`
  - `remove_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>`
  - 必要に応じて `validate_recent_folder(path: String) -> Result<String, String>` または `scan_directory` の既存検証を利用する。
- `markdown-viewer-tauri/src-tauri/capabilities/default.json`
  - 追加 command の利用権限を必要に応じて追加する。

Docs:

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- 必要に応じて `docs/history/README.md` と Phase 4 history。

## 設計方針

### UI / 操作導線

MenuBar は `File` / `View` の menu trigger を横並びにする。

`File` menu:

```text
File
- Open Folder...
- Recent Folders
  - <folder name>      <remove button>
  - <folder name>      <remove button>
  - No recent folders  (disabled, empty時)
- Reload
```

`View` menu:

```text
View
- Theme: Light / Theme: Dark
```

操作:

- `File` trigger click で `File` menu を開く。同じ trigger 再クリックで閉じる。
- menu 外 click、Escape、menu item 実行で dropdown を閉じる。
- busy 中は `Open Folder...`、recent entry、`Reload`、theme toggle を disabled にする。
- `Reload` は現行通り `rootPath` がない場合も disabled にする。
- Recent Folders の削除 button は busy 中でも実行可能にするかを避け、busy 中は disabled に統一する。
- 削除 button click は entry open へ伝播しない。
- entry 表示は folder basename を主表示、absolute path を補助表示または `title` にする。basename が取れない場合は path 全体を使う。

アクセシビリティ:

- `header.menu-bar` は既存の `aria-label="Application menu"` を維持する。
- dropdown trigger は `aria-haspopup="menu"`、`aria-expanded` を持つ。
- dropdown container は `role="menu"`、実行 item は `role="menuitem"` とする。
- entry 削除 button は `aria-label="Remove <path> from recent folders"` を持つ。
- 矢印キー移動と roving tabindex は最小範囲では導入しない。既存 button focus と Escape close を優先する。

### データモデル

Frontend:

```ts
type RecentFolderEntry = {
  path: string;
  name: string;
  lastOpenedAt: string;
};
```

Rust:

```rust
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentFolderEntry {
    path: String,
    name: String,
    last_opened_at: String,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    recent_folders: Vec<RecentFolderEntry>,
}
```

`lastOpenedAt` は ISO 8601 風の UTC 文字列ではなく、追加依存を避けるため `SystemTime::now().duration_since(UNIX_EPOCH)` の秒数を decimal string にする案を採る。表示には使わず、将来の並び・デバッグ用 metadata とする。ユーザーに見せる日付フォーマットは今回の対象外。

最大件数:

- `MAX_RECENT_FOLDERS = 10`
- path は Rust 側で canonicalize した absolute path を正本にする。
- 同じ canonical path がある場合は重複追加せず、先頭へ移動して `lastOpenedAt` を更新する。
- 保存時も最大件数へ truncate する。

### 永続化

保存先は Tauri app config directory 配下の JSON とする。

候補 path:

```text
<app_config_dir>/markdown-viewer-tauri/settings.json
```

実装では Tauri `AppHandle` から path resolver を使い、app config directory を取得する。ディレクトリがなければ作成する。設定ファイルがない場合は空 config として扱う。

読み込み:

- JSON file がない場合は `[]` を返す。
- JSON parse に失敗した場合は `Err("Failed to parse app config: ...")` とし、React 側で ErrorBanner に表示する。破損 config を自動上書きする fallback は採らない。
- 読み込み時点では存在しない path を自動削除しない。存在確認は entry 実行時と削除時に扱う。

書き込み:

- parent directory を作成する。
- app config 全体を JSON pretty format で保存する。
- 書き込み失敗は ErrorBanner に表示する。ただし root open 自体は成功済みなので、Explorer / preview は維持する。

### Command 境界

追加 command:

```text
load_recent_folders() -> Result<Vec<RecentFolderEntry>, String>
record_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>
remove_recent_folder(path: String) -> Result<Vec<RecentFolderEntry>, String>
```

`save_recent_folders(entries)` は frontend が list 正本を持つ設計になりやすく、path canonicalization と最大件数の責務が分散するため採用しない。Recent Folders list の正本更新は Rust command に寄せ、React は戻り値を `recentFolders` state に反映する。

`record_recent_folder` は `scan_directory` 成功後に呼ぶ。これにより、存在しない path や directory ではない path は root open 成功扱いにならず、recent list にも入らない。

Recent entry 実行時は `loadRoot(path, { recordRecent: true })` を呼ぶ。path が存在しない場合、既存 `scan_directory` が `Selected path is not a directory.` または canonicalize error を返し、React は ErrorBanner に表示する。recent list からの自動削除はしない。ユーザは削除 button で明示削除する。

### 既存機能との統合

`loadRoot` を root open の単一入口として維持する。

```text
openFolder -> dialog -> loadRoot(selected, { recordRecent: true })
recent item click -> loadRoot(entry.path, { recordRecent: true })
reload -> scan_directory(rootPath) -> loadMarkdown(...)
```

`loadRoot` は `scan_directory` 成功後に `rootPath` / `fileTree` / initial markdown を更新し、その後 `record_recent_folder` を呼んで recent list を更新する。`record_recent_folder` が失敗しても、root open 成功状態は維持し、ErrorBanner に保存失敗を表示する。

initial markdown の読み込みに失敗した場合の扱い:

- `scan_directory` 成功後に initial markdown の `read_text_file` が失敗した場合でも root は開けているため、recent entry は保存対象にする。
- ただし `loadMarkdown` が `isBusy` を見るため、`loadRoot` 内から呼ぶ場合に自分自身の busy state と衝突しないよう、今回も現行と同じく `isMarkdownLoading` は Markdown 読み込み単位でだけ使う。

### 失敗時動作とデフォルト挙動

- 初回起動で config がない: Recent Folders は empty state を表示する。
- config 読み込み失敗: `errorMessage` に表示し、Recent Folders は空配列のままにする。
- recent path が存在しない: `loadRoot` が失敗し、root / fileTree / selected markdown は現在状態を維持する。
- recent 保存失敗: root open は維持し、ErrorBanner に保存失敗を表示する。recent list は古い状態のままにする。
- recent 削除失敗: ErrorBanner に表示し、recent list は古い状態のままにする。
- busy 中の menu item: disabled とし、handler でも early return する。

### 互換性・移行方針

- 既存ユーザには config file が存在しないため、空 recent list から開始する。migration は不要。
- 既存 `rootPath` や selected markdown は自動復元しない。Recent Folders は一覧復元のみを行う。
- 既存 `Open Folder`、`Reload`、theme 操作の handler は維持し、呼び出し位置だけ dropdown item へ移す。
- app config JSON schema は `recentFolders` だけを持つ v1 相当とし、version field は今回追加しない。将来 schema 変更が必要になった時点で versioning を追加する。

## 既存類似ロジックとの抽象化・共通化方針

- `scan_directory` の path canonicalization と directory validation は既存の `normalize_path` を再利用する。
- Rust 側の JSON parse は既存 PlantUML config の `serde_json::from_str` と同じエラーメッセージ方針に合わせる。
- UI は既存 `MenuBar` component を置き換える。別の `NativeMenuBridge` や parallel menu state は作らない。
- path display は既存 `getFileName` を recent entry basename にも再利用する。
- command の list 更新は `record_recent_folder` / `remove_recent_folder` に集約し、frontend に duplicate promotion や truncate ロジックを重複実装しない。

## 拡張ポイントと将来の派生機能への耐性

- `AppConfig` に field を追加できる形にしておき、後続 multi-tab / split view で session restore が必要になっても同じ app config JSON に追加できる。
- `RecentFolderEntry` は `lastOpenedAt` を持つため、将来 sorting や表示情報追加がしやすい。
- UI の dropdown menu は `File` / `View` の trigger + panel 構造にし、後続 TODO-2026-005 で `Close Tab` / `Close Other Tabs` を追加しやすくする。
- Recent Folders の pin / favorite は今回入れないが、entry row を `path` 正本にしているため後続で `pinned` field を足せる。

## 恒久ドキュメント更新予定先

Phase 3 で以下を更新する。

- `docs/components/tauri_viewer/README.md`
  - Recent Folders の責務、追加 command、config JSON を追記。
- `docs/components/tauri_viewer/basic_design.md`
  - React / Rust 責務、データモデル、依存方向、コンポーネント図を更新。
- `docs/components/tauri_viewer/detail_design.md`
  - MenuBar dropdown、Recent Folders state、app config JSON、失敗時動作を追記。
- `docs/components/tauri_viewer/interface_spec.md`
  - `File` menu 操作、recent entry / delete UI、追加 Tauri command を追記。

Phase 4 で必要に応じて以下を更新する。

- `docs/history/README.md`
- `docs/history/tauri_recent_folders_2026-07-08.md`
- `docs/todo/todo.md` / `docs/todo/todo_archive_2026.md`

## テスト・ユーザ確認観点

自動 / build checks:

- `npm run build` in `markdown-viewer-tauri/`
- `cargo check` in `markdown-viewer-tauri/src-tauri/`
- `git diff --check`

手動確認:

- `Open Folder...` から folder を開くと Recent Folders に追加される。
- 同じ folder を再度開くと重複せず先頭に移動する。
- 11 件以上開くと最大 10 件に丸められる。
- Recent Folders entry クリックで root / Explorer / initial markdown が再オープンされる。
- Recent Folders entry の削除 button で一覧から消え、再起動後も消えたままになる。
- 存在しない path の entry をクリックした場合、ErrorBanner に代表 error が出て現在の root は維持される。
- アプリ再起動後に Recent Folders 一覧が復元される。
- busy 中は Open Folder / Recent Folders / Reload / Theme が重複実行されない。
- 既存確認: Markdown preview、Mermaid、PlantUML loading / success / error、相対画像、Markdown 内リンク、RootPathBar、StatusBar。

## リスクと follow-up

| リスク | 対応 |
| --- | --- |
| Tauri app config directory の取得 API が platform で失敗する | command で明示 error を返し、ErrorBanner に表示する。config が読めなくても viewer 本体は利用可能にする。 |
| React dropdown が MenuBar として期待される keyboard 操作を完全には満たさない | Phase 2 では矢印キー移動を非対象と明記し、Escape close と button focus を提供する。必要なら follow-up TODO 化する。 |
| config JSON 破損時に recent list が使えない | 自動上書きせず error 表示する。手動復旧が必要な既知制約として docs に残す。 |
| native menu を採用しないことへの UX 差 | ユーザ要件で同等動作の window-top UI が許容済み。Phase 4 UX 評価で問題が出た場合、TODO-2026-007 で Avalonia 反映前に再評価する。 |
| app config JSON に絶対 path が残る | Recent Folders の機能上必要な情報として扱う。外部送信はしない。 |

Follow-up 候補:

- 矢印キー移動、typeahead、roving tabindex を持つ厳密な menubar accessibility。
- Recent Folders の pin / favorite。
- session restore と連動した最後の root 自動 open。
- OS native menu 再検討。Tauri / React state bridge を必要とするため、今回の実装完了後の UX 評価結果に基づいて判断する。
