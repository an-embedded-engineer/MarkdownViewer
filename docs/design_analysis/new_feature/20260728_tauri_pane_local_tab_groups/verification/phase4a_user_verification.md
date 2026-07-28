# TODO-2026-023 Phase 4-a ユーザ動作確認

## 実施日

2026-07-28〜2026-07-29

## 初回確認

ユーザはpane-local tab追加・選択・close・pane間moveを実機確認した。機能自体は動作したが、操作反復時にTabStripが低く見える場合と、Error / Rendering表示があるpaneと無いpaneでpreview上端に段差が生じることを報告した。この結果をNGとしてPhase 3へ差し戻した。

## 原因と修正

- 原因: primary / secondaryの`.document-pane`がTabStrip rowを`auto`で個別計算し、name 1行、state 2行、empty、horizontal scrollbarの有無で高さが変動していた。
- 修正: `cea681a`でTabStrip rowを58px固定高とし、name / state line-heightを固定した。
- レビュー: `025a81b`でApproved、未解決指摘0件。自動検証6コマンドも再現した。

## 再確認結果

2026-07-29、ユーザは次を確認した。

- TabStripの高さが一定になった。
- TabStripが低くなりすぎる現象が発生しなくなった。

以上によりPhase 4-aを合格とし、Phase 4-bへ進む。

## Follow-up

ユーザから、現在の機能範囲を変えずに別アイテムで扱う改善として次が提案された。`TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善`へ登録した。

1. Errorの赤いindicatorをtab下端から上端へ移す。
2. Rendering / Errorのvisible textを廃止し、上端indicatorだけで状態を表す。
3. 1行表示に合わせてTabStripをcompact化する。
4. horizontal scrollbarをhover / focus時だけ表示する。
5. overflow中にtabを選択した時、titleだけでなくmove / close buttonを含むtab item全体を表示範囲へscrollする。
6. 既存move buttonをkeyboard代替として残しつつ、pane間drag and drop移動を追加する。
