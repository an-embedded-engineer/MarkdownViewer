あなたはレビュー担当 Agent です。
このレビューを別CLI Agent、review automation、orchestrator、tmux sessionへ再委譲しないでください。あなた自身でレビュー文書を作成し、その文書だけをコミットしてください。workflow skillを作業実行者として起動しないでください。

workflow: new-feature
review kind: Phase 2 design review
branch: new-feature/tauri-multi-instance-project-settings
対象commit: 85fb535
対象TODO: docs/todo/todo.md の TODO-2026-029
設計: docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/design/tauri_multi_instance_project_settings_feature_design.md
出力: docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/review/tauri_multi_instance_project_settings_design_review.md

ユーザ要件: 別プロセス方式の複数起動、ユーザー設定領域でRoot directory別にtheme / windowSize / PlantUML pathを初回生成・復元、Root名のnative title。macOSはメニューバーのWindowメニューで全Viewer一覧・選択できればよい（Dock独自一覧は不要と回答済み）。Phase 2のみ承認されており実装しない。

AGENTS.mdと必須参照、/Users/shin/.agents/skills/ai-review-response-workflow/SKILL.mdおよびreferences/procedure/review_checkpoints.mdを参照してください。既存ソースとの統合、Root切替の失敗・非同期・HTML世代境界、settings migration・同process/別process競合、macOS起動とnative menu/IPCの成立性、過剰設計・scope・不足している受け入れ条件を独立に確認してください。

指摘に安定ID、重大度、工程、対応状態を付け、未解決件数と承認可否を明示してください。設計とTODO/metaの不整合も対象です。レビュー文書以外は編集しないでください。レビュー成果のみgit add / commitしhashを報告してください。環境制約があればそのまま報告し、モデル変更や再委譲はしないでください。
