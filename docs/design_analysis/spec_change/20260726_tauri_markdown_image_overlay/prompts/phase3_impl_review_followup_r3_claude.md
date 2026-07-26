Phase 4-a追加レビューのLow 2件（9.3.1 / 9.3.2）を修正しました。同じレビュー担当としてfollow-up確認してください。

重要:

- 別Agent、review automation skill、orchestrator、別tmux sessionへ再委譲しないでください。
- 既存レビュー文書の9章を更新し、各status、未解決件数、Phase 4-aユーザー再確認可否を確定してコミットしてください。

対象レビュー文書:

`docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_impl_review.md`

対応内容は同文書§9.5へ記録しています。

- 9.3.1: `.markdown-body:focus { outline: none }`を追加。これは`tabIndex={-1}`のprogrammatic focus専用受け皿であり、Tab順のinteractive controlではない。設計、development workflow、verificationへpointer + Escapeの観察項目も追加した。
- 9.3.2: Tauri Viewer README / basic designの`imageViewer.ts`責務へactivation policyを追記した。

既存の42 tests / build / cargo check結果に影響しない局所CSS・docs修正であることも確認し、未解決0件となるか判定してください。レビュー文書更新後はコミットまで実施してください。
