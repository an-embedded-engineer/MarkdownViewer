Round 2で追加されたMedium指摘7.2（隣接viewer buttonの表示契約・挿入位置・visualとの対応付け）へ対応しました。

対応コミットの差分を取得し、次を再確認してください。

- buttonが通常時に本文flowとpointer操作へ影響せず、keyboard focus時には視覚的に識別できること
- 通常画像、linked image、Mermaid、PlantUMLそれぞれの挿入位置が既存layout / link / scroll契約を維持すること
- visualとbuttonの対応付けからpointer経路でも非nullの`focusOrigin`を解決できること
- `.markdown-body` typography継承の打消しと、focus / scroll / resize / disconnect lifecycleが実装可能な粒度で定義されていること
- 追加した手動scenarioでlayout不変とfocus可視性を判定できること

対象文書:

- `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/design/tauri_markdown_image_overlay_design.md`
- `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/meta.md`
- `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_design_review.md`

未解決指摘または追加指摘があれば同review文書へ追記し、コミットしてください。問題なければ、全指摘対応済み・未解決0件・Phase 2承認であることが分かる形にreview文書を更新し、コミットしてください。
