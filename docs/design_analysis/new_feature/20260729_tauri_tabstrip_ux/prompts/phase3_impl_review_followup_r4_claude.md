# TODO-2026-026 Phase 3 implementation review follow-up (post Round 3 changes)

あなたはレビュー担当 Agent です。

重要:

- このレビューを別のCLI Agent、review automation skill、orchestrator skill、tmux sessionへ再委譲してはいけません。
- あなた自身が必要なファイルとgit差分を読み、既存レビュー文書を更新し、コミットしてください。
- workflow skillは作業実行者向けPhase手順として起動せず、レビュー観点として必要な範囲だけ参照してください。
- レビュー文書以外の実装・設計・meta文書は変更しないでください。

## 対象

- workflow: new-feature
- review kind: Phase 3 implementation and permanent documentation follow-up review
- tracking item: `docs/todo/todo.md` TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善
- issue directory: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/`
- existing review document: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/review/tauri_tabstrip_ux_impl_review.md`
- last reviewer commit: `55bd8b9 Phase 3 review follow-up TabStrip scrollbar pointer boundary`
- review range: `55bd8b9..d0d45bf`
- current implementation commit: `d0d45bf Phase 3 reveal adjacent tab context`

`git diff 55bd8b9..d0d45bf`と現在の関連ファイル全文を確認してください。`8b119ed`は前回レビュー確定記録、その後の実装変更は`8c91e10`から`d0d45bf`です。

## 変更概要

1. native scrollbarを含むouter shellをpointer境界にし、pointer / explicit keyboard modalityを単一visibility classへ集約。
2. window pointermoveによる双方向geometry同期、native scrollbar上の擬似pointerleave無視、transparent scrollbar backgroundを追加。
3. StatusBar一時診断で症状が消えることを確認後、診断を除いたbuildで再発することを確認。
4. `View > Debug Information`で切り替える汎用の複数行DebugPanelとTabStrip providerを追加。OFF時は診断採取を停止し、ON時だけrAF、geometry / computed style read、generic entry event、App再renderを行う。
5. Debug ONで正常化しON→OFF後も正常が継続した実機結果から、WKWebView native scrollbarの初回style / paint invalidation不足と分析。
6. 通常経路で`isScrollbarVisible`またはtab数変更後、overflow時だけ次frameにlayoutと`::-webkit-scrollbar-thumb` computed styleを1回読む明示flushを追加。実機で起動直後Debug OFF / ONとも正常と確認済み。
7. 見切れtabのactivate時、選択item全体に加えて見切れ方向の隣接tabを50%表示するcontext revealを追加。先頭 / 末尾は従来どおり、幅不足時は選択item全体を優先。実機で期待どおりと確認済み。
8. pure policy testは合計113件、Rust testは22件。恒久docs、設計、実装記録、検証記録、metaを同期。

## 重点レビュー観点

`ai-review-response-workflow/references/procedure/review_checkpoints.md`相当の観点に加え、次を重点確認してください。

1. scrollbar visibility stateのevent順、stale closure、primary / secondaryのglobal listener相互干渉、touch / drag capture / iframe / split lifecycle。
2. Debug OFF時に診断rAF、layout / computed style read、custom event、App state更新が本当に停止していること。ON/OFF切替、unmount、rAF cleanup、stale provider entry、menu accessibility、conditional grid rows。
3. 通常経路のWebKit style flushが必要最小限で、infinite render、pointermoveごとの負荷、scroll位置変更、layout thrash、non-WebKit回帰を生まないこと。
4. `getTabRevealDelta`のoptional context geometry、符号、clamp、oversized、先頭 / 末尾、非常に狭いviewport、padding、invalid / non-finite入力。
5. DOM integrationが前後itemの正しいrect / midpointを渡し、pointer click、keyboard roving、move / close focus、activeTab effectで振動や二重scrollを起こさないこと。
6. 40px固定高、6px track、indicator、drag move / cancel、item全体reveal、preview / Explorer / app shell非scrollの回帰。
7. 設計・実装・verification・恒久docs・metaが、試行履歴と最終仕様を矛盾なく記録していること。obsoleteな説明や誤ったtest件数が残っていないこと。
8. 新規関数・generic debug event / entryの責務、型安全性、将来provider拡張性、不要な重複 / fallbackがないこと。

## 検証済み

- `npm test -- --run`: 6 files / 113 tests passed
- `npm run build`: success（既存chunk size warningのみ）
- `cargo fmt -- --check`: success
- `cargo check`: success
- `cargo test`: 22 passed
- `git diff --check`: success
- 実Tauri WebView: scrollbarは起動直後Debug OFF / ONとも領域内だけ表示され、領域外で非表示
- 実Tauri WebView: 見切れ方向の隣接tab 50% peekが期待どおり動作

## 成果物

既存レビュー文書へ新しいfollow-up節を追記してください。各findingについてseverity、blocking、根拠、推奨対応、状態を明記し、次を集計してください。

- 新規指摘件数
- 未解決指摘件数
- 残リスク
- Phase 3承認可否
- Phase 4-a確認済み結果を踏まえてPhase 4-bへ進めるか

レビュー文書だけをcommitし、commit hashを最終回答へ記載してください。
