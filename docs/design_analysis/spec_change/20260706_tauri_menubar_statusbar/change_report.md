# Tauri MenuBar / StatusBar 導入 変更レポート

## 対象

- TODO: `TODO-2026-003 Tauri MenuBar / StatusBar 導入`
- Branch: `spec-change/tauri-menubar-statusbar`
- Base branch: `main`
- Base commit: `a209fc24d805c15302902515a782448ec6461c92`
- Report commit range: `a209fc2..5f027b5`
- 作成日: 2026-07-07

## 変更概要

Tauri 版の既存 Toolbar に集約されていた操作と状態表示を、後続の Recent Folders / multi-tab / split view 導入に備えて分離した。

- `Toolbar` を廃止し、React アプリ内 `MenuBar` / `RootPathBar` / `ErrorBanner` / `StatusBar` へ分割した。
- `Open Folder` / `Reload` / theme toggle を MenuBar の常時表示ボタンへ移した。
- root path は MenuBar 直下、active file と loading state は StatusBar、代表 error は StatusBar 直上の error strip に表示する構成へ変更した。
- StatusBar / ErrorBanner の live region を分け、loading は `aria-live="polite"`、error は `role="alert"` で通知する。
- アプリ全体の縦スクロールを抑止し、Explorer / Preview pane 内スクロールに限定した。
- `ErrorBanner` の条件付き描画で StatusBar の位置が変わらないよう、grid row を明示した。

## Tauri 変更

- `src/App.tsx`
  - `MenuBar`、`RootPathBar`、`ErrorBanner`、`StatusBar`、`StatusBarItem` を追加した。
  - 既存 `openFolder`、`reload`、theme toggle、`isBusy` disabled 条件を新 UI へ引き継いだ。
  - preview pane 上部の代表 loading / error banner を削除し、PlantUML 図単位の inline pending / error 表示は維持した。
- `src/App.css`
  - `app-shell` を MenuBar / RootPathBar / workspace / ErrorBanner / StatusBar の grid に変更した。
  - MenuBar / root path strip / error strip / StatusBar の style を追加した。
  - `html` / `body` / `#root` / `.app-shell` / `.workspace` の overflow を抑止し、Explorer / Preview pane 内スクロールに限定した。
  - chrome 要素の `grid-row` を明示し、エラー有無で StatusBar 下に余白が出ないようにした。

## ドキュメント

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/`

上記を MenuBar / RootPathBar / ErrorBanner / StatusBar 構成へ同期した。

## レビュー

- Phase 2 design review:
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_design_review.md`
  - 初回は条件付き承認。
  - MenuBar の操作モデルと StatusBar の aria-live 方針を明確化し、follow-up review で承認。
- Phase 3 implementation review:
  - `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_impl_review.md`
  - 初回は条件付き承認。
  - 狭幅時の root 表示と command grouping の指摘へ対応し、follow-up review で承認。

## Phase 4-a ユーザー確認

ユーザーは publish 済みアプリで次を確認した。

- root path と Error 表示が期待通りになること。
- 右端のアプリ全体スクロールバーが消えること。
- エラーなし時の StatusBar 下余白が消え、エラー有無で StatusBar の位置が不自然に変わらないこと。

追加フィードバックとして、React アプリ内 MenuBar が OS native menu と異なる点が挙がった。Tauri v2 の `@tauri-apps/api/menu` には native menu API があるため、TODO-2026-004 `Tauri Recent Folders 導入` の scope に OS native menu / platform 差分 / React state 連携の設計を追記した。

## 検証結果

自動 / コマンド検証:

- `npm run build` in `markdown-viewer-tauri/`: 成功。Vite の chunk size warning のみ。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。
- `git diff --check`: 成功。

ユーザー確認:

- Phase 4-a の publish 動作確認で、追加調整後の root path / Error / スクロール / StatusBar 位置が期待通りであることを確認済み。

## 生成物

- `diff.zip`: `a209fc2..5f027b5` の差分 patch を zip 化したもの。

## 既知制約 / follow-up

- OS native menu は TODO-2026-003 の non-scope とし、TODO-2026-004 で扱う。
- Recent Folders、multi-tab、split view は後続 TODO で扱う。
- Avalonia 版の MenuBar / StatusBar 導入は TODO-2026-008 以降で扱う。
