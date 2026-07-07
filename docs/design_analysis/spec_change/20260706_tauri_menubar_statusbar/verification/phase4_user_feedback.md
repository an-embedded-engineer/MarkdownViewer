# Phase 4-a publish 動作確認フィードバック

## 確認日

2026-07-07

## ユーザ確認結果

publish 後のアプリ動作確認で次のフィードバックを受けた。

1. React アプリ内 MenuBar が Windows / macOS の OS 標準 menu bar と異なる。
2. StatusBar 内の `Error` / `Root` など長いテキストが見切れる。
3. 右端に MenuBar から StatusBar までまたがる全体スクロールバーが常時表示される。
4. エラーなし時に StatusBar の下に 1 行分の余白が表示され、エラー表示時だけ余白が消える。

## 判断

### 1. OS native menu

Tauri v2 の local API 型定義では `@tauri-apps/api/menu` に `Menu.setAsAppMenu()` / `Menu.setAsWindowMenu()` があり、OS native menu は技術的に検討可能である。

ただし TODO-2026-003 は Phase 0 から OS native menu を non-scope としており、native menu へ移す場合は次の設計が必要になる。

- macOS の app-wide menu と Windows / Linux の window menu の差分整理。
- native menu action から React 側 `openFolder` / `reload` / theme toggle / future recent folders へ接続する event / command bridge。
- `isBusy`、`rootPath`、Recent Folders 一覧などの disabled / dynamic state 同期。

そのため TODO-2026-003 では実装せず、TODO-2026-004 `Tauri Recent Folders 導入` の scope / completion に native menu 検討を追記した。

### 2. 長い Root / Error 表示

StatusBar に root path / active file / loading / error を集約すると、publish 確認時に長文が見切れやすいことが分かった。これは TODO-2026-003 の UI 表示調整として小さく対応できるため、Phase 4-a feedback 対応として実装した。

対応内容:

- `RootPathBar` を MenuBar 直下に追加し、root path を常時表示する。
- `ErrorBanner` を StatusBar 直上に追加し、代表 error がある場合だけ薄い赤背景で表示する。
- `StatusBar` は `State` / `File` に絞る。
- `RootPathBar` / `ErrorBanner` / `StatusBar` は既存 state (`rootPath` / `errorMessage` / `selectedFileName` / `loadingMessage`) から派生表示し、追加 state は持たない。
- `State` の値だけ `aria-live="polite"` とし、代表 error は `ErrorBanner` の `role="alert"` で通知する。

### 3. 全体スクロールバー

Explorer / Preview pane はそれぞれ独立してスクロールできるため、アプリ外枠に全体スクロールバーが出る必要はない。全体スクロールバーは MenuBar / RootPathBar / ErrorBanner / StatusBar を含む chrome 領域までスクロール対象に見せてしまうため、Phase 4-a feedback 対応として CSS を調整した。

対応内容:

- `html` / `body` / `#root` に `overflow: hidden` を指定し、WebView 全体の縦スクロールを抑止する。
- `.app-shell` / `.workspace` に `min-height: 0` / `overflow: hidden` を指定し、grid 子要素の overflow を外側へ逃がさない。
- `.explorer-pane` / `.preview-pane` の `overflow: auto` は維持し、スクロール責務を pane 内に限定する。

### 4. StatusBar 下余白

`ErrorBanner` はエラー発生時だけ描画されるため、CSS grid の自動配置に任せると、エラーなし時に `StatusBar` が error strip 用の 4 行目へ詰められ、最下段の 5 行目 `30px` が空行として残る。Phase 4-a feedback 対応として、各 chrome 要素の grid row を明示し、エラー有無に関係なく `StatusBar` を常に 5 行目へ固定した。

対応内容:

- `.menu-bar`、`.root-path-bar`、`.workspace`、`.error-strip`、`.status-bar` に `grid-row` を明示する。
- エラーなし時は error strip 用の 4 行目を空の `auto` 行として 0px にし、下部に余白を残さない。
- エラー表示時は `ErrorBanner` が 4 行目に入り、`StatusBar` は引き続き最下段に表示する。

## 検証

| コマンド | 結果 |
| --- | --- |
| `npm run build` (`markdown-viewer-tauri/`) | 成功。Vite の chunk size warning のみ。 |
| `cargo check` (`markdown-viewer-tauri/src-tauri/`) | 成功。 |
| `git diff --check` | 成功。 |

## 再確認依頼

Phase 4-a のユーザ動作確認として、publish 済みアプリまたは再 publish 後のアプリで次を確認する。

- MenuBar 直下に root path が表示され、長い path は省略表示でも `title` で確認できる。
- エラー発生時のみ StatusBar 直上に薄い赤背景の error strip が表示される。
- StatusBar には `State` / `File` が表示される。
- 右端にアプリ全体のスクロールバーが常時表示されず、Explorer / Preview pane それぞれのスクロールバーだけが表示される。
- エラーなし時も StatusBar の下に 1 行分の余白が残らず、エラー有無で StatusBar の高さと位置が不自然に変わらない。
- Open Folder / Reload / Theme / Markdown preview / Mermaid / PlantUML / 相対画像 / 相対 Markdown リンクが退行していない。
