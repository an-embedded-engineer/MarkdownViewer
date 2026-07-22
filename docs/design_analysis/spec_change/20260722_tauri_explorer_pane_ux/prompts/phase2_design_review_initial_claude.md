あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- 設計書、meta、TODO、source codeは変更せず、レビュー結果だけを指定review文書へ記録してください。
- review文書は日本語で作成し、各指摘へseverity、根拠、推奨対応、open / resolvedの状態を明記してください。

workflow: spec-change
review kind: Phase 2 design review
tracking file: `docs/todo/todo.md`
item: `TODO-2026-019 Tauri Explorer ツリーペイン UX 改善`
issue dir: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/`
review target commit: `c1038c9`
design document: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/design/tauri_explorer_pane_ux_design.md`
review output: `docs/design_analysis/spec_change/20260722_tauri_explorer_pane_ux/review/tauri_explorer_pane_ux_design_review.md`

上記commitからTODO、meta、設計書、現行のTauri frontend sourceと恒久documentを取得してレビューしてください。

レビュー観点は `ai-review-response-workflow/references/procedure/review_checkpoints.md` 相当のcheckpointsと、spec-change Phase 2の観点に従ってください。特に次を確認してください。

1. 幅の初期値・最小値・dynamic max・極端な狭幅の契約が矛盾せず実装可能か。
2. pointer capture、pointer cancel、ResizeObserver、keyboard separator、ARIA値の設計に欠落がないか。
3. treeの`max-content` / `min-width: 100%`とscroll viewport分離で、必要時だけ水平scrollできるか。
4. disclosureとinline SVG iconの分離、accessible name、Light / Dark、既存disabled / selectionとの整合があるか。
5. `explorerPane.ts`のpure policy分離が過剰抽象化でも重複実装でもなく、unit test境界が妥当か。
6. 既存app shell / Preview / HTML iframe / tab / root操作への回帰観点と恒久document更新先が十分か。
7. Avalonia後続TODOとの責務境界、幅永続化を非対象とする判断が追跡可能か。

レビュー文書には総合結論を`approved`、`conditionally approved`、`changes requested`のいずれかで明記し、未解決指摘数を記録してください。

レビュー結果を指定review文書へ保存し、review文書だけを1つのreviewer commitとしてコミットしてください。コミット後、commit hashと結論を回答してください。
