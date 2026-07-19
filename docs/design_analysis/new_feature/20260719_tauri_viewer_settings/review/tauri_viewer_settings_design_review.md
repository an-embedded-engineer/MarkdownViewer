# Tauri Viewer 設定永続化・設定 UI 設計レビュー

**レビュー日**: 2026-07-19
**対象ドキュメント**: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/design/tauri_viewer_settings_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-014
**レビュー対象コミット**: `4db51a5 docs: design Tauri viewer settings persistence`
**判定**: **条件付き承認 (Conditional approval)**。Phase 3 着手前に 1.1、1.2 を設計へ反映し、2.1 の並行操作規則も確定すること。

---

## 概要

TODO-2026-014 の Phase 2 設計を、要求・受け入れ条件、既存 Tauri 実装、app config JSON / Recent Folders の互換性、PlantUML runtime 解決、window API、UI アクセシビリティ、テスト、恒久ドキュメント反映の観点で確認した。

既存 `settings.json` を型付き `AppConfig` として拡張し、Rust の Store lock 内で field-specific な read-modify-write を行う基本方針は妥当である。Theme と PlantUML path の正本を Rust app config に集約し、明示 path が壊れた際に自動探索へ逃げない判断も、既存ルールの「不具合を不要な fallback で隠さない」方針と整合する。

一方、設定更新頻度が resize により大きく増えるにもかかわらず、ファイル置換の耐障害性が未設計である。また、意味的に無効な window size を一部だけ既定値へ置換しつつ frontend へ warning/error を伝える契約が、現在の `load_viewer_settings -> ViewerSettings` では表現できない。この 2 点は保存データ保全と起動時復旧に直結するため、Phase 3 前の解消を条件とする。

---

## 1. 齟齬・不整合

### 1.1 範囲外 window size の復旧方針を command 契約で表現できない

**重大度**: High  
**優先度**: High  
**工程分類**: design  
**status**: 未対応

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

### 1.2 resize により高頻度化する config write が非 atomic のままになっている

**重大度**: High  
**優先度**: High  
**工程分類**: design  
**status**: 未対応

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

---

## 2. ドキュメント不足

### 2.1 `isAppConfigBusy` と startup / resize の並行操作規則が未確定

**重大度**: Medium  
**優先度**: Medium  
**工程分類**: design  
**status**: 未対応

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

---

## 3. 改善提案

### 3.1 明示 jar path の拡張子比較規則を OS 間で確定する

**重大度**: Low  
**優先度**: Low  
**工程分類**: design  
**status**: 未対応

**根拠**:

6.1 は拡張子 `.jar` を必須とするが、大文字小文字の扱いを定めていない。Windows / macOS の一般的な filesystem では `PLANTUML.JAR` が通常ファイルとして利用できる一方、case-sensitive な文字列比較では拒否される。

**推奨対応**:

extension を Unicode ではなく ASCII case-insensitive で `.jar` と比較するか、case-sensitive に限定する場合は UI validation と interface spec に制約を明記する。unit test に `.jar` / `.JAR` を追加する。

---

## 4. 受け入れ条件トレース

| 受け入れ条件 | 設計上の対応 | 確認結果 |
| --- | --- | --- |
| width / height、Theme、PlantUML path を既存 app config JSON に保存・復元 | 4.1、6、7、8.4 | △ 基本方針は整合。無効 size の load / warning 契約は 1.1、書き込み耐障害性は 1.2 が未解決 |
| MenuBar から Settings を開き、確認・変更・保存 | 8.3、9.1 | ✓ Theme / path の draft、Save / Cancel、validation、focus が定義済み |
| 無効 jar path が Markdown / Mermaid 閲覧を妨げない | 7.4、8.3、12.2 | ✓ 明示 path の failure を PlantUML に限定し、fallback しない方針も整合 |
| 既存 Recent Folders と旧 JSON を保持 | 6.2、7.1、12.1 | △ serde default と部分更新は整合。direct overwrite の破損リスクは 1.2 参照 |
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
| High | 1.1 無効 window size の load / warning / 復旧契約 | design | 未対応 | command 契約のままでは設計書記載を同時に満たせず、有効な別設定まで失う実装になり得る |
| High | 1.2 config write の atomicity | design | 未対応 | resize で write 頻度が増え、単一ファイル破損が Recent Folders と全設定へ波及する |
| Medium | 2.1 app config operation の busy 所有権 | design | 未対応 | 複数 command と background resize が単純 boolean では正しく合成できない |
| Low | 3.1 `.jar` extension の case 規則 | design | 未対応 | OS 間で validation 結果が実装依存になる |

---

## 7. 未解決事項

| ID | 質問 / follow-up | owner | 解消条件 | status |
| --- | --- | --- | --- | --- |
| U-01 | 範囲外 window size を config 全体エラーにするか、window size だけ既定値へ正規化するか | design / implementation agent | load response、warning、修復手順、unit test を設計書へ追記 | open |
| U-02 | `settings.json` を同一 directory の一時ファイルから atomic replace する cross-platform 手順 | design / implementation agent | 失敗時に旧ファイルを維持する write 契約を設計書へ追記 | open |
| U-03 | foreground config 操作と background resize save の busy / queue 規則 | design / implementation agent | startup、Settings、Theme、Recent Folders、resize の並行規則を設計書へ追記 | open |
| U-04 | `.jar` extension の case sensitivity | design / implementation agent | validation 規則と test case を確定 | open |

---

## 8. 結論

採用案の骨格は妥当である。型付き `AppConfig`、Store lock 内の field-specific update、app config を正本とする Theme / PlantUML path、logical window size、明示 path に対する non-fallback は、TODO-2026-014 の価値と既存 Tauri アーキテクチャを自然に接続している。対象外と Avalonia follow-up、恒久ドキュメント更新、主要な自動・手動確認も十分に整理されている。

ただし、無効 window size の部分復旧と frontend 通知を現在の command 戻り値で表現できない自己不整合 (1.1)、および高頻度 resize 保存に対する atomic write の欠落 (1.2) は、データ保全と復旧性に直結する。いずれも設計方針を局所的に補強すれば解消できるため、**条件付き承認 (Conditional approval)** とする。

Phase 3 着手前に 1.1 / 1.2 を設計書へ反映し、2.1 の並行操作規則も確定すること。3.1 は同時対応を推奨するが、Phase 3 の validation 実装・interface spec 反映時の解消でもよい。

**未対応指摘**: 1.1 (High)、1.2 (High)、2.1 (Medium)、3.1 (Low)。
