# TODO-2026-026 Phase 3 implementation review follow-up (Round 3 / Phase 4-a second feedback)

あなたはレビュー担当 Agent です。レビューを他Agentやskillへ再委譲せず、自身で確認し、既存レビュー文書の更新とコミットまで行ってください。

## 対象

- workflow: new-feature
- item: TODO-2026-026 Tauri TabStrip 状態表現・scroll・drag move UX改善
- fix commit: `db2f066 Phase 3 stabilize TabStrip scrollbar pointer boundary`
- existing review: `docs/design_analysis/new_feature/20260729_tauri_tabstrip_ux/review/tauri_tabstrip_ux_impl_review.md`

## Round 2 feedback

Round 1の`:hover` + `:has(:focus-visible)`修正後も、TabStripとpreviewをpointerで上下に往復するとthumbが残る場合と消える場合がありました。素早い移動ほど残りやすく、scrollbar位置で停止してからpreviewへ移すと消えやすい傾向でした。Phase 4-aは引き続きNGとしてPhase 3へ差し戻しています。

## Round 3 implementation

- pointer表示のsource of truthからCSS`:hover`を除去。
- TabStrip `pointerenter`でrefとReact stateを同期更新し、`pointerleave`でclear。
- window capture `pointermove` listenerをmount中は維持し、ref有効中だけstrip rectとclient座標をpure policyで比較。
- 領域外の最初のmoveまたはwindow blurでもref / stateをclear。
- ref無効時はgeometryを読まず即return。
- CSSは`.tab-scrollbar-pointer-active` classとkeyboard用`:has(:focus-visible)`だけを参照。
- `tabStrip.ts`へ`isPointInsideTabStrip`を追加し、境界とinvalid geometryをunit test。

## レビュー観点

1. 高速enter→leaveでlistener登録待ちのraceがないか。
2. pointerenter / pointerleave、window pointermove / blur、unmount cleanupでstale classが残らないか。
3. primary / secondary間移動、native scrollbar上通過、pointer capture中、preview iframe境界で矛盾しないか。
4. listener常設でもref無効時にlayout readせず、性能上妥当か。
5. pure geometry policyのfinite / ordering / edge規則が妥当か。
6. keyboard `:focus-visible`、6px track、40px外寸、reveal、drag、indicatorに非退行か。
7. design / permanent docs / impl / meta / verificationがRound 2 NGとRound 3再確認条件を一貫して記録しているか。
8. Phase 3を承認し、Phase 4-a Round 3再実施へ進めるか。

実装担当の検証結果:

- `npm test -- --run`: 6 files / 104 tests passed
- `npm run build`: success（既存chunk size warningのみ）
- `cargo fmt -- --check`: success
- `cargo check`: success
- `cargo test`: 22 tests passed
- `git diff --check`: success

## 出力要件

- 既存レビュー文書へ「Phase 4-a feedback / Round 3」節を追記。
- severity、blocking、原因、修正妥当性、残リスク、再確認観点、新規・未解決件数、Phase判定を明記。
- レビュー文書以外を変更しない。
- レビュー文書の更新だけをコミットする。
