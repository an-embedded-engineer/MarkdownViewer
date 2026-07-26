あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- レビュー文書以外の設計・実装・テスト・恒久ドキュメントは変更しないでください。

workflow: new-feature
review kind: Phase 3 implementation and permanent-docs review
tracking file: `docs/todo/todo.md`
issue: `TODO-2026-006 Tauri Split view 導入`
issue directory: `docs/design_analysis/new_feature/20260726_tauri_split_view`
design document: `docs/design_analysis/new_feature/20260726_tauri_split_view/design/tauri_split_view_feature_design.md`
implementation record: `docs/design_analysis/new_feature/20260726_tauri_split_view/impl/tauri_split_view_feature_impl.md`
design review: `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_design_review.md`
review output: `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_impl_review.md`
review target commit: `810f0c3`

上記コミットから必要な差分と更新後ファイル全体を確認し、Phase 3実装・恒久ドキュメントレビューを実施してください。

レビュー観点:
- `ai-review-response-workflow/references/procedure/review_checkpoints.md`相当のcheckpoints。
- `new-feature-workflow` Phase 3のユーザ価値、設計整合、既存機能統合、責務分割、型安全性、不要な互換経路 / fallbackの排除、テスト、恒久docsの完全性。
- `TODO-2026-006`受け入れ条件と設計書第7〜19節が、実装・tests・docsへ追跡可能か。
- 旧global `activeTabId` / `pendingNavigation`が残らず、single / splitの両方が`SplitViewState`と`DocumentPane`の単一路線になっているか。
- `splitView.ts`のenable / disable、empty secondary、両pane未選択fallback、close adjacent、root reset、pending consume、ratio validation、狭幅min=max、requested ratio復元が設計どおりか。
- Explorer open、Reload、relative Markdown link / anchor、tab close、root変更、StatusBar / ErrorBannerがactive paneまたは発生元paneへ正しくroutingされ、stale closureやReact batchingで破綻しないか。
- `paneRuntime.ts`のpane / tab / revision / split mode guardとshared / pane-local TabStrip state合成が、同一tab両pane、Reload、close、split offで混線しないか。
- `DocumentPane`のeffect lifecycleがReact StrictMode、tab / revision / theme切替、unmountでlistener / adapter / taskをcleanupし、stale結果や無限再実行を起こさないか。
- App所有Mermaid queueと`mermaid.render`のpane-scoped ID具体化が、global initialize競合、SVG ID衝突、source復元、image viewer decorationを防ぎ、`securityLevel: strict`を維持するか。
- HTML iframeごとのready / timeout / duplicate guard、`event.source` / opaque origin / tab / revision / activation / scheme判定がpane間で混線せず、active pane条件をsecurity境界へ加えていないか。
- image viewerのpane identity、DOM切断、tab / revision変更、split off、focus returnがsecondary unmountを含め安全か。
- split grid、計測前50/50、計測後separator ARIA、pointer capture、keyboard操作、active pane表示、pane-scoped ID / IDREF、roving focusが成立するか。
- Markdown pane-relative width、viewport 760px gutter、TabStrip overflow、HTML iframe width、Explorer separatorの既存契約が退行していないか。
- frontend 70 tests、Rust 22 testsの内容が主要pure policyと既存security / image / Explorer回帰を十分に検証し、手動確認へ残す範囲が明示されているか。
- README、component docs、architecture docs、development workflow、implementation record、metaが実装と一致するか。
- Rust command、custom protocol、capability、CSP、settings schemaが不要に変更されていないか。

検証済みコマンド:
- `cd markdown-viewer-tauri && npm test -- --run`（5 files / 70 tests passed）
- `cd markdown-viewer-tauri && npm run build`（成功、既存large chunk warningのみ）
- `cd markdown-viewer-tauri/src-tauri && cargo check`（成功）
- `cd markdown-viewer-tauri/src-tauri && cargo test`（22 tests passed）
- `git diff --check`（成功）

指摘は重大度、対象工程、根拠、推奨対応、statusを明示してください。受け入れ条件トレースと検証評価を含め、未解決指摘が0件なら承認を明記してください。
レビュー結果は指定したreview文書へ保存し、review文書だけをコミットしてください。
