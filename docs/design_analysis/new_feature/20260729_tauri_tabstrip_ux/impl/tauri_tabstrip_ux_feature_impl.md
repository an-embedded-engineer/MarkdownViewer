# Tauri TabStrip 状態表現・scroll・drag move UX改善 実装記録

## 1. 対象

- TODO: `TODO-2026-026`
- branch: `new-feature/tauri-tabstrip-ux`
- design: `../design/tauri_tabstrip_ux_feature_design.md`
- Phase 2 review: `../review/tauri_tabstrip_ux_design_review.md`

## 2. 設計差分とPhase 2持越し指摘

Phase 2再レビューの非ブロッキング3件を、実装と同じ改訂で次のように確定した。

| 指摘 | 確定内容 | 反映先 |
| --- | --- | --- |
| 8.1 scrollbar API競合 | `scrollbar-width` / `scrollbar-color`を使わず、Tauri対象WebViewで共通利用するWebKit pseudo-elementの6px trackへ一本化した。40pxは外寸とし、実track寸法はPhase 4-aの実WebViewで確認する | `App.css`、設計§4.5 / §7.1 / §14 / §16 |
| 8.2 click抑止scheduled clear | rAF clearを廃止し、matching source click、次pointerdown、clickを生成しないcancelだけでidentityをclearする | `App.tsx`、設計§8.4 / §12 |
| 8.3 drag layer token | `.app-shell, .tab-drag-layer`のLight / Dark selectorへpreviewが参照する既存tokenとindicator tokenを明示した | `App.css`、設計§9.6 |

## 3. 実装差分

### 3.1 pure policyとaccessibility

- `tabStrip.ts`へitem外枠reveal delta、6px drag threshold、drop pane narrowingを追加した。
- 非finiteまたは不正順序のreveal geometryはthrowし、silent fallbackしない。
- `paneRuntime.ts`へpresentation stateからaccessible suffix / busyを一意に返すmappingを追加した。
- `tabStrip.test.ts`と`paneRuntime.test.ts`で境界値、unknown / null candidate、accessible mappingを検証した。

### 3.2 compact stateとscroll

- TabStrip外寸を58pxから40pxへ変更し、visible state 2行目を削除した。
- ready active、loading、rendering、errorを上端pseudo-elementで表示し、active背景を独立して維持した。
- renderingはindeterminate animation、reduced motionではstatic repeating patternを使う。
- activate buttonへstate込み`aria-label`、loading / renderingへ`aria-busy`を付与した。
- item refとstrip refからmanual deltaを計算し、`focus({ preventScroll: true })`と`strip.scrollBy`だけでitem全体をrevealする。
- horizontal scrollbarは6px trackを常時確保し、pointerがouter shell内に滞在する時またはkeyboard入力由来focus時だけ単一classでthumbを表示する。

### 3.3 pointer drag move

- Appがpending / dragging session、click抑止identity、live status、fixed previewを所有する。
- mouse primary buttonだけを受理し、6 CSS pxでdragを開始する。touch / penとmove / close buttonはdrag対象外とした。
- pointer capture中のtargetは`elementFromPoint`で解決し、pointerup座標でdestinationを再判定する。
- dragとmove buttonは`moveTab(sourcePaneId, destinationPaneId, tabId)`へ統合し、既存`move-tab` reducerを1回だけ呼ぶ。
- Escapeはclick抑止identityを後続releaseまで維持し、pointercancel / unexpected lost capture / split解除 / source evictionはidentityを同期clearする。いずれもmembershipを変更せずcleanupする。drag中の追加pointerdownではidentityをclearしない。
- drag previewはApp shell siblingのfixed layerへ置き、座標更新はDOM transform、React state更新はdrag開始 / target変更 / 終了だけに限定した。

## 4. 恒久ドキュメント反映

- `docs/components/tauri_viewer/README.md`: module map、責務、利用方法、mouse-only制約。
- `basic_design.md`: `tabStrip.ts` pure policy。
- `detail_design.md`: 40px state / scroll / drag lifecycleと責務境界。
- `interface_spec.md`: UI操作、accessible state、drop / cancel契約。
- `docs/rules/development_workflow.md`: Phase 4-a手動matrix。
- `docs/architecture/code_patterns.md`: pure policy、single transition、high-frequency ref pattern。
- `docs/architecture/common_pitfalls.md`: capture hit test、click identity、focus scroll、fixed layer、scrollbar API。
- `docs/tests/README.md`: 自動testとDOM / WebView手動検証の境界。

## 5. 検証結果

| 検証 | 結果 |
| --- | --- |
| `npm test -- --run` | 成功。6 files / 113 tests（最終Phase 3 follow-up時点） |
| `npm run build` | 成功。TypeScript compile + Vite production build。既存chunk size warningのみ |
| `cargo fmt -- --check` | 成功 |
| `cargo check` | 成功 |
| `cargo test` | 成功。22 tests |
| Vite単体browser smoke | Tauri window metadataが存在しないため既存App初期化で停止。Tauri host依存のためDOM操作検証には使用不可 |

## 6. 手動確認境界

実WebViewでのみ確定できる次の項目はPhase 4-aで確認する。

- WebKit scrollbar trackの実寸6px、thumb visibility、40px外寸、左右preview上端。
- Light / Dark、reduced motion、ready / active / loading / rendering / errorの視認性。
- overflow時のitem全体revealとpreview / Explorer / app shellのscroll不変。
- active / non-active mouse drag、same ID、invalid release、Escape、source unmount、split解除、root変更。
- drag直後click、destination focus、StatusBar / ErrorBanner、Markdown / HTML / Mermaid / PlantUML runtime。
- 非active sourceのEscape後releaseとdrag中の追加pointerdown、error / loading tab focus時のindicator / outline併存。
- touch / penの非drag契約とkeyboard move button。

## 7. 既知制約

- 同一pane reorder、preview paneへのdrop、touch / pen dragは非対象。
- drag / scrollbar / focusのDOM lifecycleはjsdomを導入せず、pure policy自動testとPhase 4-aの実WebView matrixで分担する。
- Rust command、settings schema、custom protocol、CSP / capabilityは変更していない。

## 8. Phase 3 実装レビュー

- 初回レビュー `ca88c4b` では blocking Medium 1件とLow 3件が検出された。
- 修正コミット `ddc7e86` でEscape後releaseのclick抑止、追加pointerdown時のidentity保持、indicatorのstacking order、cancel handler重複を是正した。
- Round 1再レビュー `ca48356` で4件すべて解決、新規指摘なし、未解決0件を確認し、Phase 3は承認された。
- reviewerもfrontend 97 tests、production build、Rust format / check / 22 tests、`git diff --check`を再実行し、実装側の記録と一致した。

## 9. Phase 4-a feedback対応

2026-07-29のユーザ確認では、40px固定高、状態indicator、pane間drag move、右端tabのitem全体revealは期待どおりだった。一方、tabをpointer clickした後にpointerをpreviewへ移してもhorizontal scrollbar thumbが残ることが報告され、Phase 4-aをNGとしてPhase 3へ差し戻した。

原因は`.tab-strip:focus-within`がpointer click後に残るbutton focusにも一致することだった。thumb表示条件を`.tab-strip:hover`または`.tab-strip:has(:focus-visible)`へ限定し、pointerが領域外へ出た時は隠し、keyboard focus中は表示を維持する。6px trackと40px外寸は変更しない。再確認ではpointer click後のmouse leave、keyboard focus中のmouse leave、TabStrip外へのkeyboard focus移動を確認する。

修正コミット`76daecf`はRound 2レビュー`d9ebeaa`で新規指摘0件、未解決0件として承認され、Phase 4-a再実施可となった。`:has()`は既存CSS機能より対応下限が低く互換性上のblocking riskはないが、focus-visibleのUA heuristicとscrollbar pseudo-elementの再描画は実WebViewで再確認する。

再確認では、TabStripとpreviewをpointerで上下に往復した際にthumbが残る場合と消える場合があり、素早い移動で残りやすいと報告された。`:hover`とnative scrollbar pseudo-elementのstate / repaintへpointer表示を委ねる方式を廃止し、TabStrip enter / leaveとwindow capture pointermoveの矩形判定から`tab-scrollbar-pointer-active` classを管理する。enter時にrefを同期更新してlistener登録raceを避け、ref無効時のpointermoveはgeometryを読まず即returnする。keyboard表示の`:has(:focus-visible)`は維持する。`tabStrip.ts`へ矩形境界policyとunit testを追加した。

Round 3修正`db2f066`はレビュー`55bd8b9`で新規指摘0件、未解決0件として承認され、Phase 4-a Round 3再実施可となった。Markdown previewに加えてtrusted HTML iframe境界、primary / secondary間移動、drag中、layout変更後の次pointer moveを実WebViewで確認する。

Round 3再確認ではthumbが常時表示され、native scrollbar位置で一瞬消える場合があると報告された。境界判定の向きではなく、pointer classをclearしても`:has(:focus-visible)`がtrueなら表示されるOR経路と、native scrollbar上でscroll elementのleaveが発生し得るDOM境界が原因だった。scroll elementをouter shellで包み、pointer / explicit keyboard modality stateを`shouldShowTabScrollbar`で単一classへ集約した。scrollbar表示条件から`:hover` / `:focus-within` / `:has(:focus-visible)`をすべて除去し、visibility policy 4ケースをunit testへ追加した。

Round 4実WebView確認でも症状は変わらなかった。window `pointermove`ごとにouter shell矩形からpointer stateを双方向同期し、native scrollbar上で発生する矩形内`pointerleave`を無視する補強も同じ結果だったため、StatusBarへ一時的な`TabDebug`項目を追加した。pointer / keyboard state、表示policy、実DOM class、座標の生判定、hover / focus、thumb computed background、overflow、active element、最終eventを同時採取し、event state残留とnative scrollbar描画問題を切り分ける。原因確定後に診断UIを除去して最終修正・再レビューを行う。

診断buildではthumbが正しく非表示となった。診断処理によるevent timing / repaintへの影響を切り分けるため、`TabDebug`の採取、custom event、App state、StatusBar列だけを除去した。双方向geometry同期、scrollbar内`pointerleave`無視、keyboard modality補強、transparent scrollbar backgroundは維持する。この状態をpublishして挙動を確認してから、汎用デバッグ領域の実装へ進む。

診断除去publishでthumb残留が再発したため、`View > Debug Information`で切り替える汎用`DebugPanel`を追加した。OFF時は採取処理を停止し、ON時だけTabStripがpointermoveをanimation frame単位にまとめ、geometry / focus / computed scrollbar styleを採取してgeneric entry eventを発行する。stateが変わらない領域内外の移動も最新座標として更新する。Appはprovider ID別のentryを保持し、ErrorBannerとStatusBar間の最大180px・複数行scroll領域へ表示する。`tabStrip.ts`へ4行formatterを追加し、false / unavailable値を欠落させないunit testを追加した。

実WebViewではDebug ONで正常化し、その後OFFへ戻しても正常状態が継続した。通常のscrollbar表示class transitionとtab数変更後にも、overflow時だけ次frameでlayoutとthumb computed backgroundを1回読むstyle flush effectを追加した。診断providerはOFF時に停止したままであり、workaroundは連続pointermove採取やApp再renderに依存しない。

scrollbar修正確認後の追加feedbackとして、見切れたtabをactivateしてもその隣が表示されず連続clickしにくい点へ対応した。`revealTab`は対象itemの前後refから隣接itemの中点を求め、見切れ方向の隣接tabを50%だけpeek目標へ含める。pure `getTabRevealDelta`は選択item全体を必ず優先し、先頭 / 末尾、狭幅、oversized、invalid geometryを決定的に扱う。unit testを109件から113件へ拡張した。

Round 4レビュー指摘への対応として、window `pointermove`の双方向geometry同期は最新座標だけを保持し、animation frameごとに最大1回のshell矩形readへ集約した。shell外への`pointerleave`では保留中frameと座標を破棄してからstateをclearし、iframeへ移動した直後に古い領域内座標が再適用される競合も防止する。DebugPanel eventはprovider追加だけでなくprovider削除も表現し、表示器から`tab-strip-secondary`固有判定を除去した。Debug OFF時の空entry初期化は既に空なら同一state参照を返す。
