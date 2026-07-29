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
