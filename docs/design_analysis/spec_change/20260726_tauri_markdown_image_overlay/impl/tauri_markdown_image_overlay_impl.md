# TODO-2026-022 Tauri Markdown画像オーバーレイ表示 実装記録

## 1. 実装概要

Tauri版Markdown preview内の通常画像、描画済みMermaid SVG、描画済みPlantUML SVGをmodal image viewerへ開き、fit、最大800%のzoom、pan、100% reset、close / focus管理を行うfrontend機能を追加した。Rust backend、asset protocol、trusted HTML iframeには変更を加えていない。

## 2. 設計と実装の対応

| 設計項目 | 実装 | 対応内容 |
| --- | --- | --- |
| §5.1 DOM clone | `ImageViewerDialog` (`App.tsx`) | allowlist済みvisualをopen時だけ`cloneNode(true)`し、generator由来sizeを除去してintrinsic pixel sizeを設定。clone subtreeは`inert` / `aria-hidden`とした |
| §5.2 transform model | `imageViewer.ts` | fit、reset、zoom anchor、pan bounds、resize、wheel factorをtyped pure functionへ集約し、invalid geometryは`RangeError`にした |
| §5.3 modal | `ImageViewerDialog` / `App` | app shellの`inert`、focus trap、初期viewport focus、Escape / Close / backdrop、deferred origin focus復帰を実装した |
| §6 source trigger | `createImageViewerDomAdapter` | load済みimage、成功済みMermaid / PlantUMLだけへopaque ID markerとnative buttonを追加。linked image buttonは`a`外へ配置した |
| §6.4 resolver | `resolveImageViewerSource` | active preview root内でID一致visual / buttonが各1件の時だけtyped requestを返す。SVG anchorはApp側でlink処理を優先する |
| §7 zoom | `imageViewer.ts` / `ImageViewerDialog` | fit下限、8.0上限、1.25 / 0.8 button step、pointer位置wheel zoom、整数倍率表示、250ms live debounceを実装した |
| §8 pan | `imageViewer.ts` / `ImageViewerDialog` | pointer capture drag、Arrow 48px、Shift+Arrow 160px、axis別bounds clamp、resize追従を実装した |
| §9 keyboard | `ImageViewerDialog` | `+` / `-` / `0` / `F` / Arrow / Escape / Tab loopを実装した。source側Enter / Spaceはnative button activationを利用する |
| §10 lifecycle | `App` effects | tab ID / revision / document type不一致でcloseし、transformはdialog内部だけに保持する。revision不変DOM差替え中はclone表示を継続する |
| §16 CSS | `App.css` | theme対応backdrop / dialog、viewer viewport、non-reflow trigger、focus pill、toolbar wrap、focus outlineを追加した |

実装レビュー対応として、倍率の可視`output`は`aria-live="off"`として250ms debounceのlive regionだけが通知するようにした。keyboard buttonはfocus時に対象visualを表示領域へ入れてpill座標を同期設定する。buttonの操作labelとdialogの内容名も分離し、accessible nameが可視labelを先頭に含む形へ統一した。

## 3. 互換性と境界

- Markdown image ruleのrelative resource、`loading="lazy"`、alt、著者指定titleは変更していない。
- linked imageの画像領域clickは仕様どおりviewerを優先する。linkのkeyboard activationと画像外link textは既存navigationを維持する。
- SVG内anchorはviewer resolverより先に既存link処理へ渡す。
- keyboard triggerはvisually hidden / absolute / `pointer-events: none` / `user-select: none`で通常layoutとcopy textへ影響させず、`:focus`時だけvisual右上へ表示する。
- trusted HTML iframe、Tauri command、Rust filesystem / PlantUML / protocol境界は変更していない。

## 4. テストとfixture

### 自動テスト

`imageViewer.test.ts`へ次のpolicy testを追加した。

- 大小・狭幅・縦長geometryのfit
- invalid / zero / non-finite値の拒否
- fit〜800% zoom clamp
- pointer anchor座標維持
- viewport中央zoom時の非zero offset更新
- axis別pan boundsとdrag / keyboard delta clamp
- 100% reset
- fit / custom mode resize
- wheel `deltaMode`正規化とfactor clamp
- intrinsic sizeのviewBox / explicit / bounds優先順位とinvalid時null

### 手動fixture

`sample_docs/image_viewer.md`を追加し、既存PNG、inline / linked image、横長・縦長Mermaid、大規模PlantUML、通常link / anchorを1文書で確認できるようにした。GUIでの手動scenario実施と結果記録はPhase 4-aのユーザ動作確認で行う。

## 5. 検証結果

2026-07-26に次を実行した。

| command | result |
| --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | Pass。3 files / 41 tests |
| `cd markdown-viewer-tauri && npm run build` | Pass。TypeScript compile / Vite production build成功。既存のchunk size warningのみ |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | Pass |

外部I/O、永続化、serialization、Rust command、integration test codeは変更していないため、追加の統合テストは不要と判断した。

## 6. 恒久ドキュメント反映

- `docs/components/tauri_viewer/README.md`: 責務、source構成、主要要素へimage viewerを追加。
- `docs/components/tauri_viewer/basic_design.md`: policy / DOM adapterの責務、依存方向、状態遷移を追加。
- `docs/components/tauri_viewer/detail_design.md`: decoration、resolver、modal、transform、lifecycle契約を追加。
- `docs/components/tauri_viewer/interface_spec.md`: 対象visual、入力、zoom / pan、modal / focus、互換契約を追加。
- `docs/rules/development_workflow.md`: 専用fixtureによる手動確認項目を追加。
- `docs/tests/README.md`: Manual UI checkの対象領域へMarkdown image viewerを追加。

## 7. 未解決事項

- 実装上の未解決事項はない。
- GUIのLight / Dark、trackpad、window resize、focus復帰、layout非退行はPhase 4-aで手動確認する。

## 8. Phase 4-a フィードバック対応

ユーザー実機確認で、pointerからviewerを開いて閉じた後にもkeyboard用`Open image viewer` pillがfocus復帰によって表示され、用途が分かりにくいことを確認した。pure policy `getImageViewerActivation`がclick eventの`detail`からactivationを区別し、keyboard起点だけ隣接buttonへ、pointer起点ではactive previewへfocusを戻すよう修正した。これによりTab / Enter / Space経路の復帰focusを維持しつつ、通常のマウス操作後にはpillを表示しない。

修正後は`npm test -- --run`が3 files / 42 tests Pass、`npm run build`がPass（既存chunk size warningのみ）、`cargo check`がPass。

追加レビューのLow 2件も採用し、programmatic focus専用の`.markdown-body`へ`outline: none`を指定してpointer起点をEscapeで閉じた場合の本文全体outlineを防止した。また、`README.md`と`basic_design.md`の`imageViewer.ts`責務へactivation policyを追記した。
