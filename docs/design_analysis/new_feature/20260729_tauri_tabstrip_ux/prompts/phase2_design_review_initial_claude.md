あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- レビュー文書以外の設計書・ソースコードは変更しないでください。指摘への対応は実装担当 Agent が行います。

workflow: new-feature
review kind: Phase 2 design review
tracking file: `docs/todo/todo.md`
issue directory: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/`
review target commit: `affc977`

`TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善` のPhase 2設計レビューをお願いします。

主なレビュー対象:

- `docs/todo/todo.md` の `TODO-2026-026`
- `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/meta.md`
- `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/design/tauri_tabstrip_ux_feature_design.md`
- 現行実装の `markdown-viewer-tauri/src/App.tsx`
- 現行実装の `markdown-viewer-tauri/src/App.css`
- `markdown-viewer-tauri/src/splitView.ts` / `splitView.test.ts`
- `markdown-viewer-tauri/src/paneRuntime.ts` / `paneRuntime.test.ts`
- `docs/components/tauri_viewer/`、`docs/architecture/`、`docs/rules/development_workflow.md`

レビュー観点:

- `ai-review-response-workflow/references/procedure/review_checkpoints.md`相当のreview checkpoints。
- new-feature Phase 2のユーザ価値、操作導線、最小提供範囲、非対象、統合点、責務分割、拡張性、失敗時動作、恒久docs、検証、リスクの完全性。
- TODO-2026-026の全受け入れ条件が設計へ追跡可能か。
- 40px固定高、上端indicator、Light / Dark、`prefers-reduced-motion`、accessible name / `aria-busy`が状態の組み合わせで矛盾しないか。
- horizontal scrollbarの可視性とgeometry固定、tab item全体を対象にしたmanual revealがWebKit / Firefox系WebViewおよび狭幅で成立するか。
- Pointer Events + pointer capture、6px threshold、`elementFromPoint` drop判定、click抑止、Escape / pointercancel / lostpointercapture / unmount cleanupがReact event lifecycle上実装可能か。
- App / TabStrip / `tabStrip.ts` / `paneRuntime.ts` / `splitView.ts`の責務配置が既存設計に整合し、mutable module-global state、重複transition、不要fallbackを増やさないか。
- pointermoveのperformance、source / destination focus、non-active tab、destination同一ID、source最後のtab、split解除・root reset・tab closeの境界条件が閉じているか。
- keyboard / assistive technology向けmove buttonが正規代替導線として維持され、deprecated drag ARIAに依存しないか。
- unit testと手動matrixがDOM lifecycle、CSS / scrollbar実装差、HTML iframe、Markdown / Mermaid / PlantUML回帰を十分に補完するか。
- ADR追加不要判断と恒久ドキュメント更新予定が妥当か。

レビュー結果は次の文書へ反映し、レビュー担当として1コミットにまとめてください。

`docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/review/tauri_tabstrip_ux_design_review.md`

文書には各指摘のseverity、blocking / non-blocking、根拠、推奨対応、未解決件数、Phase 3へ進めるかの結論を明記してください。指摘がない場合も、確認済み観点と承認結果を記録してください。
