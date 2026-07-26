Phase 4-aのユーザー実機確認でfocus復帰UXの問題が見つかったため、Phase 3相当へ戻して修正しました。同じレビュー担当として追加実装レビューを行ってください。

重要:

- このレビューを別Agent、review automation skill、orchestrator、別tmux sessionへ再委譲しないでください。
- あなた自身が差分・実装・テスト・文書を確認し、既存レビュー文書を更新してコミットしてください。
- 新しいレビュー文書は作らず、次へPhase 4-a追加レビュー節を追記してください。

`docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_impl_review.md`

ユーザー確認と判断は次へ記録しています。

`docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/verification/phase4a_user_verification.md`

問題:

- pointerでvisualを開いて閉じた場合にも、keyboard用の隣接buttonへfocusが戻り、右上へ`Open image viewer` pillが表示された。
- keyboard操作では必要な復帰先だが、通常のpointer操作後には用途不明のUIに見える。

修正:

- `ImageViewerRequest`へ`activation: "pointer" | "keyboard"`を追加した。
- click eventの`detail === 0`をkeyboard、それ以外をpointerとするpure policy `getImageViewerActivation`を追加した。
- close後はkeyboard起点だけ`focusOrigin`へ、pointer起点ではactive previewへfocusを戻す。
- activation policy testを追加し、設計、component docs、development workflow、impl、Phase 4-a検証記録を同期した。

修正後の検証結果:

- `npm test -- --run`: Pass（3 files / 42 tests）
- `npm run build`: Pass（既存chunk size warningのみ）
- `cargo check`: Pass

特に、UIEvent `detail`によるactivation判定、modal close後のfocus管理、screen reader / keyboard経路の維持、pointer経路でpillを出さないこと、tab / revision変更時のfallback、文書整合を確認してください。未解決指摘数とPhase 4-aユーザー再確認へ進めるかを明記し、レビュー文書更新後はコミットまで実施してください。
