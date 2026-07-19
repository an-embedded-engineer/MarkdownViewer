レビュー指摘への対応が完了しました。

対応コミット: e8441af

前回レビュー文書:
- docs/design_analysis/research_analysis/20260719_html_document_viewing_support/html_document_viewing_support_report_review.md

確認対象:
- docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md

対応内容:
- 指摘1: Avaloniaのsubresource監視をadapter固有の追加防御へ格下げし、trusted root契約、`NavigationStarted`、host bridge制限を主境界へ変更しました。macOS file read access scopeの確認も追加しました。
- 指摘2: Avalonia Markdigがraw HTML / scriptを既に通す現状へ修正し、`DisableHtml()`採否を未解決事項へ追加しました。
- 指摘3: 既存Markdownと新規HTMLの両方で、`HandleWebMessageAsync.openExternal`へ`http:` / `https:` allowlistを共通適用する変更・テスト方針を追加しました。
- 指摘4: `scan_directory`はMarkdownと画像を列挙し、`read_text_file`だけがMarkdown限定である記述へ修正しました。
- 指摘5: 現行Tauri Markdownは`mailto:`対応済みで、HTMLとの統一方針をspec-changeで決める旨を追加しました。
- 指摘6: sandboxed iframeのopaque origin（`Origin: null`）からのroot内resource / JSON fetchを3 platformで検証する観点を追加しました。

全指摘が解消されているか再確認してください。

未解決指摘があれば同じレビュー文書へRound 2として追記し、コミットしてください。
問題なければ、承認したことが分かる形で同じレビュー文書へRound 2承認を追記し、コミットしてください。
