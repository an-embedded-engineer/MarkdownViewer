# Tauri Explorer ツリーペイン UX 改善 実装記録

## 1. 対象

- TODO: `TODO-2026-019`
- 設計: `../design/tauri_explorer_pane_ux_design.md`
- 実装対象: Tauri / React版のみ
- Avalonia水平展開: `TODO-2026-020`で後続対応

## 2. 設計と実装の対応

| 設計項目 | 実装 |
| --- | --- |
| Explorer幅policy | `src/explorerPane.ts`へ初期280px、最小180px、hard最大640px、Preview予約320px、separator 6px、keyboard step 16pxとpure functionを集約した。dynamic maxは`max(180, min(640, workspaceWidth - 320 - 6))`で常にmin以上となる。 |
| workspace計測とsession state | `App`が`requestedExplorerWidth`、`workspaceWidth`、drag stateを保持し、`ResizeObserver`でworkspace実寸を更新する。root変更・Reloadではresetせず、永続化は行わない。 |
| pointer resize | primary pointerだけを受け、separatorへ明示的にfocusを移したうえでpointer captureを正本としてmove / up / cancel / lost captureを処理する。drag中はselectionを抑止し、app shell全体へ`col-resize` cursorを適用する。 |
| keyboard / accessibility | separatorへvertical `role="separator"`、`aria-controls`、min / max / now、focus、ArrowLeft / ArrowRight / Home / Endを実装した。directory buttonへ`aria-expanded`を追加した。 |
| layout / overflow | workspaceをExplorer / 6px separator / Previewの3列へ変更した。Explorer headerと`.explorer-scroll`を分離し、tree / rowへ`max-content`と`min-width: 100%`を併用した。固定220px media queryとlabel ellipsisは削除した。 |
| tree icon | disclosure、directory、Markdown、HTML、imageを外部packageなしの`currentColor` inline SVGで表示した。iconは`aria-hidden`とし、node名をaccessible nameとして維持した。 |

## 3. 設計差分

- 設計のpointer up / cancel cleanupに加え、WebView側でcaptureが失われた場合にもdrag状態を残さないよう`lostpointercapture`を同じ終了契約へ追加した。
- `pointerdown`のdefault focusが`preventDefault()`で抑止されるWebViewでもkeyboard操作へ継続できるよう、separatorを明示的にfocusする。
- directory開閉はI/Oを伴わない既存のclient-side toggleとしてglobal busy中も維持し、file rowの既存disabled契約だけを変更せず保持する。
- それ以外の数値、永続化範囲、Rust API、tree data contract、Avalonia非対象範囲に設計差分はない。

## 4. 互換性

- `FileTreeNode` / `FileNodeType`、Rust command、custom protocol、capability、CSPは変更していない。
- root選択、Reload、Markdown / HTML tab、Preview表示のstate経路は変更していない。
- Explorer幅はapp configへ保存せず、frontend reload / app再起動時に280pxへ戻る。
- image nodeは引き続き選択不可だが、専用iconとdisabled色で判別できる。

## 5. 恒久ドキュメント反映

- `docs/components/tauri_viewer/README.md`: module一覧と責務へExplorer policyを追加。
- `docs/components/tauri_viewer/basic_design.md`: React / TypeScript policy責務と依存方向を更新。
- `docs/components/tauri_viewer/detail_design.md`: state、DOM、resize、scroll、3列tree layoutを更新。
- `docs/components/tauri_viewer/interface_spec.md`: pointer / keyboard操作、幅境界、ARIA、scroll、icon契約を追加。
- `docs/rules/development_workflow.md`: Phase 4-aで使うExplorer手動確認項目を追加。

## 6. 自動検証結果

実施日: 2026-07-22

| command | 結果 |
| --- | --- |
| `npm run build` | 成功。TypeScript compile / Vite production build完了。既知のchunk size warningのみ。 |
| `npm test -- --run` | 成功。2 files / 29 tests passed。Explorer policy 9 testsを含む。 |
| `cargo check` | 成功。 |
| `cargo test` | 成功。22 tests passed。 |
| `cargo fmt -- --check` | 成功。差分なし。 |

## 7. 手動確認と未解決事項

- pointer / keyboard resize、pointer drag後のseparator focus、狭幅時ARIA、長いtreeの縦横scroll、Light / Dark icon、HTML iframe上でのpointer captureとcursorの見え方はPhase 4-aのユーザー動作確認で実施する。
- Phase 3実装時点の未解決実装事項はない。実装レビュー結果は`review/`へレビュー担当Agentが記録する。
