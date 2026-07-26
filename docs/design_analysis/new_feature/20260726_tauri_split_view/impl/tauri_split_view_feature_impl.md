# TODO-2026-006 Tauri Split view 導入 実装記録

## 1. 実装概要

承認済み設計に従い、Tauri Viewerへsingle / 左右2 pane Split Viewを追加した。`OpenDocumentTab[]`をdocument dataの正本として維持し、表示選択を`SplitViewState`、Mermaid / HTML handshakeなどDOM固有状態をpane-local `PanePreviewStatus`へ分離した。single modeもprimary `DocumentPane`を使い、旧global `activeTabId` / `pendingNavigation`経路は残していない。

## 2. 設計と実装の対応

| 設計項目 | 実装 |
| --- | --- |
| global tab data + pane-local selection | `App.tsx`の`tabs`と`splitViewState`を分離。Explorer / Reload / StatusBar / ErrorBanner / relative linkをactive paneへrouting |
| typed split transition | `src/splitView.ts`へsingle / split、select / activate、close fallback、root reset、pending navigation、ratio更新を集約 |
| dynamic split width | separator 6px、preferred minimum 240px、16px keyboard step、狭幅clampとrequested ratio非書き戻しを`splitView.ts`へ集約 |
| pane runtime guard | `src/paneRuntime.ts`の`isPaneResultCurrent`でpane / tab / revision / split modeを照合 |
| TabStrip state合成 | shared tab load stateを優先し、selected tabに一致するpane runtimeだけをLoading / Rendering / Errorへ合成 |
| `DocumentPane` | pane固有TabStrip、preview ref、Markdown DOM、HTML iframe、pending anchor、Mermaid / image viewer adapterを所有 |
| Mermaid分離 | App instanceのPromise queueで直列化し、task前後にpane guard / DOM接続を確認 |
| trusted HTML分離 | iframeごとのready flag / timeout / duplicate guardを維持し、ready / errorをpane runtimeへ反映 |
| image viewer | requestへApp側交差型で`paneId`を付加。発生元tab / revision / DOM切断 / split offを監視し、primary focus fallbackを提供 |
| accessibility | `View > Split View`を`menuitemcheckbox`化。pane-scoped ID、region、active pane枠、計測後separatorのARIA値を追加 |

## 3. 設計からの具体化

設計はApp queue内で`mermaid.run({ nodes })`を使う案を示していたが、Phase 2レビューの残リスク確認でMermaid 11の非deterministic generatorが`Date.now()`を使い、別taskまたは同task内の複数diagramでIDが一致し得ることを実package sourceで確認した。このため実装はqueue所有・strict security・stale guardという設計境界を維持したまま、`mermaid.render(renderId, source, node)`を直列実行し、`renderId = paneId + tabId + revision + diagram index`を明示する方式へ具体化した。`deterministicIds`は有効化していない。描画後は既存image viewer adapterとの契約を保つため`data-processed="true"`を付与する。

separatorのARIA値はPreviewWorkspace計測後だけseparatorを描画する方式を採用した。これによりfocus可能な`role="separator"`がmin / max / nowを持たないframeを作らない。計測前はCSSの50/50 2列fallbackを使う。

Rust command、custom protocol、Tauri capability、CSP、settings schemaは変更していない。

## 4. 変更ファイル

### Frontend

- `markdown-viewer-tauri/src/App.tsx`
- `markdown-viewer-tauri/src/App.css`
- `markdown-viewer-tauri/src/splitView.ts`
- `markdown-viewer-tauri/src/splitView.test.ts`
- `markdown-viewer-tauri/src/paneRuntime.ts`
- `markdown-viewer-tauri/src/paneRuntime.test.ts`

### 恒久ドキュメント

- `README.md`
- `markdown-viewer-tauri/README.md`
- `docs/rules/project_overview.md`
- `docs/architecture/overview.md`
- `docs/architecture/code_patterns.md`
- `docs/architecture/common_pitfalls.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `docs/rules/development_workflow.md`

## 5. 自動検証

2026-07-26に次を実行した。

| コマンド | 結果 |
| --- | --- |
| `cd markdown-viewer-tauri && npm test -- --run` | 成功。5 files / 71 tests passed（Phase 3 review対応後） |
| `cd markdown-viewer-tauri && npm run build` | 成功。TypeScript compile / Vite production build完了。既存のlarge chunk warningのみ |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | 成功 |
| `cd markdown-viewer-tauri/src-tauri && cargo test` | 成功。22 tests passed、失敗0 |
| `git diff --check` | 成功 |

## 6. Phase 4 手動確認事項

自動テストでDOM / Tauri WebViewの実操作までは検証していない。Phase 4では特に次を確認する。

- split on / off、empty secondary、close / root / Reloadのpane selection復旧。
- 同じMermaid documentを両paneへ表示した時のSVG ID / marker / theme。
- Markdown + HTML、HTML + HTMLのhandshake / timeout / external link分離とsecurity回帰。
- iframe上を通過するseparator drag、ARIA値、keyboard resize、狭幅 / 再拡大。
- secondary起点image viewerのtab close / split off時closeとfocus fallback。
- single modeのMulti-tab、Explorer resize、Settings、Recent Foldersの回帰。

詳細matrixは`docs/rules/development_workflow.md`および設計書第19節を参照する。

## 7. Phase 3実装レビュー対応

初回実装レビューのMedium 1件、Low 3件をすべてPhase 3で修正した。

| 指摘 | 分類 | 対応 |
| --- | --- | --- |
| 1.1 preview focus復帰先が読み込み前の要素で固定 | impl / Medium | Markdown previewのcallback refでlive DOMを登録し、読み込み中・HTML・未選択時はfocus可能な`document-pane-${paneId}` regionへfallbackする。loadingからloadedへの遷移とthemeによるremountの双方で登録先を更新する |
| 3.1 pane statusの過剰clear | impl / Low | 同一tab再選択時のclearを廃止し、Reloadではrevisionを更新するtabを選択中のpaneだけをclearする。同一tabを両paneで表示中なら両方をclearする |
| 3.2 極小幅でratio 0 / 1を生成 | impl + test / Low | separatorを除く利用可能幅が2px未満ならwidth boundsを`null`とし、separator操作を描画・実行しない。7px workspaceのbounds / keyboard / pointer policy境界testを追加した |
| 3.3 HTML bridgeのtab / revision判定が同一述語 | impl + test / Low | `isPaneSelectionCurrent`と`isTabRevisionCurrent`を独立pure policyとして公開し、`isPaneResultCurrent`を両者の合成へ変更。HTML bridge contextへ各述語を個別配線した |

対応後に`npm test -- --run`（5 files / 71 tests）と`npm run build`を再実行し、いずれも成功した。設計契約と恒久ドキュメントの変更は不要で、実装の適合修正として閉じている。
