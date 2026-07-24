# Phase 3 実装レビュー follow-up 依頼（Round 2 / Phase 4-a feedback）

あなたはレビュー担当 Agent です。

重要:

- このレビューを別のCLI Agent、review automation skill、orchestrator skill、tmux sessionへ再委譲しないでください。
- あなた自身が必要なファイルを読み、既存review文書を更新し、commitしてください。
- workflow skillは作業実行者向けのPhase手順として起動せず、レビュー観点として必要な範囲だけ参照してください。

## 対象

- workflow: `spec-change`
- tracking ID: `TODO-2026-021`
- branch: `spec-change/tauri-document-preview-responsive-width`
- Phase 4-a feedback fix commit: `adc1a49`
- review:
  `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/review/tauri_document_preview_responsive_width_impl_review.md`
- design:
  `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/design/tauri_document_preview_responsive_width_design.md`
- implementation:
  `docs/design_analysis/spec_change/20260725_tauri_document_preview_responsive_width/impl/tauri_document_preview_responsive_width_impl.md`

## Phase 4-a feedback

ユーザー確認では本文幅とgutterは期待どおりでしたが、Mermaidは初期状態でSVG描画された後、window resizeするとdiagram source文字列へ戻りました。

原因分析:

- window resize時のlogical size保存が`App`を再描画する。
- `MarkdownPreview`が毎回新しい`dangerouslySetInnerHTML` objectを渡す。
- ReactがMermaidによるSVGへのDOM mutationを元Markdown HTMLで上書きする。
- Mermaid effectはwindow sizeを依存値に持たず、SVGへ再描画されない。

修正:

- `renderMarkdown`結果に加え、`dangerouslySetInnerHTML` objectをHTML単位で`useMemo`により安定化した。
- window / Explorer resizeなどMarkdown内容を変えない再描画では、Mermaid SVGを元HTMLで上書きしない。
- width計測、resize listener、Mermaid resize再実行は追加していない。
- 設計補足、実装記録、恒久ドキュメント、手動確認項目、metaのPhase 3再開状態を同期した。

自動検証:

- `npm run build`: 成功（既知のchunk size warningのみ）
- `npm test -- --run`: 2 files / 29 tests passed
- `cargo check`: 成功
- `cargo test`: 22 passed
- `cargo fmt -- --check`: 成功
- `git diff --check`: 成功

## レビュー観点

1. `dangerouslySetInnerHTML` objectのidentity安定化により、内容が変わらない親再描画でMermaid SVGが保持される原因・修正関係が妥当か。
2. Markdown本文、PlantUML結果、selected path変更時は新しいHTMLが注入されること。
3. Theme / tab revision変更時は既存component keyとMermaid effectにより再描画され、更新を止めすぎないこと。
4. window / Explorer resizeのたびにMermaidを再実行するraceや新しいlistenerを追加していないこと。
5. 幅契約、HTML iframe、security boundary、Rust側に不要な変更がないこと。
6. 設計補足、実装記録、恒久ドキュメント、Phase 4-a再確認項目が実装と一致すること。
7. DOMなしの現行Vitestでは手動再確認を完了条件とする判断が妥当か。

## 更新・commit依頼

- 既存review文書だけを更新してください。
- Phase 4-a feedbackとRound 2再レビュー結果を追記してください。
- 未解決指摘があればseverity、根拠、対応案、statusを記録してください。
- 問題がなければ最終承認と未解決指摘0件を明記してください。
- review文書の変更をcommitしてください。
- 実装、設計、meta、その他の文書は変更しないでください。
- 最後にcommit hash、最終判定、未解決指摘件数を報告してください。
