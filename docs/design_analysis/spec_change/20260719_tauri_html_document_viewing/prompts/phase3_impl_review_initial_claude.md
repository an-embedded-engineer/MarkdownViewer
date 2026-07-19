# TODO-2026-017 Phase 3 実装レビュー依頼（Claude）

あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- レビュー文書以外のsource、design、impl、meta、恒久docsは変更しないでください。

workflow: `spec-change`
review kind: Phase 3 implementation and permanent documentation review
issue id: `TODO-2026-017`
title: `Tauri HTML形式仕様書表示対応`

下記コミットから必要なファイルを取得して確認してください。

`05039bb Phase 3 implement Tauri HTML document viewing`

対象:

- 設計: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/design/tauri_html_document_viewing_design.md`
- Phase 2 review: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_design_review.md`
- 実装記録: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/impl/tauri_html_document_viewing_impl.md`
- source / config / tests / fixture / 恒久docs: commit `05039bb` の差分一式
- meta: `docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/meta.md`

レビュー結果は次へ作成し、コミットまで実施してください。

`docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_impl_review.md`

レビュー観点は `ai-review-response-workflow/references/procedure/review_checkpoints.md` 相当の checkpoints と、spec-change Phase 3 の観点に従ってください。特に次を確認してください。

1. 設計の受け入れ条件と実装・test・恒久docsが追跡可能であること。
2. `DocumentStore` root swap / read lock、path decode、symlink、Windows path、MIME allowlist、HTTP status、CSP/CORSが設計どおりであること。
3. Rust生成のroot-relative preview URLがrelative resource解決を維持し、`convertFileSrc` fallbackやabsolute path露出がないこと。
4. sandbox、shell / response CSP、Tauri capability、bridge injection、ready handshake、message source / origin / revision / user activation / duplicate guardが過不足なく実装されていること。
5. HTML branchでMarkdown / Mermaid / PlantUMLが実行されず、既存Markdown / tab / Reload / Theme契約へ退行がないこと。
6. Rust unit testとVitestが成功系・境界値・拒否系を十分に直接検証していること。
7. UI文言、manual fixture、開発手順、component / architecture docs、impl記録がsourceと一致すること。
8. 不要な互換wrapper、fallback、重複ロジック、権限緩和が追加されていないこと。

未解決指摘はseverity、根拠、影響、修正案、工程、statusを明記してください。問題がなければPhase 3を承認し、Phase 4-aへ進行可能であることを明示してください。
