# Tauri document preview 横幅の可変化 変更レポート

## 対象

- TODO: `TODO-2026-021 Tauri document preview 横幅の可変化`
- Branch: `spec-change/tauri-document-preview-responsive-width`
- Base branch: `main`
- Base commit: `3aaa5a226c702a70c66d9cf3f436c0738e8dce37`
- Report commit range: `3aaa5a2..7b6dee5`
- 作成日: 2026-07-25

workflow規定の`git merge-base master HEAD`は、このrepositoryに`master`が存在しないため実行できなかった。既定branchの`main`を用いて`git merge-base main HEAD`を実行し、上記base commitを取得した。

## 変更概要

Tauri版Markdown本文の固定980px上限を撤去し、preview paneの利用可能幅へresponsive gutterを残して追従させた。

- 通常時はpreview pane content boxから48pxを引き、左右24pxのgutterを確保する。
- window viewportが760px以下では既存media queryにより28pxを引き、左右14pxのgutterを維持する。
- table、code、Mermaid、PlantUML、imageの既存overflow / scaling契約を維持する。
- trusted HTML iframe全幅とHTML文書固有layout、sandbox / protocol / CSP境界を変更しない。
- Phase 4-aで検出したMermaidのリサイズ退行を修正し、内容不変のReact再描画では生成済みSVGを維持する。

## 実装

- `markdown-viewer-tauri/src/App.css`
  - `.markdown-body`を`width: calc(100% - 48px)`へ変更し、固定980px上限を撤去した。
  - viewport 760px以下の`calc(100% - 28px)`と子要素のoverflow / scalingは維持した。
- `markdown-viewer-tauri/src/App.tsx`
  - `dangerouslySetInnerHTML` objectを生成HTML単位でmemoizeした。
  - window size保存やExplorer操作など、Markdown内容を変えないApp再描画でMermaid SVGを元HTMLへ戻さないようにした。
  - Theme / tab revisionでは既存keyによりremountし、Mermaidを従来どおり再描画する。
- `sample_docs/preview_width.md`
  - wide table、Mermaid、PlantUML、image、long codeをまとめた手動確認fixtureを追加した。

## ドキュメント

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`

上記をpane相対幅、viewport基準gutter、子要素overflow / scaling、HTML iframe全幅、Mermaid SVG維持、手動確認契約へ同期した。

## レビュー

- Phase 2 design review:
  - 本文幅はpreview pane content box基準、gutter breakpointはwindow viewport基準であることを明確化した。
  - Claude follow-up reviewでApproved、未解決指摘0件となった。
- Phase 3 implementation review:
  - workflow上の`impl_status` lifecycleを確認し、初回レビューのLow指摘を解決した。
  - Phase 4-a Mermaid feedback fixについて、react-domの参照比較とinnerHTML更新経路、Theme / revision再描画、race非追加を再確認した。
  - Claude Round 2 reviewでApproved、未解決指摘0件となった。

## Phase 4-a ユーザー確認

- Markdown本文のpreview pane幅追従: PASS。
- Mermaid初期SVG描画: PASS。
- 複数回のwindow resize後のMermaid SVG維持: PASS。
- Explorer resize後のMermaid SVG維持: PASS。
- Light / Dark切替とReload後のMermaid再描画: PASS。

初回確認で見つかったMermaidのソース復帰は`adc1a49`で修正し、修正後の1〜4再確認がすべて問題ないことをユーザーが確認した。詳細は`verification/phase4a_user_verification.md`を参照する。

## 検証結果

- `npm run build`: 成功。既知のVite chunk size warningのみ。
- `npm test -- --run`: 成功。2 files / 29 tests、0 failures。
- `cargo fmt -- --check`: 成功。
- `cargo check`: 成功。
- `cargo test`: 成功。22 tests、0 failures。
- `git diff --check`: 成功。
- Claude design / implementation follow-up review: Approved、未解決指摘0件。

## 生成物

- `diff.zip`
  - `git diff --binary --full-index 3aaa5a2..7b6dee5`でpatchを生成し、zip化した。
  - source、fixture、設計・レビュー・恒久docsを含む21変更fileを収録した。
  - `unzip -t`で整合確認済み。

## Follow-up

- 今回のscopeに対する未解決事項はなく、新しいfollow-upは作成しない。
- Avalonia版preview幅、ユーザー設定化、split viewは今回のscope外として既存の個別workflowで扱う。
