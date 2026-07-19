# Tauri Viewer 設定永続化・設定 UI 実装レビュー

**レビュー日**: 2026-07-19

**対象コミット**: `0923219 feat: persist Tauri viewer settings`

**対象設計**: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/design/tauri_viewer_settings_feature_design.md`

**対象実装記録**: `docs/design_analysis/new_feature/20260719_tauri_viewer_settings/impl/tauri_viewer_settings_feature_impl.md`

**対象 source / docs / tests**: `0923219` の commit 差分全体

**判定**: **条件付き承認 (Conditional approval)**。1.1、1.2、1.3 を解消し、2.1〜2.3 を source / tests / docs へ反映して再レビューすること。

---

## 概要

TODO-2026-014 の Phase 3 実装を、要求・Phase 2 設計との適合、Rust `AppConfigStore` / serde migration / atomic replace / Windows API、PlantUML path precedence、React startup / foreground operation count / resize queue / Settings dialog accessibility、error handling、tests、恒久ドキュメントの観点で確認した。

型付き `AppConfig`、既存 Recent Folders JSON の serde default migration、field-specific update、明示 PlantUML path の non-fallback、startup settings load、Theme 保存、single-flight resize queue、Settings dialog の主要操作は設計に沿っている。ローカル環境で `npm run build`、`cargo check`、`cargo test` (8 tests)、`cargo fmt -- --check` の成功も再確認した。

一方、設計と TODO が Phase 3 前提としていた TODO-2026-006 Split view は未完了であり、想定 pane state への統合と回帰を確認できない。atomic replace 後の directory sync failure は「失敗時に旧 config を維持する」契約を満たさず、Settings 保存中は dialog 内の focusable control がゼロになって background へ keyboard focus が漏れ得る。この 3 点は Phase 3 完了前の修正・再確認を必須とする。

---

## 1. 齟齬・不整合

### 1.1 必須依存の Split view が未完了のまま Phase 3 を実施している

**重大度**: High
**優先度**: High
**工程分類**: design
**status**: 未対応

**根拠**:

- `docs/todo/todo.md` の TODO-2026-014 は `depends_on: TODO-2026-006` とする。
- Phase 2 設計 10.2 は「TODO-2026-006 の Split view が Phase 3 着手前に完了していることを前提」と明記し、pane state を回帰対象へ追加している。
- 2026-07-19 現在、TODO-2026-006 は `status: open` である。
- 実装記録 8 は Split view 未完了のため回帰確認不能と記録している。現行 `App.tsx` も単一 preview pane の state / UI のままである。

**影響**:

設定 state、dialog modal 化、global busy、Theme 更新、Mermaid 再描画、resize 時の layout が、設計が統合対象とした primary / secondary pane state 上で検証されていない。後から TODO-2026-006 を実装すると、同じ `App.tsx` / `App.css` / component docs に大きな差分が入り、本実装の回帰と docs 再同期が必要になる。現状では設計の最小提供範囲と回帰条件を満たしたとは判定できない。

**推奨対応**:

次のいずれかを workflow 上で明示的に選ぶ。

1. TODO-2026-006 を完了後、本 branch を最新 Split view 実装へ統合し、両 pane の Markdown / Mermaid / PlantUML / Theme / loading / error と Settings modal を再検証する。
2. 実行順を変更する必要がある場合は、TODO / WBS / Phase 2 設計の dependency と「Phase 3 着手前」条件を正式に改訂・レビューし、Split view 統合を具体的 follow-up の完了条件へ移す。

単に Phase 4 へ確認を先送りするだけでは、Phase 3 の実装統合点が未確定のままなので解消扱いにしない。

### 1.2 directory sync 失敗時に destination は更新済みだが command は `Err` になる

**重大度**: High
**優先度**: High
**工程分類**: impl
**status**: 未対応

**根拠**:

- 設計 7.1、component basic/detail design、実装記録は、atomic write の失敗時に既存 `settings.json` を維持する契約を記載している。
- `write_app_config_to_path` は temporary file の `sync_all` 後、`replace_app_config_file` で destination を置換し、その後 `sync_app_config_directory` を `?` で実行する (`src-tauri/src/lib.rs:377-395`)。
- Unix の directory `sync_all` が失敗すると、destination は既に新 file へ置換済みだが関数は `Err` を返す。error cleanup は temporary path の削除だけで、旧 destination へ戻せない。
- frontend は Theme / Settings で command `Err` の場合に UI state を更新せず dialog を維持する一方、次回起動時には実際に書かれた新設定が反映される。Recent Folders でも UI は失敗扱いだが entry が保存済みになり得る。

**影響**:

「保存失敗ならアプリ表示と永続値は変わらない」という UI / Store 契約が崩れ、ユーザーに失敗を表示した操作が再起動後に適用される。basic design の「失敗時は既存 file 維持」および初回設計レビューで確定したデータ保全契約とも不整合である。

**推奨対応**:

rename / `MoveFileExW` 成功後は commit point を越えたものとして扱う。directory sync failure を logical save failure にしないで原因を stderr warning として残す、または command response に「保存済みだが durability warning」を表現して frontend state を保存値へ同期できる契約にする。旧 file 維持を保証する failure boundary は serialize / temporary create / write / temporary `sync_all` / replace 失敗までとし、design と恒久 docs も正確に揃える。

replace 成功後の directory sync failure を注入できる helper 境界を作り、command と永続値が食い違わない test を追加する。

### 1.3 Settings 保存中に modal focus trap が成立しない

**重大度**: High
**優先度**: High
**工程分類**: impl
**status**: 未対応

**根拠**:

- 設計 8.3 は dialog 表示中に background content を操作不可とし、保存中は二重操作を無効化する。
- `SettingsDialog` は `isSaving` 中、select / input / Browse / Clear / Cancel / Save / close の全 control を disabled にする (`App.tsx:1077-1159`)。
- focus loop は enabled control だけを query し、0 件なら何もせず return する (`App.tsx:1036-1043`)。dialog container 自体には `tabIndex` がない。
- `isSaving` 変更時に effect が再実行され、disabled になった Theme select へ focus を試みる (`App.tsx:1023-1057`)。focus が body へ移った状態で Tab を押すと、`.app-shell` は `aria-hidden` であるだけで `inert` ではないため、background の button / tab 等が keyboard focus 対象になり得る。

**影響**:

config I/O が遅い、または停止している間に keyboard focus が modal 外へ出て background を操作できる。これは dialog の `aria-modal="true"`、設計の背景操作不可、保存中二重操作抑止に反する。支援技術上 hidden な領域へ visible keyboard focus が移るアクセシビリティ不整合にもなる。

**推奨対応**:

- background app shell に実際の `inert` を設定し、`aria-hidden` と併用する。
- dialog container を `tabIndex={-1}` で focusable にし、保存開始時は container または保存状態の status elementへ focus を移す。
- enabled controls が 0 件でも Tab / Shift+Tab を prevent して dialog 内に focus を保持する。
- Settings dialog test を追加し、通常時の loop、保存開始後、全 control disabled、Escape 無効、保存完了 / error 後の focus、close 後の File trigger focus return を確認する。

---

## 2. テスト・ドキュメント不足

### 2.1 atomic write failure test が設計で列挙した境界を網羅していない

**重大度**: Medium
**優先度**: Medium
**工程分類**: impl
**status**: 未対応

**根拠**:

- 設計 12.1 は serialize / temporary write / sync / replace の各失敗で旧 config を維持する test を要求する。
- 実装 test は正常置換と、既存 temporary file collision による `create_new` failure の 2 ケースだけである (`lib.rs:1105-1159`)。
- temporary `write_all` failure、temporary `sync_all` failure、replace failure、directory sync failure は直接検証されない。
- Windows `MoveFileExW` branch は `#[cfg(windows)]` であり、実装記録の検証環境と今回の再検証はいずれも `aarch64-apple-darwin` のみである。Windows target の compile check / test 証跡がない。

**推奨対応**:

filesystem operation を限定的な test seam / helper へ分離し、少なくとも pre-commit failure と post-replace warning の境界を failure injection で確認する。Windows CI または Windows 実機で target-specific dependency、`MoveFileExW` 呼び出し、既存 destination の置換、missing destination、Unicode / verbatim path を build / test する。実装記録は実施済みの範囲だけを記載する。

### 2.2 PlantUML runtime 解決失敗の command 契約が interface spec と一致しない

**重大度**: Medium
**優先度**: Medium
**工程分類**: impl
**status**: 未対応

**根拠**:

- `render_plantuml_diagrams` は blocking task 前に `store.plantuml_runtime(&app)?` を実行する (`lib.rs:219-230`)。明示 jar missing、malformed app config、自動探索失敗は command 全体の `Err` になる。
- `docs/components/tauri_viewer/interface_spec.md` は、jar 未設定を PlantUML 構文 error / timeout と同じ「図ごとの `PlantUmlDiagramResult { ok: false }`」として返すと記載する。
- frontend は command `Err` を source 数分の error HTML へ変換するため UI は継続するが、公開 command response の型と docs は一致していない。

**推奨対応**:

command 開始時に runtime を 1 回だけ解決する現設計を維持するなら、runtime / app config 解決 failure は command-level `Err` であることを interface spec と detail design に明記する。図単位 result は runtime 解決後の PlantUML 構文 error / timeout 等に限定する。対応する Rust command test または frontend mapping test を追加する。

### 2.3 Settings の jar file picker failure が未処理

**重大度**: Medium
**優先度**: Medium
**工程分類**: impl
**status**: 未対応

**根拠**:

- `browsePlantUmlJar` は `openDialog(...)` を `await` するが `try/catch` を持たない (`App.tsx:311-324`)。
- handler は `onBrowsePlantUmlJar={() => void browsePlantUmlJar()}` で Promise を待たないため、plugin / OS dialog failure は unhandled rejection となり、dialog 内 `role="alert"` に表示されない。
- project rule は I/O failure を握りつぶさず UI 表示可能な error に変換することを要求する。

**推奨対応**:

file picker 呼び出しを `try/catch` し、失敗を `settingsError` へ設定して dialog を維持する。Cancel (`null`) は error にしない。frontend test または手動確認項目へ dialog plugin failure の扱いを追加する。

---

## 3. ドキュメント精度

### 3.1 実装記録の `git diff --check` Pass と commit 差分が一致しない

**重大度**: Low
**優先度**: Low
**工程分類**: impl
**status**: 未対応

**根拠**:

実装記録 6 は `git diff --check` を Pass とするが、`git diff 0d7342e..0923219 --check` は `tauri_viewer_settings_feature_impl.md:112: new blank line at EOF` で exit code 2 になる。working tree に対する `git diff --check` だけでは commit 済み差分を検査できない。

**推奨対応**:

末尾の余分な空行を除去し、Phase 3 commit 範囲に対して `git diff <base>..<head> --check` または commit 前に `git diff --cached --check` を実行する。実装記録へ実際に検証した command を正確に記載する。

### 3.2 MenuBar の恒久 detail design に `Settings...` が反映されていない箇所が残る

**重大度**: Low
**優先度**: Low
**工程分類**: impl
**status**: 未対応

**根拠**:

`docs/components/tauri_viewer/detail_design.md` の UI tree は `File: ... / Settings` と記載する一方、直後の MenuBar 説明は File dropdown を `Open Folder...`、Recent Folders、`Reload` のみとし、`Settings...` を列挙していない。source / interface spec / README とは不一致である。

**推奨対応**:

MenuBar 説明へ separator と `Settings...` を追加し、application-wide settings の導線と focus return 先も記載する。

---

## 4. 要求・設計適合確認

| 観点 | 確認結果 |
| --- | --- |
| 既存 app config JSON へ Theme / logical window size / jar path を保存 | ✓ `AppConfig.viewer_settings` と field-specific command を実装 |
| 旧 Recent Folders JSON migration | ✓ `AppConfig` / `ViewerSettings` / `WindowSize` の serde default と test を確認 |
| malformed JSON を上書きしない | ✓ `update` は parse 成功前に write せず `Err` |
| Store lock 内 read-modify-write | ✓ Recent Folders と Viewer settings が同じ `AppConfigStore` を使用 |
| atomic replace | △ temporary write / sync / platform replace は実装。post-replace directory sync failure は 1.2、failure tests は 2.1 |
| Windows API | △ target-specific `windows-sys 0.61` / `MoveFileExW` を確認。Windows compile / runtime test 証跡なし |
| PlantUML precedence | ✓ app config explicit path > legacy config > colocated jar。explicit missing は fallback しない |
| PlantUML command contract | △ UI 継続はするが runtime failure の response contract と docs が不一致 (2.2) |
| startup load / Dark flash | ✓ `Promise.allSettled` と loading shell、Theme の同期反映を確認 |
| invalid size partial normalization / repair | ✓ warningを維持し、startupから `save_window_size` を明示実行 |
| foreground config count | ✓ functional increment/decrement で早期 busy 解除を防止 |
| resize queue | ✓ 500 ms debounce、state query revision、single-flight + latest pending queueを確認 |
| maximized / minimized / fullscreen exclusion | ✓ window state query後に通常 eventだけを保存 |
| Settings draft / Save / Cancel / Clear | ✓ 保存成功前にapp Theme / runtimeを変更しない |
| Settings accessibility | △ role / label / alert /通常時focus loopは実装。保存中focusは1.3 |
| Split view integration / regression | ✗ prerequisite 未完了 (1.1) |
| 恒久 docs | △ 主仕様は反映。2.2 / 3.2 の残存不整合あり |

---

## 5. 検証結果

2026-07-19 に reviewer が再実行した結果:

| Command | Result |
| --- | --- |
| `cd markdown-viewer-tauri && npm run build` | Pass。既存 Mermaid chunk size warningのみ |
| `cd markdown-viewer-tauri/src-tauri && cargo check` | Pass |
| `cd markdown-viewer-tauri/src-tauri && cargo test` | Pass。8 tests、0 failed |
| `cd markdown-viewer-tauri/src-tauri && cargo fmt -- --check` | Pass |
| `git diff 0d7342e..0923219 --check` | Fail。実装記録末尾の余分な空行 (3.1) |
| Windows target build / test | 未実施。installed target は `aarch64-apple-darwin` のみ |

manual UI verification は実装記録の Tauri dev startup smoke までであり、Settings dialog 操作、resize / restart、実 jar、Split view は完了していない。前 3 件は Phase 4-a 候補だが、Split view は 1.1 の dependency 解消後でなければ実施できない。

---

## 6. 対応優先度

| 優先度 | 指摘 | 工程 | status | 理由 |
| --- | --- | --- | --- | --- |
| High | 1.1 Split view prerequisite 未達 | design | 未対応 | Phase 3 前提と統合・回帰対象を満たせない |
| High | 1.2 post-replace directory sync failure | impl | 未対応 | command failure と実永続値が食い違う |
| High | 1.3 保存中 modal focus trap | impl | 未対応 | background 操作不可と accessibility 契約に反する |
| Medium | 2.1 atomic / Windows failure tests | impl | 未対応 | 重要な platform / failure branch が未検証 |
| Medium | 2.2 PlantUML response contract | impl | 未対応 | source と公開 interface spec が不一致 |
| Medium | 2.3 file picker error handling | impl | 未対応 | OS I/O failure が unhandled rejection になる |
| Low | 3.1 diff check 記録 | impl | 未対応 | 検証証跡と実差分が一致しない |
| Low | 3.2 MenuBar detail docs | impl | 未対応 | 恒久 docs の一部が Settings 導線を列挙しない |

---

## 7. 未解決事項

| ID | 未解決事項 | owner | 解消条件 | status |
| --- | --- | --- | --- | --- |
| U-01 | TODO-2026-006 と本 feature の実行順 | workflow / design owner | dependency を満たして統合・回帰するか、TODO / WBS / design を正式改訂 | open |
| U-02 | replace 後 directory sync failure の command semantics | implementation owner | UI state と persisted state が一致する契約・testへ修正 | open |
| U-03 | Settings 保存中の focus containment | frontend implementation owner | inert / fallback focus / zero-control Tab testを追加 | open |
| U-04 | Windows atomic replace の実環境検証 | verification owner | Windows buildと既存destination置換testの証跡を追加 | open |
| U-05 | PlantUML runtime failure の公開 response contract | implementation / docs owner | sourceとinterface specを一致させtest追加 | open |

---

## 8. 結論

Viewer settings の型付き永続化、Recent Folders 互換、部分更新、PlantUML path precedence、startup Theme、resize queue、Settings UI の主要機能は設計に沿って実装され、macOS の build / Rust tests も成功している。実装方針を全面的に棄却する欠陥は確認されなかった。

ただし、Phase 3 の明示 prerequisite である Split view が未完了 (1.1)、atomic replace の post-commit failure semantics が Store / UI 契約と不一致 (1.2)、Settings 保存中の modal focus containment が破綻 (1.3) している。これらは受け入れ条件・データ整合・アクセシビリティに直結するため、現状のまま Phase 3 完了とはできない。

**条件付き承認 (Conditional approval)** とする。1.1〜1.3 を必須対応とし、2.1〜2.3 および docs / verification の 3.1〜3.2 を同じ Phase 3 指摘対応で解消した後、follow-up implementation review を行うこと。

**未解決指摘数**: 8。High 3、Medium 3、Low 2。

---

## 9. 初回レビュー対応（実装者、2026-07-19）

| 指摘 | 対応 | 再レビュー観点 |
| --- | --- | --- |
| 1.1 Split view prerequisite | ユーザーのPhase 3進行承認を実行順変更の承認として、TODO-2026-014の依存をTODO-2026-005へ変更した。WBS / meta / Phase 2設計も、Viewer settingsとSplit viewをMulti-tab後の独立work package、TODO-2026-007を両者の合流・統合UX評価として同期した。 | U-01を正式なdependency改訂としてclose可能か |
| 1.2 post-replace directory sync | replace成功をlogical commit pointとした。directory sync失敗は`Err`に戻さずstderr durability warningとし、保存済み値とcommand successを一致させた。replace / sync closureを注入できるhelperと2 testsを追加した。 | pre/post commit境界とtestが契約に一致するか |
| 1.3 modal focus | background app shellへ`inert`を追加した。dialogを`tabIndex={-1}`にし、保存開始時とenabled control 0件のTab時にcontainerへfocusを保持する。`aria-busy`も追加した。 | 保存中にfocusがbackgroundへ漏れないか |
| 2.1 atomic / Windows tests | create failureに加え、replace failureとpost-replace directory sync failureをfailure injectionで追加し、10 Rust testsを通した。Windows targetはhostに未導入のため未実施であることを実装記録へ明記し、Phase 4のplatform verificationへ引き継いだ。 | failure seamの十分性とWindows制約の扱い |
| 2.2 PlantUML contract | sourceに合わせ、app config / runtime解決失敗はcommand-level `Err`、解決後の構文error / process error / timeoutは図単位resultとdesign / detail / interfaceへ明記した。frontendの全placeholder error変換も記載した。 | 公開contractのsource/docs整合 |
| 2.3 file picker error | `openDialog`を`try/catch`し、plugin / OS errorを`settingsError`へ表示する。Cancelはerrorにしない。 | unhandled rejectionが残らないか |
| 3.1 diff check | 実装記録末尾の余分な空行を除去し、working treeの`git diff --check`を再実行した。response commit後にcommit範囲も検査する。 | commit範囲のwhitespace check |
| 3.2 MenuBar detail docs | detail designへseparator + `Settings...`とdialog close後のFile trigger focus returnを追記した。 | UI tree / prose / interfaceの一致 |

再検証結果は実装記録6へ反映した。初回レビューの未解決表と判定は履歴として維持し、follow-up reviewで各statusと最終未解決数を更新する。
