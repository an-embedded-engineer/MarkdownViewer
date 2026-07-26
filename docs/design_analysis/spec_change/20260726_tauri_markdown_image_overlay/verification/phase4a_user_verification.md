# Phase 4-a ユーザー動作確認

## 確認日

2026-07-26

## 初回確認結果

ユーザーがTauri版アプリを起動し、次を実機で確認した。

| 観点 | 結果 |
| --- | --- |
| 通常画像、Mermaid、PlantUMLでcursorが拡大表示へ変わる | PASS |
| visual clickでImage Viewerがoverlay表示される | PASS |
| button、mouse、keyboardでzoom / panできる | PASS |
| Close buttonまたはEscapeでviewerを閉じられる | PASS |
| viewer close後のfocus復帰表示 | NG。pointer起点でも右上へ`Open image viewer` pillが表示され、用途が分かりにくい |

## 判断と対応

`Open image viewer`はTab移動で利用するkeyboard用native buttonであり、keyboard起点のclose後にfocusを戻して表示すること自体は必要である。一方、pointer起点でも同buttonへfocusを戻す必要はなく、通常のマウス操作へkeyboard専用UIが突然現れる原因になっていた。

Phase 4-aを一度NGとしてPhase 3相当へ戻し、activationをpointer / keyboardに分ける。close後はkeyboard起点だけ隣接buttonへ戻し、pointer起点はactive previewへ戻す。修正・自動検証・追加レビュー後に、該当2経路のユーザー再確認を依頼する。

追加レビューで、pointer起点をEscapeで閉じるとengineによってprogrammatic focus先のMarkdown本文全体へoutlineが出る可能性が指摘された。再確認前に`.markdown-body:focus { outline: none }`を追加し、次の再確認対象へ含める。

- pointerで開き、Close / Escapeで閉じてもpillと本文全体outlineが表示されない。
- Tabで`Open image viewer` buttonへ移動し、Enter / Spaceで開いてClose / Escapeで閉じると同buttonへfocusが戻る。

## 再確認結果

修正後のユーザー実機再確認で次を確認した。

| 観点 | 結果 |
| --- | --- |
| pointer clickでviewerを開いた場合、close後に`Open image viewer` pillが表示されない | PASS |
| Tab移動で`Open image viewer` pillが表示される | PASS |
| pillをEnter / Spaceでactivateするとviewerが開く | PASS |
| keyboard起点でviewerを閉じた後、同じpillがfocusされた状態で残る | PASS |

初回確認でPASSだった通常画像、Mermaid、PlantUMLのopen、zoom / pan、Close / Escape操作とあわせ、Phase 4-aのユーザー動作確認は完了とする。未解決事項はない。
