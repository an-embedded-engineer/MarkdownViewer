あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: spec-change
review kind: Phase impl review
issue directory: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar`
issue id/title: `TODO-2026-003 Tauri MenuBar / StatusBar 導入`

Phase 3 実装・恒久ドキュメント反映レビューをお願いします。

レビュー対象コミット:

- `61e4cd6 feat: add Tauri menu bar and status bar`

主なレビュー対象:

- `markdown-viewer-tauri/src/App.tsx`
- `markdown-viewer-tauri/src/App.css`
- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/design/tauri_menubar_statusbar_design.md`
- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/impl/tauri_menubar_statusbar_impl.md`
- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/meta.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/todo/todo.md`

実行済み検証:

- `npm run build` in `markdown-viewer-tauri/`: 成功。Vite の chunk size warning のみ。
- `cargo check` in `markdown-viewer-tauri/src-tauri/`: 成功。

レビュー観点:

- Phase 2 承認済み設計通り、Toolbar が React アプリ内の常時表示 MenuBar と下部 StatusBar に分離されているか。
- MenuBar が常時表示ボタン群であり、ドロップダウン、`role="menubar"` / `role="menuitem"`、矢印キー移動、フォーカストラップを導入していないか。
- `Open Folder` / `Reload` / theme の handler と disabled 条件が既存仕様から退行していないか。
- StatusBar が root path、active file、loading state、代表 error を表示しているか。
- `State` / `Error` の値だけ `aria-live="polite"` で、`Root` / `File` が live region に含まれていないか。
- 狭幅時の表示優先度が `Error`、`State`、`File`、`Root` の順になっているか。
- 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移の処理経路に不要な変更が入っていないか。
- 恒久ドキュメントと impl 記録が実装と一致しているか。
- 不要な互換レイヤー、フォールバック、重複 state が追加されていないか。

レビュー結果は次の文書に反映してください。

- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_impl_review.md`

レビュー文書には、少なくとも以下を含めてください。

- 結論（承認 / 条件付き承認 / 要修正）
- 指摘一覧（重大度、対象ファイル、内容、推奨対応）
- 受け入れ条件トレース確認
- 検証結果確認
- 残リスク / Phase 4 での注意点

レビュー文書の作成後、コミットまで実施してください。
