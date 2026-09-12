あなたはレビュー担当Agentです。再委譲・別CLI・orchestrator・workflow実装者としての実行はしないでください。あなた自身でPhase 3実装レビューを行い、レビュー文書だけを作成・コミットしてください。

workflow: new-feature
review kind: Phase 3 implementation and permanent docs review
TODO: TODO-2026-029
branch: new-feature/tauri-multi-instance-project-settings
対象commit: 78039cd
差分base: 75a7ac7
設計: docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/design/tauri_multi_instance_project_settings_feature_design.md
実装記録: docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/impl/tauri_multi_instance_project_settings_impl.md
出力: docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/review/tauri_multi_instance_project_settings_impl_review.md

AGENTS.mdとai-review-response-workflowのreview checkpointsに従ってください。
重点: Root/設定のcontextとsnapshot原子性、project初期化/migration/排他/field patch、frontend保存queueとresize、macOS native menu/IPC/activation/終了、既存HTML境界・PlantUML回帰、恒久docsの整合。

Phase 3冒頭spikeは実施済みです。yieldだけの経路は失敗、requesterのactivateFromApplicationを追加した経路でmacOS 26.6.2の通常68ms・最小化647ms・別Space fullscreen401msでkey/active/onActiveSpaceを確認。impl/activation_spikeに失敗・成功双方のJSONがあります。本体は明示handoff経路だけを採用しています。

検証済み: npm run build、Vitest117件、cargo check、cargo fmt -- --check、cargo test31件（実child process競合を含む）、Tauri release app bundle build。
未確認: 製品UIの全手動matrix、Windows固有build/UI、Linux UI、macOS14未満、App Translocation、NFC/NFD identity。未確認を成功扱いにせず記録済みです。ユーザPhase4確認は未承認で実施していません。

指摘には安定ID・重大度・blocking・工程・状態を付け、未解決件数と承認可否を明示してください。コード・設計・metaは変更しないでください。レビュー文書のみ編集し、git add / commitしてhashを報告してください。必要な追跡課題・確認不足は具体的に指摘してください。可能ならレビュー文書更新はまとめて1回の編集にしてください。
