# Tauri MenuBar / StatusBar 導入 実装記録

## 対象

- TODO: `TODO-2026-003 Tauri MenuBar / StatusBar 導入`
- 設計: [design/tauri_menubar_statusbar_design.md](../design/tauri_menubar_statusbar_design.md)
- レビュー: [review/tauri_menubar_statusbar_design_review.md](../review/tauri_menubar_statusbar_design_review.md)

## 設計差分と実装差分

| 設計項目 | 実装内容 |
| --- | --- |
| Toolbar を MenuBar / StatusBar へ分離 | `markdown-viewer-tauri/src/App.tsx` の `Toolbar` を削除し、`MenuBar` と `StatusBar` を追加した。 |
| MenuBar は常時表示ボタン群 | `File` / `View` のグループラベルと通常の `button` で構成し、ドロップダウン、`role="menubar"` / `role="menuitem"`、矢印キー移動、フォーカストラップは導入していない。各 command group は `role="group"` で支援技術向けの grouping を明示する。 |
| 既存操作の維持 | `openFolder`、`reload`、theme toggle の handler と disabled 条件を既存 state からそのまま渡している。 |
| root / active file / loading / error の表示分離 | Phase 4 feedback を受け、`RootPathBar` が `rootPath`、`StatusBar` が `selectedFileName` / `loadingMessage`、`ErrorBanner` が `errorMessage` を表示する構成に変更した。 |
| live region の分割 | `StatusBarItem` で `State` の値だけ `aria-live="polite"` を付与し、`File` は live region に含めていない。代表 error は `ErrorBanner` の `role="alert"` で通知する。 |
| 長文表示 | root path は MenuBar 直下の `RootPathBar`、代表 error は StatusBar 直上の `ErrorBanner` に移し、各値は ellipsis と `title` で全文確認できる。 |
| Preview 上部 banner の撤去 | preview pane 上部の sticky banner は復活させず、代表 error は app-shell 下部の `ErrorBanner`、loading は StatusBar の `State` に表示する。PlantUML 図単位の `.plantuml-loading` / `.plantuml-error` は維持した。 |

## 変更ファイル

| ファイル | 変更内容 |
| --- | --- |
| `markdown-viewer-tauri/src/App.tsx` | `MenuBar`、`RootPathBar`、`ErrorBanner`、`StatusBar`、`StatusBarItem` を追加。既存 Toolbar と preview banner を削除。 |
| `markdown-viewer-tauri/src/App.css` | `app-shell` を MenuBar / RootPathBar / workspace / ErrorBanner / StatusBar レイアウトへ変更。`menu-bar` / `menu-group` / `root-path-bar` / `error-strip` / `status-bar` / `status-item` スタイルを追加し、旧 toolbar/path-display/banner スタイルを削除。 |
| `docs/components/tauri_viewer/README.md` | 主要要素と責務を MenuBar / StatusBar 分離後の構成へ更新。 |
| `docs/components/tauri_viewer/basic_design.md` | React 責務、コンポーネント図、状態モデルを MenuBar / StatusBar 構成へ更新。 |
| `docs/components/tauri_viewer/detail_design.md` | 状態管理、モジュール図、再描画方針、エラーハンドリング、UI レイアウトを更新。 |
| `docs/components/tauri_viewer/interface_spec.md` | MenuBar 操作と StatusBar 表示契約を追記。 |

## 互換性

- Tauri command、Rust backend、capability、保存データ形式は変更していない。
- Markdown rendering、Mermaid rendering、PlantUML rendering、相対画像、リンク遷移の処理関数は変更していない。
- `isBusy` による重複操作抑止は MenuBar / Explorer に引き継いだ。
- 旧 Toolbar と preview 上部代表 banner は削除し、操作は MenuBar、root path は RootPathBar、代表 error は ErrorBanner、active file / loading は StatusBar へ分離した。

## 恒久ドキュメント反映

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`

`docs/architecture/` は Toolbar への直接参照がなく、今回の詳細 UI 構成名変更を横断判断として扱う必要もないため更新していない。ADR 追加も不要。

## 検証結果

| コマンド | 結果 |
| --- | --- |
| `npm run build` (`markdown-viewer-tauri/`) | 成功。Vite の chunk size warning のみ。 |
| `cargo check` (`markdown-viewer-tauri/src-tauri/`) | 成功。 |

Phase 3 実装レビューの follow-up 修正後にも同じ検証を再実行し、いずれも成功した。`npm run build` は Vite の chunk size warning のみ、`cargo check` は `dev` profile の check 成功。

Phase 4-a の publish 動作確認フィードバック対応後にも同じ検証を再実行する。

## 手動確認予定

Phase 4-a のユーザ動作確認で次を確認する。

- Open Folder が MenuBar から実行でき、Explorer と初期 Markdown が表示される。
- Reload が MenuBar から実行でき、同一 Markdown でも Mermaid / PlantUML が再描画される。
- Theme toggle が MenuBar から実行でき、Light / Dark が切り替わる。
- RootPathBar に root path、StatusBar に active file が表示される。
- 長い root path は RootPathBar の ellipsis と `title` で確認できる。
- Markdown 読み込み中または PlantUML 描画中に StatusBar が loading 状態を表示する。
- エラー発生時に StatusBar 直上の ErrorBanner が代表 error を表示する。
- `sample_docs/plantuml.md` で Mermaid と PlantUML が同居して表示される。
- 相対画像と相対 Markdown リンク遷移が維持される。

## 未解決事項

- Phase 3 実装レビューの中優先度指摘 1.1 は、狭幅時も `Root` を非表示にせず ellipsis 表示へ変更して対応済み。
- Phase 3 実装レビューの低優先度改善 3.1 は、`menu-group` に `role="group"` を付与して対応済み。
- Phase 4-a の publish 動作確認で、長い root path / error が StatusBar 内で見切れる点を確認したため、root path は RootPathBar、representative error は ErrorBanner へ移して対応した。
- OS native menu は `@tauri-apps/api/menu` の `Menu.setAsAppMenu()` / `setAsWindowMenu()` で技術的に検討可能だが、TODO-2026-003 の non-scope のため TODO-2026-004 に追記して扱う。
- ユーザ操作を伴う visual / manual 確認は Phase 4-a で実施する。
