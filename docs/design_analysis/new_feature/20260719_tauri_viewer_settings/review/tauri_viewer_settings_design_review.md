# Tauri Viewer 設定永続化・設定 UI 設計レビュー

**レビュー日**: 2026-07-19
**対象ドキュメント**: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/design/tauri_viewer_settings_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-014
**レビュー対象コミット**: `4db51a5 docs: design Tauri viewer settings persistence`
**判定**: **承認 (Approved)**。条件付き承認の全指摘を設計へ反映し、未対応事項はない。

---

## 概要

TODO-2026-014 の Phase 2 設計を、要求・受け入れ条件、既存 Tauri 実装、app config JSON / Recent Folders の互換性、PlantUML runtime 解決、window API、UI アクセシビリティ、テスト、恒久ドキュメント反映の観点で確認した。

既存 `settings.json` を型付き `AppConfig` として拡張し、Rust の Store lock 内で field-specific な read-modify-write を行う基本方針は妥当である。Theme と PlantUML path の正本を Rust app config に集約し、明示 path が壊れた際に自動探索へ逃げない判断も、既存ルールの「不具合を不要な fallback で隠さない」方針と整合する。

初回レビューでは、設定更新頻度が resize により大きく増えるにもかかわらずファイル置換の耐障害性が未設計であり、意味的に無効な window size を一部だけ既定値へ置換しつつ frontend へ warning/error を伝える契約も不足していた。これらを含む全指摘は設計へ反映済みである。

---

## 1. 齟齬・不整合

### 1.1 範囲外 window size の復旧方針を command 契約で表現できない

**重大度**: High  
**優先度**: High  
**工程分類**: design  
**status**: 対応済み

**根拠**:

- 設計書 6.1 は、width / height が範囲外なら「起動復元時は既定値を使って原因を stderr と frontend error strip に残す」とする。
- 7.3 も、無効 size では起動を失敗させず既定サイズを維持し、frontend の `load_viewer_settings` でも同じエラーを通知するとする。
- 一方、7.2 の command 契約は `load_viewer_settings -> ViewerSettings` のみで、正規化済み設定と warning を同時に返す構造を持たない。
- 6.2 は malformed JSON / 型不一致 / 未知 Theme を config 全体の parse error として保存停止する方針だが、型としては読める範囲外 size を同じ全体エラーにするのか、window size だけを既定値へ置換して Theme / PlantUML path を維持するのかが未確定である。

**影響**:

`load_viewer_settings` が `Err` を返す実装では、有効な Theme と明示 PlantUML path まで frontend へ届かない。さらに Settings dialog の window size は read-only なので、範囲外 size をどの操作で修復できるかが不明確になる。逆に `Ok(ViewerSettings)` だけを返す実装では、frontend error strip へ原因を伝える要件を満たせない。実装者ごとに config 全体の扱いと復旧挙動が分かれる。

**推奨対応**:

次のいずれかを設計書で確定する。

1. 推奨: load response を `ViewerSettingsLoadResult { settings, warnings }` のような型にし、window size だけを既定値へ正規化しつつ、有効な Theme / PlantUML path を維持して warning を frontend へ返す。resize 保存成功時に正規化値を永続化し、warning を解消する。
2. config 全体を load error とする場合は、その判断、Theme / PlantUML path も既定値になること、ユーザーが Settings / resize から安全に復旧できる具体的手順を明記する。

Rust unit test に「型は正しいが範囲外の size と、有効な Theme / path が同居する JSON」の load / warning / 修復を追加する。

**対応**: 設計書 6.1 / 6.2 / 7.2 / 7.3 / 12.1 を更新し、`ViewerSettingsLoadResult { settings, warnings }` を追加した。deserialize 可能な範囲外 size は window size だけ 800 x 600 へ正規化し、有効な Theme / jar path / Recent Folders を維持する。warning は frontend error strip へ伝え、起動時 resize の `save_window_size` 成功で JSON を修復する。malformed JSON は引き続き command `Err` として保存を停止する。対応テストも明記した。

### 1.2 resize により高頻度化する config write が非 atomic のままになっている

**重大度**: High  
**優先度**: High  
**工程分類**: design  
**status**: 対応済み

**根拠**:

- 設計書 7.1 は Store lock 内の read-modify-write と I/O error 返却を定めるが、書き込み中断時のファイル保全方式を定めていない。
- 現行 `write_app_config` は `fs::write(&config_path, content)` で既存 `settings.json` を直接 truncate / overwrite する (`src-tauri/src/lib.rs:219-228`)。
- 今回は window resize のたびに debounce 後の保存が追加され、Recent Folders のみだった現状より write 回数が大幅に増える。
- 設計書 6.2 / 手動確認 9 は malformed JSON を自動上書きしないため、書き込み中のプロセス終了・OS 障害等で JSON が途中状態になると、その後の設定保存と Recent Folders 更新が継続的に失敗する。

**影響**:

1 回の中断で Theme、window size、PlantUML path だけでなく既存 Recent Folders も同時に読み込めなくなる。lock は同一プロセス内の lost update を防ぐが、書き込み途中の破損は防げないため、受け入れ条件「既存 Recent Folders を保持」「対象 3 設定が失われない」に対するデータ保全上の穴が残る。

**推奨対応**:

`AppConfigStore` の write を同一ディレクトリ内の一時ファイルへの完全書き込み後、atomic replace / rename する方式として設計する。Windows を含む置換手順と、失敗時に既存 `settings.json` を維持する境界を明記する。可能な範囲で flush / sync の要否も決め、少なくとも「serialize または一時ファイル書き込み失敗時は既存ファイルを変更しない」ことを unit test 可能な helper 契約にする。

一時ファイル残存時の自動復旧を追加する必要はない。不要な fallback を避け、次回書き込みで安全に置換できる設計でよい。

**対応**: 設計書 7.1 / 10.1 / 12.1 / 13 を更新した。同一 directory の sibling temporary file へ全量 write / `sync_all` 後、Unix は rename、Windows は target-specific `windows-sys` の `MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)` 相当で置換する。各失敗時は既存 destination を維持して temporary file を削除する契約とし、自動復旧 fallback は追加しない。failure injection を含む unit test 観点も追加した。

---

## 2. ドキュメント不足

### 2.1 `isAppConfigBusy` と startup / resize の並行操作規則が未確定

**重大度**: Medium  
**優先度**: Medium  
**工程分類**: design  
**status**: 対応済み

**根拠**:

- 8.1 は Recent Folders と settings command の busy を単一 `isAppConfigBusy: boolean` へ統合し、重複操作を防ぐとする。
- 8.2 は起動 effect から `load_viewer_settings` と `load_recent_folders` の 2 command を実行するが、直列か並列か、boolean の set / clear を誰が所有するかを定めていない。
- 8.4 の debounce resize 保存も同じ Store を更新するが、`isAppConfigBusy` の対象に含むか、Settings 保存中に timer が発火した場合に待機・破棄・実行のどれを採るかが未記載である。
- backend lock と field-specific update によりデータ競合は防げる一方、単純な boolean を各非同期処理が個別に clear すると、別 command 実行中に UI が非 busy へ戻る可能性がある。

**影響**:

Theme 保存、Settings 保存、Recent Folders、resize 保存の UI disable と loading 表示が実装依存になり、設計が意図する「重複操作防止」と一致しない可能性がある。resize 後に MenuBar が頻繁に disabled になる UX、または Settings 保存中の size 更新を不必要に捨てる実装にもなり得る。

**推奨対応**:

- startup load は `Promise.allSettled` 相当で 1 つの startup busy scope とする、または明示的に直列化する。
- foreground 操作（Settings / Theme / Recent Folders）と background resize save の busy 表示を分けるか、operation count / operation kind で所有権を表現する。
- backend lock と部分更新を正本の競合制御とし、resize は最後の通常サイズを保存する。Settings 保存中に resize が発生した場合も、timer の cleanup / retry / final save の扱いを明記する。
- manual verification に Settings 保存と resize、Recent Folders 更新を近接して実行する競合確認を追加する。

**対応**: 設計書 8.1 / 8.2 / 8.4 / 12.2 / 13 を更新した。startup は `Promise.allSettled` の単一 scope、foreground は operation count、background resize は busy 表示から分離する。resize は backend lock と field-specific update を使い、1 command ずつ直列化して pending の最新 size を追送する。並行操作の手動確認も追加した。

---

## 3. 改善提案

### 3.1 明示 jar path の拡張子比較規則を OS 間で確定する

**重大度**: Low  
**優先度**: Low  
**工程分類**: design  
**status**: 対応済み

**根拠**:

6.1 は拡張子 `.jar` を必須とするが、大文字小文字の扱いを定めていない。Windows / macOS の一般的な filesystem では `PLANTUML.JAR` が通常ファイルとして利用できる一方、case-sensitive な文字列比較では拒否される。

**推奨対応**:

extension を Unicode ではなく ASCII case-insensitive で `.jar` と比較するか、case-sensitive に限定する場合は UI validation と interface spec に制約を明記する。unit test に `.jar` / `.JAR` を追加する。

**対応**: 設計書 6.1 / 12.1 を更新し、ASCII case-insensitive で `.jar` と比較する方針、`.jar` / `.JAR` の許可と他拡張子の拒否を確定した。

---

## 4. 受け入れ条件トレース

| 受け入れ条件 | 設計上の対応 | 確認結果 |
| --- | --- | --- |
| width / height、Theme、PlantUML path を既存 app config JSON に保存・復元 | 4.1、6、7、8.4 | ✓ typed load result と atomic replace を含め整合 |
| MenuBar から Settings を開き、確認・変更・保存 | 8.3、9.1 | ✓ Theme / path の draft、Save / Cancel、validation、focus が定義済み |
| 無効 jar path が Markdown / Mermaid 閲覧を妨げない | 7.4、8.3、12.2 | ✓ 明示 path の failure を PlantUML に限定し、fallback しない方針も整合 |
| 既存 Recent Folders と旧 JSON を保持 | 6.2、7.1、12.1 | ✓ serde default、部分更新、atomic replace で整合 |
| build / check / Rust test / 手動 UI 確認 | 12 | ✓ 必須 command と主要成功・失敗・回帰ケースが列挙済み。競合ケースは 2.1 の追加が必要 |

---

## 5. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| app config JSON を Rust 側の単一正本とし、`localStorage` を併用しない | ✓ 既存 Recent Folders の責務境界と整合 |
| `AppConfigStore.update` で lock 内 read-modify-write を共通化し、command ごとの重複 lock / serialization を増やさない | ✓ DRY / SRP と既存 Store の発展方向に整合 |
| Theme / jar path と window size を field-specific command で部分更新する | ✓ stale frontend snapshot による lost update を回避 |
| 明示 jar path が存在する場合は legacy config / colocated jar へ fallback しない | ✓ 設定不整合を顕在化する project rule と整合 |
| Theme 変更だけでは PlantUML command を再実行しない | ✓ `common_pitfalls.md` と現行 tab cache 契約に整合 |
| physical size を logical size に変換し、最大化 / 最小化 / fullscreen 中は保存しない | ✓ HiDPI と通常 window size の要件に整合 |
| Tauri `core:default` が `inner-size` / `scale-factor` / `is-maximized` / `is-minimized` / `is-fullscreen` の read permission を含む | ✓ 現行 Tauri 2.11.2 permission reference で確認。追加 capability は現時点で不要と見込まれる |
| Settings dialog の draft が保存前に Theme / runtime を変更しない | ✓ Cancel 契約と責務分離が明確 |
| malformed JSON を黙って初期化・上書きしない | ✓ Recent Folders 保全と不要な fallback 禁止に整合 |
| Avalonia 実装を TODO-2026-015 へ分離し、Tauri UX 評価後に水平展開する | ✓ TODO / meta / design の scope が一致 |
| Phase 3 の恒久ドキュメント更新先 | ✓ component docs、development workflow、必要な architecture / README が列挙済み |

---

## 6. 対応優先度

| 優先度 | 指摘 | 工程 | status | 理由 |
| --- | --- | --- | --- | --- |
| High | 1.1 無効 window size の load / warning / 復旧契約 | design | 対応済み | typed load result と部分正規化／修復契約を追加 |
| High | 1.2 config write の atomicity | design | 対応済み | platform-specific atomic replace と失敗時保全契約を追加 |
| Medium | 2.1 app config operation の busy 所有権 | design | 対応済み | startup / foreground / background resize の所有権を分離 |
| Low | 3.1 `.jar` extension の case 規則 | design | 対応済み | ASCII case-insensitive と test case を確定 |

---

## 7. 未解決事項

| ID | 質問 / follow-up | owner | 解消条件 | status |
| --- | --- | --- | --- | --- |
| U-01 | 範囲外 window size を config 全体エラーにするか、window size だけ既定値へ正規化するか | design / implementation agent | window size だけを正規化する typed load response と修復 test を設計書へ追記 | resolved |
| U-02 | `settings.json` を同一 directory の一時ファイルから atomic replace する cross-platform 手順 | design / implementation agent | 失敗時に旧ファイルを維持する write 契約を設計書へ追記 | resolved |
| U-03 | foreground config 操作と background resize save の busy / queue 規則 | design / implementation agent | startup、foreground、background resize の並行規則を設計書へ追記 | resolved |
| U-04 | `.jar` extension の case sensitivity | design / implementation agent | ASCII case-insensitive validation と test case を確定 | resolved |

---

## 8. 結論

採用案の骨格は妥当である。型付き `AppConfig`、Store lock 内の field-specific update、app config を正本とする Theme / PlantUML path、logical window size、明示 path に対する non-fallback は、TODO-2026-014 の価値と既存 Tauri アーキテクチャを自然に接続している。対象外と Avalonia follow-up、恒久ドキュメント更新、主要な自動・手動確認も十分に整理されている。

無効 window size の typed load result と部分復旧、platform-specific atomic replace、foreground / background config operation の所有権、`.jar` extension の比較規則が設計へ追記された。指摘 1.1 / 1.2 / 2.1 / 3.1 と未解決事項 U-01 から U-04 はすべて解消したため、**承認 (Approved)** とする。

**未対応指摘**: なし。

---

## 9. Round 2 検証結果

**再確認日**: 2026-07-19

**再確認対象コミット**: `628373d docs: address Tauri settings design review`

**初回レビューコミット**: `eb13890 docs: review Tauri viewer settings design`

### 9.1 初回指摘の確認

| 指摘 | 重大度 | 確認結果 | status |
| --- | --- | --- | --- |
| 1.1 範囲外 window size の load / warning / 復旧契約 | High | `ViewerSettingsLoadResult { settings, warnings }` が追加され、deserialize 可能な範囲外 size は window size だけ 800 x 600 へ正規化し、有効な Theme / jar path / Recent Folders を維持する契約になった。malformed JSON は command `Err` のまま区別される。frontend warning、`save_window_size` による永続値の修復、対応 unit test も明記され、初回指摘を解消している。 | resolved |
| 1.2 config write の atomicity | High | sibling temporary file への全量 write / `sync_all` 後に destination を置換する契約が追加された。Unix の same-directory rename、Windows の `MoveFileExW(REPLACE_EXISTING \| WRITE_THROUGH)` 相当、失敗時の旧 destination 維持と temporary file 削除、target-specific dependency、failure test が明記され、初回指摘を解消している。 | resolved |
| 2.1 app config operation の busy 所有権 | Medium | startup は `Promise.allSettled` 相当の単一 scope、foreground は functional update による operation count、background resize は busy 表示から分離された直列 queue として定義された。pending 最新 size の追送と revision guard、近接操作の手動確認も追加され、初回指摘を解消している。 | resolved |
| 3.1 `.jar` extension の case 規則 | Low | ASCII case-insensitive 比較を採用し、`.jar` / `.JAR` を許可、他拡張子を拒否する契約と unit test が明記され、初回指摘を解消している。 | resolved |

### 9.2 未解決事項の確認

| ID | 確認結果 | status |
| --- | --- | --- |
| U-01 | typed load response、window size の部分正規化、warning、有効設定の維持、`save_window_size` による修復、unit test が確定した。 | resolved |
| U-02 | cross-platform atomic replace と失敗時に旧 config を維持する write 契約が確定した。 | resolved |
| U-03 | startup / foreground / background resize の busy・直列化・pending 規則が確定した。 | resolved |
| U-04 | ASCII case-insensitive validation と `.jar` / `.JAR` test が確定した。 | resolved |

### 9.3 新規自己矛盾の確認

`628373d` の design / review / meta 差分を、初回指摘への対応箇所とその隣接契約に限定して再確認した。次の接続が一貫している。

- `ViewerSettingsLoadResult` は Rust model、Tauri command、frontend startup、unit test の各記載で同じ `settings + warnings` 契約を使う。
- atomic write は Store 責務、platform dependency、failure test、リスク対策で同じ「成功時だけ全体置換、失敗時は旧 destination 維持」を使う。
- foreground operation count は UI busy の所有権だけを扱い、background resize の正しさは frontend の単一 command queueと backend Store lock / field-specific update に委ねるため、責務が重複しない。
- `meta.md` の対象範囲、依存関係、follow-up は設計変更後も維持され、Avalonia 水平展開を本案件へ混入させていない。

新たな重大な自己矛盾は確認されなかった。

### 9.4 最終判定

初回指摘 1.1 / 1.2 / 2.1 / 3.1 と未解決事項 U-01〜U-04 はすべて解消した。Phase 3 の実装へ引き継げる具体性があり、追加の条件はない。

**最終判定**: **承認 (Approved)**。

**未解決指摘数**: **0**。
