# TODO-2026-026 Phase 4-a ユーザ動作確認

## 初回確認（2026-07-29）

ユーザは実Tauri WebViewで次を期待どおりと確認した。

1. TabStripが適切な40px固定高を維持する。
2. 正常完了は青線、読み込み中は左右移動する青線、エラーは赤線としてtab上端に表示される。
3. drag and dropで左右pane間をtab移動できる。
4. 右端tabのclickでclose buttonまで含むitem全体が表示される。

一方、overflow時のhorizontal scrollbar thumbについて、tabをpointer clickした後にpointerをpreviewへ移動しても表示が残ることが確認された。scrollbarを操作してfocus状態が変わると非表示になった。

この結果をPhase 4-a NGとしてPhase 3へ差し戻した。原因はpointer click後もbutton focusが残り、CSSの`:focus-within`が一致し続けることにある。

## 再確認条件

- overflowしたTabStripへpointerを置くとthumbが表示され、pointer clickでtabを選択した後にpointerをpreviewへ移動すると非表示になる。
- keyboardでTabStrip内controlへfocusした場合はpointerが領域外でもthumbが表示され、keyboard focusをTabStrip外へ移すと非表示になる。
- 6px track、40px固定高、indicator、item全体reveal、drag moveに退行がない。

## Round 2 再確認（2026-07-29）

Round 1修正後は若干消えやすくなったが、TabStripとpreviewをpointerで上下に往復するとthumbが残る場合と消える場合があり、問題は解消しなかった。素早く移動すると残りやすく、scrollbar位置で一旦停止してからpreviewへ移すと消えやすい傾向が報告された。

Phase 4-aは引き続きNGとし、Phase 3へ再差し戻した。Round 3ではpointer表示をCSS `:hover`から明示的なpointer境界stateへ変更する。

### Round 3 再確認条件

- TabStripとpreviewを低速・高速で繰り返し往復しても、pointerがTabStrip外にある間はthumbが残らない。
- scrollbar上で停止する場合、停止せず通過する場合、tabをclickしてfocusが残る場合のすべてで同じ結果になる。
- keyboard focus中の表示、6px track、40px固定高、indicator、item全体reveal、drag moveに退行がない。

## Round 3 再確認結果（2026-07-30）

Round 3修正後はthumbが消えず常時表示される状態となった。native scrollbar位置へpointerを置くと一瞬消える場合があるが、毎回ではなかった。Phase 4-aは引き続きNGとしてPhase 3へ差し戻した。

境界policyの向きはunit testどおり正しい。常時表示はpointer stateとは独立した`:has(:focus-visible)`経路がtrueを維持したためで、scrollbar上の一瞬の非表示はnative scrollbarがscroll elementのpointer境界から外れる場合があるためと分析した。

### Round 4 再確認条件

- app起動直後、pointerがTabStrip外にありkeyboard focusもない時はthumbが隠れている。
- pointerがouter shell内にある間は、tab item上・native scrollbar上のどちらでもthumbが安定して表示される。
- pointerをpreviewへ移すと移動速度によらずthumbが隠れ、tab click後のfocusだけでは表示が残らない。
- keyboardでTabStrip内へfocusした場合だけpointerが外でも表示され、pointer clickまたはTabStrip外へのfocus移動で隠れる。
- Markdown / trusted HTML、左右pane、drag、6px track、40px固定高、indicator、item revealに退行がない。

## Round 4 再確認結果と診断（2026-07-30）

outer shellと明示的なpointer / keyboard stateへ一本化した後も、pointerがTabStrip外にある間にthumbが表示されたままとなり、native scrollbar付近で一瞬だけ消える場合がある症状は変わらなかった。window `pointermove`ごとにshell矩形からinside stateを双方向同期し、native scrollbar上の`pointerleave`を矩形内なら無視する補強後も同じ結果だった。Phase 4-aは引き続きNGとし、Phase 3で実WebViewの状態を観測する。

一時診断としてStatusBarへ`TabDebug`を追加する。primary / secondary paneごとに、React state (`ptr`, `kbd`, `show`)、実DOM class (`class`)、最終pointer座標のshell矩形判定 (`raw`)、CSS `:hover` (`hover`)、DOM focus包含 (`focus`)、thumbのcomputed background (`thumb`)、overflow (`overflow`)、active element、最終event、座標を表示する。値が長い場合はStatusBar項目のtooltipで全文を確認する。

切り分け基準は次のとおり。

- `show=0 class=0`なのにthumbが見える場合は、Reactの表示論理ではなくnative scrollbarの描画・repaintまたはpseudo-element style適用を疑う。
- TabStrip外で`show=1`の場合は、`ptr` / `kbd` / `raw` / `focus` / `event`から残留したstate経路を特定する。
- `show=0 class=1`の場合はReact renderとDOM class同期を疑う。
- `ptr`と`raw`が異なる場合はpointer eventとshell geometry同期を疑う。
- `focus=0 kbd=1`の場合はkeyboard focus stateのcleanupを疑う。

診断buildの実WebView確認では、それまで再現していたthumb残留が発生せず、TabStrip外で正しく非表示になった。診断コードがevent timingまたはrepaintへ影響した可能性を分離するため、まず`TabDebug`のstate収集・event発行・StatusBar表示だけを除去し、Round 4の双方向geometry同期とtransparent scrollbar backgroundは維持したbuildをpublishして再確認する。

診断処理を除去したpublish版ではthumb残留が再発した。表示classへ使うReact stateはDOM出力として観測可能でありRelease buildのdead-code elimination対象ではない。一方、診断処理に含まれた`requestAnimationFrame`、layout / computed style read、custom event、App再renderはnative scrollbarのstyle再評価・repaint timingを変える。このため最適化によるstate消失ではなく、診断副作用で隠れるWebKit native scrollbarの描画依存として扱う。

次のbuildでは`View > Debug Information`をOFFにすると診断処理を停止し、ONにするとErrorBannerとStatusBarの間へ複数行パネルを表示して診断を開始する。起動後OFFのまま残留を再現し、その場でONへ切り替えて、パネル値とthumbの変化を同時に確認する。
