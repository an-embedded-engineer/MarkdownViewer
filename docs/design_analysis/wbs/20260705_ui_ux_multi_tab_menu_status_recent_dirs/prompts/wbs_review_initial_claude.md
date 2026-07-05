あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: wbs-planning
review kind: WBS planning review
topic: UI/UX improvements WBS: multi-tab, menu bar, status bar, recent directories
issue dir: docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs
review target commit: 8cd0e16

以下の WBS 成果物と todo 追跡項目をレビューしてください。

- docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/meta.md
- docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md
- docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md
- docs/todo/todo.md

参照元:

- docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md
- docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/ui_ux_multi_tab_menu_status_recent_dirs_report_review.md
- /Users/shin/.agents/skills/wbs-planning-workflow/SKILL.md

レビュー結果は以下のファイルに作成してください。

- docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/ui_ux_multi_tab_menu_status_recent_dirs_wbs_review.md

レビュー観点:
- WBS workflow の必須チェックを満たしているか。
- 各 work package が通常 workflow 1 回で完了できる粒度か。
- 各 work package に推奨 workflow、依存、目的、完了条件、変更対象、docs 更新先、検証観点が揃っているか。
- Tauri 先行、Avalonia 後追いの判断が妥当か。
- `docs/todo/todo.md` の TODO と `wbs.md` の WP 対応、依存順序、workflow 種別に矛盾がないか。
- 調査レポートの承認済み方針と矛盾していないか。
- 次に `TODO-2026-001` を通常 workflow へ引き継げるか。

レビュー文書には、少なくとも以下を含めてください。

- 総評
- 指摘一覧（重大度、対象箇所、理由、推奨対応）
- 未解決事項
- 承認可否

レビュー文書を作成・更新したら、必ずコミットまで実施してください。
