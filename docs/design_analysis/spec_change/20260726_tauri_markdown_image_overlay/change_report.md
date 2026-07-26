# Tauri Markdown画像オーバーレイ表示 変更レポート

## 対象

- TODO: `TODO-2026-022 Tauri Markdown画像オーバーレイ表示`
- Branch: `spec-change/tauri-markdown-image-overlay`
- Base branch: `main`
- Base commit: `d2e9fd53eaea06732d129dce06b37920ad078609`
- Report commit range: `d2e9fd5..64cde48`
- 作成日: 2026-07-26

workflow規定の`git merge-base master HEAD`は、このrepositoryに`master`が存在しないため実行できなかった。既定branchの`main`を用いて`git merge-base main HEAD`を実行し、上記base commitを取得した。

## 変更概要

Tauri版Markdown previewへ、通常画像と描画済みMermaid / PlantUML SVGを拡大閲覧するmodal image viewerを追加した。

- 初期fit、最大800% zoom、Fit / 100% resetを提供する。
- toolbar、wheel / trackpad、`+` / `-`でzoomできる。
- pointer drag、Arrow、Shift+Arrowでpanできる。
- Close、Escape、backdropで閉じ、背景を`inert`にしてfocusをdialog内へ閉じ込める。
- pointer / keyboardのactivation別にclose後のfocus復帰先を分ける。

## 実装

- `markdown-viewer-tauri/src/imageViewer.ts`
  - fit / zoom / pan / wheel / intrinsic size / activationのpure policyを実装した。
  - 対象visualのDOM decoration、opaque ID、keyboard trigger、typed resolver、cleanupを実装した。
- `markdown-viewer-tauri/src/App.tsx`
  - active request、preview event delegation、modal lifecycle、clone、zoom / pan input、focus trap / 復帰を実装した。
- `markdown-viewer-tauri/src/App.css`
  - non-reflow keyboard trigger、viewer backdrop / dialog / toolbar、Light / Dark、focus表示を追加した。
- `markdown-viewer-tauri/src/imageViewer.test.ts`
  - geometry、bounds、zoom anchor、wheel正規化、intrinsic size、activation policyを検証した。
- `sample_docs/image_viewer.md`
  - 通常画像、linked / inline image、横長・縦長Mermaid、巨大PlantUML、link / anchorをまとめた手動fixtureを追加した。

Rust command、filesystem、asset protocol、trusted HTML iframe / bridgeには変更を加えていない。

## ドキュメント

- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`
- `docs/tests/README.md`

上記を対象visual、input、modal / focus、通常layout非退行、manual fixtureとactivation別focus復帰の契約へ同期した。

## レビュー

- Phase 2 design review:
  - clone size正規化、visual decorationのlayout非退行、linked image / SVG anchor、focus / accessibility条件を確認した。
  - follow-up reviewでApproved、未解決0件となった。
- Phase 3 implementation review:
  - live region、focus pill配置、accessible name、test網羅、docs不足を修正した。
  - Phase 4-a feedbackのactivation別focus復帰と本文outline抑止も追加レビューし、全7件（Medium 2 / Low 5）をクローズした。
  - 最終review commit `cd50464`で未解決0件、Phase 4-a再確認可となった。

## Phase 4-a ユーザー確認

- 通常画像、Mermaid、PlantUMLのzoom cursorとoverlay open: PASS。
- button、mouse、keyboardによるzoom / pan: PASS。
- Close / Escape: PASS。
- pointer close後にkeyboard用pillを表示しない: PASS。
- Tabでpillを表示し、Enter / Spaceで開き、close後にfocusを戻す: PASS。

初回確認で見つかったpointer close後のpill表示は`27ca57c` / `c9e519b`で修正し、ユーザー再確認で問題ないことを確認した。詳細は`verification/phase4a_user_verification.md`を参照する。

## 検証結果

- `npm test -- --run`: 成功。3 files / 42 tests、0 failures。
- `npm run build`: 成功。既知のVite chunk size warningのみ。
- `cargo fmt -- --check`: 成功。
- `cargo check`: 成功。
- `cargo test`: 成功。22 tests、0 failures。
- `git diff --check`: 成功。
- Claude design / implementation follow-up review: Approved、未解決0件。

## 生成物

- `diff.zip`
  - `git diff --binary --full-index d2e9fd5..64cde48`でpatchを生成し、zip化した。
  - source、fixture、設計・レビュー・恒久docsを含む27変更file、3,143 insertions / 20 deletionsを収録した。
  - `unzip -t`で整合確認済み。

## Follow-up

- 今回のscopeに対する未解決事項はなく、新しいfollow-upは作成しない。
- Avalonia版、trusted HTML iframe内画像、download、別window、transform永続化は今回のscope外として別workflowで扱う。
