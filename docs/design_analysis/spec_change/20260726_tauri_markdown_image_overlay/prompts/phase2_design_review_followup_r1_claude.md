レビュー指摘14件（Medium 7 / Low 7）の対応が完了しました。

下記コミットから差分を取得して再確認してください。

`19bf862`

主な対応:
- Mermaid / PlantUML inline sizeをclone直後にDOM正規化し、generator backgroundと一時的な重複IDの扱いを明記。
- React passive wheelを避けるnative non-passive listener、pinch、deltaMode換算、指数factorとpure testを定義。
- inert解除後のdeferred focus復帰を定義。
- Markdown alt / 著者指定titleを維持し、描画完了後だけvisual pointer markerとSVG / anchor外の隣接keyboard buttonをDOM adapterが追加する方式へ変更。
- intrinsic size候補選択をpure policyへ分離し、自動testを追加。
- linked imageの仕様差分をTODO / metaへ同期。
- ADR非起票、背景scroll抑止、既存frontend module形式、native button keyboard、clone ID、resolver拒否時、padding / aria-live / selection / fixture / async DOM差替えを明記。

`docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_design_review.md` のRound 1対応内容と設計・TODO・metaの整合を確認してください。

未解決指摘または追加指摘があれば同review文書へ追記し、コミットしてください。問題なければ、全指摘対応済み・未解決0件・Phase 2承認であることが分かる形にreview文書を更新し、コミットしてください。
