# TODO-2026-029 Tauri別プロセス起動・ディレクトリ別設定・タイトル表示 実装レビュー

**レビュー日**: 2026-09-13
**レビュー種別**: Phase 3 実装・恒久ドキュメントレビュー（初回）
**対象コミット**: `78039cd`（feat: add independent Viewer instances and per-directory settings）
**差分 base**: `75a7ac7`（docs: complete Phase 2 multi-instance feature design）
**設計**: `docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/design/tauri_multi_instance_project_settings_feature_design.md`（Phase 2 承認済み、`c4bf9c7`）
**実装記録**: `docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/impl/tauri_multi_instance_project_settings_impl.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-029
**レビュー環境**: macOS 26.6.2、rustc 1.95.0

**判定**: **差し戻し (Changes Requested)**。Phase 4 へは進めない。
**検出件数**: 8 件 = Medium 2 件（blocking 1、non-blocking 1）/ Low 6 件
**未解決件数**: **8 件**（うち blocking 1 件: MI-IR-01）
**承認条件**: MI-IR-01 を解消すること。設計 §11 の必須自動ケースのうち GUI 不要なものを追加し、GUI や実機が必要なものは実装記録に「未実施・理由・確認先」として明記する。non-blocking 7 件は同じ改訂で閉じるか、Phase 4 / completion の追跡項目として実装記録へ明記すれば承認可能とする。

---

## 概要

`75a7ac7..78039cd` の全差分を対象に、設計 §4.1 / §6 / §7 / §8 / §11 との整合、review checkpoints（仕様整合・責務配置・フォールバック・回帰・テスト・ドキュメント）、依頼の重点 6 項目を確認した。重点 6 項目は、Root / 設定の context と snapshot の原子性、project の初期化・migration・排他・field patch、frontend の保存 queue と resize、macOS の native menu / IPC / activation / 終了、既存 HTML 境界と PlantUML の回帰、恒久 docs の整合である。

reviewer は次を自分で再実行した。いずれも tracked file を変更していない（`git status` で確認）。

| 確認 | 結果 |
| --- | --- |
| `cargo test --offline`（src-tauri） | lib 31 件成功（実 child process による同時更新・lock timeout・強制終了後の再 lock を含む） |
| `npx vitest run` | 7 files / 117 件成功 |
| `cargo fmt -- --check` | 成功 |
| `cargo clippy --offline --all-targets` | warning 2 件（`lib.rs:81` の derivable impl、`lib.rs:1355` の items after test module）。どちらも本差分以前からの既存事項で、新規 module 由来の warning は無い |
| activation spike の JSON | 失敗記録は yield のみの経路で、`prepare-requester` が 2024 ms で timeout。成功記録は明示 handoff 経路で、6 scenario すべて 2 秒以内に target の key / active / onActiveSpace を観測した（通常 68 ms、最小化 647 ms、別 Space fullscreen 401 ms）。`scripts/check_macos_activation_spike.py` は 2 秒の残り時間で合否を判定しており、記録値は設計の deadline と整合する |

`npm run build`、`tauri build`、spike の再実行、製品 UI の手動確認は行っていない。

実装の骨格は、承認済み設計に忠実で品質も高い。

- **context / snapshot の原子性**: `ViewerSession::open`（`viewer_session.rs:161-206`）が、session gate の下で `RootSnapshot { path, generation }`・`WindowIdentity`・`SettingsContext`・in-memory settings を一括で commit する。`open_document`（同 `374-394`）は gate の下で context を照合し、同じ gate 内で snapshot を clone する。I/O は gate 解放後にその clone だけで行い、`open_snapshot` が generation も再照合する。Phase 2 で申し送った「context 検証元 = I/O と同じ snapshot」は満たされている。protocol も snapshot を一度 clone して `/document/<generation>/` を検証する。不一致は 410、欠落・非 canonical は 400 である。lock の取得順は常に state → snapshot で、逆順は無い。
- **設定 repository**: `open_project`（`project_settings.rs:503-530`）は、project lock → 存在確認 → 解放 → global defaults の snapshot → project lock → 再確認 → 生成、の順に処理する。設計の「lock を重ねない・後着は先着を使う」をそのまま実装している。migration は global lock 下で一度だけ行う。未知 schema・rootPath 不一致は上書きせず、`configPath` 付きの error を返す（テストで内容不変を確認）。`PatchField { Keep | Set }` と `deny_unknown_fields`、jar の `Set(null)` による Clear も設計どおり。
- **frontend 保存 queue**: `SettingsQueue`（`projectSettings.ts`）は保存を直列化し、busy 中の resize 破棄、実測 baseline、特殊状態から戻った時の保存なし、Root 切替前の flush、flush 失敗時の続行、context 交換時の pending 破棄を実装している。resize は event payload ではなく getter の値を使い、context が一致する場合だけ保存する。旧 context の document / render 結果は context object の同一性で捨てている。
- **macOS**: menu は `Menu::default` を基に File へ New Window を挿入し、Window submenu を専用 ID の submenu に差し替える（Help / App / Edit / View は既定のまま）。activation の本体経路は spike で成立した「yield + requester の `activateFromApplication(ActivateAllWindows)`」だけを採用し、失敗した yield のみの経路を fallback として残していない。target は key / active / onActiveSpace を観測してから ack を返す。check の自動反転は menu event 受信直後に自 instance だけへ戻している。終了時は `RunEvent::Exit` で socket を削除する。
- **旧経路の撤去**: `scan_directory` / `load_viewer_settings` / `save_viewer_preferences` / `save_window_size` と `AppConfigStore` は登録・実装から撤去された。`DocumentStore::scan_root` は `#[cfg(test)]` の既存 fixture 用に限られる。

一方で、**承認済み設計 §11 が「必須ケース」として列挙した自動テストの相当数が実装されておらず、実装記録にも未実施として記録されていない**（MI-IR-01）。また、WebView 再読込で Rust session と frontend の Root 状態がずれ、Settings が表示と異なる対象へ保存される経路がある（MI-IR-02）。

---

## 指摘一覧

| ID | 重大度 | blocking | 工程 | 対応状態 | 要旨 |
| --- | --- | --- | --- | --- | --- |
| MI-IR-01 | Medium | Yes | impl | 未対応 | 設計 §11 の必須自動ケースの多くが未実装で、実装記録にも未実施として残っていない |
| MI-IR-02 | Medium | No | impl | 未対応 | WebView 再読込後、Rust は Project context / title を保持し frontend は No Folder になり、Settings が表示と異なる対象へ保存される |
| MI-IR-03 | Low | No | impl | 未対応 | `open` / `reload` が scan と project I/O の間も session gate を保持しており、設計 §7.2-2 の「準備は gate 外、commit だけ gate 内」と異なる |
| MI-IR-04 | Low | No | impl | 未対応 | native menu の設置が IPC runtime の成功に依存し、runtime 異常時に Cmd+Shift+N と Refresh が消える |
| MI-IR-05 | Low | No | impl | 未対応 | listener の accept error で accept loop が恒久停止し、その instance が全一覧から消える |
| MI-IR-06 | Low | No | impl | 未対応 | `CREATE_NO_WINDOW` を literal で重複定義し、comment も実際の効果と異なる |
| MI-IR-07 | Low | No | impl（docs） | 未対応 | 恒久 docs に旧説明・誤リンク・architecture 3 文書への同一段落の重複が残る |
| MI-IR-08 | Low | No | impl（記録） | 未対応 | Phase 2 からの申し送り（起動時 size 適用の見え方）と WebView 再読込が、実装記録の未確認・Phase 4 確認項目に無い |

---

## 1. blocking

### MI-IR-01 設計 §11 の必須自動ケースの多くが未実装で、実装記録にも未実施として残っていない

**重大度**: Medium（blocking）
**工程**: impl（test）
**対応状態**: 未対応

**根拠**: 本差分で追加されたテストは Rust 8 件と Vitest 4 件である。

- Rust: `macos_instances` の frame 往復・上限 / 部分 frame、`project_settings` の 5 件（うち 1 件は worker）、`viewer_session` の 1 件
- Vitest: `projectSettings.test.ts` の 4 件

承認済み設計 §11 の「必須ケース」表と「追加自動ケース」に照らすと、GUI や実機を要さないのに実装されていないものが次のとおりある。

| 区分 | 未実装の必須ケース | GUI / 実機の要否 |
| --- | --- | --- |
| IPC | UUID 不一致（socket 名と `Info.id`）、未知 version の拒否、stale cleanup（ECONNREFUSED / NotFound だけ削除し timeout では削除しない）、安全でない runtime dir（他 owner / symlink / mode ≠ 0700）の拒否、partial list、二つの独立 service 間の Info / Activate 応答（activation 本体は除き、UUID 照合と `remaining_ms` 範囲外の拒否） | 不要（temp dir 上の `UnixListener` / `UnixStream` と、`install` から runtime 検証を切り出した関数で検証できる） |
| 一覧表示 | No Folder を含む表示ラベル重複への suffix、prefix 衝突時の完全 UUID、title → id の安定 sort、check の自 instance への復旧 | 不要（`update_menu` から label / sort を pure 関数へ切り出せば検証できる） |
| identity / title | `WindowIdentity::for_root` の filesystem root・同名異 path・日本語 / 空白、`SettingsContext::generation` の非 canonical 十進（`"01"` 等）の拒否 | 不要 |
| 起動 | `InstanceLauncher::bundle_path` の判定（`.app/Contents/MacOS` なのに bundle 検証失敗 → error で raw exe へ fallback しない、bundle 外 → dev 経路）、shell を使わない argv 構築 | 不要 |
| session / repository | `ViewerSession::startup` の global 破損時（`globalConfigError`、既定値、書込なし）、read-only 失敗、Reload 時の size 不変、protocol の generation 欠落・不正時の 400 | 不要 |
| frontend | Root 失敗時の旧 context 保持（queue 側）、settings modal の対象表示 | 前者は不要。後者は UI |

実装記録の「検証」は件数（cargo 31 件・Vitest 117 件）だけを記録している。「未確認と後続確認」は製品 UI、Windows、Linux、macOS 14 未満、App Translocation、NFC / NFD に限られ、上表の欠落には触れていない。そのため、記録上は §11 が満たされたように読める。特に runtime dir の owner / mode 検証と UUID / version の照合は、IPC の安全境界そのものである。現状はコードを読むことでしか担保されていない。

**推奨対応**: 上表の「不要」行を自動テストとして追加する。そのために `update_menu` の label / sort 生成と `install` の runtime dir 検証を、所有型の method または pure 関数へ切り出す。これは coding rules の責務配置と整合する。GUI・実機が必要なケース（activation 本体、menu 表示、Settings modal、NFC / NFD、Windows / Linux）は、実装記録へ「§11 のどのケースを・なぜ未実施で・どこで確認するか」を 1 表で明記する。`docs/tests/README.md` の該当節も実際の範囲に合わせる。

---

## 2. non-blocking

### MI-IR-02 WebView 再読込で Rust session と frontend の Root 状態がずれ、Settings が表示と異なる対象へ保存される

**重大度**: Medium（non-blocking）
**工程**: impl
**対応状態**: 未対応

**根拠**: `ViewerSession::startup`（`viewer_session.rs:131-160`）は初回だけ defaults を読み、2 回目以降は現在の `state.context` と `state.settings` をそのまま返す。Root path と tree は返さない。`load_startup_state` はその context で `present` を行うため、title は Root 名のままで、size は project の値が再適用される。

一方、frontend は WebView の再読込（開発時の reload、Windows WebView2 の F5 / Ctrl+R など、環境によって発生しうる）で state を失う。起動処理では `queue.apply(loaded.context, ...)` によって **Project context を採用しつつ `rootPath` は null** になる。その結果、次の食い違いが起きる。

- 画面は `No folder selected` で Reload も無効だが、native title は旧 Root 名のまま。
- Settings dialog の対象表示は `rootPath` から決まる（`App.tsx:1673`）ため `Default settings for new folders` と出るが、保存は Project context の project settings へ行われる。利用者が「新規 folder 用の初期値」を変えたつもりで、旧 Root の設定を書き換える。

データの消失は無い。ただし、設計 §6 の「保存対象を識別できるようにする」が破れ、利用者に見えない書込先の取り違えになる。

**推奨対応**: どちらかに統一する。

- `StartupState` に `canonicalRootPath`（と tree、または「Root が選択済み」の状態）を含め、frontend が Root 表示を復元する。
- あるいは、Settings の対象表示と Reload の可否を `rootPath` ではなく `queue.context.kind` から決め、Project context で Root 未表示の場合は再 open を促す。

いずれでも、Phase 4 の手動確認に「WebView 再読込後の表示と保存先」を追加する（→ MI-IR-08）。

### MI-IR-03 `open` / `reload` が scan と project I/O の間も session gate を保持している

**重大度**: Low / **工程**: impl / **対応状態**: 未対応

**根拠**: `ViewerSession::open`（`viewer_session.rs:162-206`）と `reload`（同 `224-240`）は、関数の冒頭で state mutex を取り、`build_tree`（大きな directory では長時間）と `open_project` / `load`（file lock を最大 2 秒待つ）を gate 内で実行する。設計 §7.2-2 は「candidate を準備した後、session gate 内で commit する」、`detail_design.md` は「tree 準備成功後」とする。実装では準備全体が gate に入っている。その間、旧 context の `open_document` / `render_plantuml_diagrams` / `patch_context_settings` は gate を待ってから stale で拒否される。UI は busy で、IPC Info / Activate は gate を使わないため、現時点で機能上の不具合は無い。ただし、設計・docs と実装の記述が一致していない。
**推奨対応**: 準備（canonicalize / scan / project open）を gate 外で行い、commit 直前に gate 内で context を再照合する構成へ寄せる。あるいは、現構成を採る理由（commit までの直列化を優先する）を `detail_design.md` と設計に記録する。

### MI-IR-04 native menu の設置が IPC runtime の成功に依存している

**重大度**: Low / **工程**: impl / **対応状態**: 未対応

**根拠**: `WindowMenuController::install`（`macos_instances.rs:94-128`）は、runtime dir の作成・検証と socket の bind を先に行い、失敗すると menu を組む前に `Err` を返す。setup はこれを `Window switching is unavailable` の notice にするだけである。この場合、Tauri 既定 menu が残り、native File > New Window（Cmd+Shift+N）と Refresh Window List が無くなる。in-app の File > New Window は動く。原因は、他 user が同名 dir を先に作った場合や `/tmp` の異常などである。設計 §5 の「native File > New Window の Cmd+Shift+N も同じ InstanceLauncher を呼ぶ」は IPC とは独立した要件である。
**推奨対応**: menu（New Window と既定項目）の設置を IPC runtime から独立させ、IPC 失敗時は Window submenu に disabled の `Window list is unavailable` を出す。notice は現行どおり残す。

### MI-IR-05 listener の accept error で accept loop が恒久停止する

**重大度**: Low / **工程**: impl / **対応状態**: 未対応

**根拠**: `macos_instances.rs:199-217` は `listener.accept()` の `Err` を一度でも受けると notice を出して `break` する。`EMFILE` / `ECONNABORTED` のような一時的な error でも、その instance は以後すべての instance の一覧から消える。再起動するまで回復しない。
**推奨対応**: 一時的な error は短い backoff を置いて `continue` し、回復不能なもの（listener 自体の invalid 等）だけ停止する。

### MI-IR-06 `CREATE_NO_WINDOW` の literal 重複と comment の不正確さ

**重大度**: Low / **工程**: impl / **対応状態**: 未対応

**根拠**: `instance_launcher.rs:55` は `creation_flags(0x08000000)` を直書きしている。同じ値の定数 `CREATE_NO_WINDOW` が `lib.rs:187` にあり、PlantUML 起動（`lib.rs:1019`）が使っている。comment の「GUI binary の親 console を継承しない」も不正確である。このフラグは console subsystem の process（debug build）に効き、release の GUI subsystem では無視される。Windows 上の build は未確認（実装記録どおり）。
**推奨対応**: 既存定数を使い、comment を「debug（console subsystem）で console window を作らない。release の GUI subsystem では影響しない」に改める。Windows 実機確認の項目に含める。

### MI-IR-07 恒久 docs に旧説明・誤リンク・同一段落の重複が残る

**重大度**: Low / **工程**: impl（docs） / **対応状態**: 未対応

**根拠**:

- `docs/components/tauri_viewer/README.md:82`: `open_root` を「root 配下を再帰走査して `FileTreeNode` を返す」と説明しているが、実際は `RootOpenResult`（tree・settings・context・presentation）を返す。`:87-88` も、`SettingsRepository` を「Store lock 内で config 全体を read-modify-write」と旧 `AppConfigStore` の説明のまま残し、固定 sidecar file lock・field patch・global / project 分割を書いていない。3 行ともリンク先が `lib.rs` で、実体の `viewer_session.rs` / `project_settings.rs` を指していない。
- `docs/components/tauri_viewer/interface_spec.md:162`: `render_plantuml_diagrams` の runtime 解決失敗を「command 全体の `Err(String)`」としているが、実装は `ViewerError` を返す。
- `docs/architecture/overview.md:90`、`code_patterns.md:55`、`common_pitfalls.md:79` に、同一の 2 段落がそのまま複製されている。overview には構造、code_patterns には pattern、pitfalls には落とし穴を書くという文書の役割が区別されていない。pitfalls には、実装で得た落とし穴を書くべきである。例: yield だけでは前面化しない、protocol で read lock を I/O 中に保持しない、resize 抑止を時間窓で行わない、muda の check 自動反転。
- `meta.md` の `related_commits` に `75a7ac7`（Phase 2 完了）が無い。completion 時に `78039cd` と合わせて追記すればよい。

**推奨対応**: 上記を修正し、architecture の段落は各文書の役割に合わせて書き分ける。

### MI-IR-08 Phase 2 からの申し送りと WebView 再読込が、実装記録の未確認・Phase 4 確認項目に無い

**重大度**: Low / **工程**: impl（記録） / **対応状態**: 未対応

**根拠**: 設計レビュー §10 と meta で申し送った「起動時の size 適用の見え方」について、実装記録の未確認項目にも `development_workflow.md` の手動確認にも記載が無い。global load を setup から frontend の startup command へ移したため、起動直後に `tauri.conf.json` の 800x600 で見えている時間が現行より長くなりうる。MI-IR-02 の WebView 再読込も同様に記載が無い。
**推奨対応**: Phase 4 の確認項目に「起動直後の 800x600 → defaults の表示遷移」と「WebView 再読込後の Root 表示・title・Settings 保存先」を追加する。前者が目立つ場合は、window を非表示で作成し presentation 適用後に表示する方式を follow-up とする。

---

## 3. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| RootSnapshot の単一 lock commit / clone | ✓ `open` が snapshot・identity・context・settings を gate 内で一括 commit。protocol / `open_document` は clone を使い、lock を I/O 中に保持しない |
| `open_document` の context 照合元 | ✓ gate 内で context を照合し、同じ gate 内で snapshot を clone。`open_snapshot` が generation を再照合（Phase 2 申し送り 3 を充足） |
| HTML 世代境界 | ✓ `/document/<generation>/` を path に置き、相対 CSS が同世代で 200、旧世代が 410（session test）。既存 protocol test は generation 付きへ更新され、root 外 / symlink / injection 拒否を維持 |
| PlantUML 回帰 | ✓ runtime は session の in-memory jar から gate 内で解決し、file を再読込しない。明示 jar が無効な場合に自動探索へ fallback しない既存 test を維持。旧 context の結果は frontend が破棄 |
| project 初期化・migration | ✓ scan 成功後に project を open / 生成し、失敗時は snapshot を変えない（test）。legacy → V2 を lock 下で一度だけ変換。global 破損でも既存 project は open でき、新規 project は `invalidConfig`（test） |
| 排他・field patch | ✓ 固定 sidecar lock（unlink しない）で 2 秒 retry。実 child process 2 本による別 field・Recent の同時更新で消失なし、lock timeout と強制終了後の再 lock（test）。`PatchField` / `deny_unknown_fields` / 空 patch は no-op |
| current project file の消失 | ✓ patch は `missingConfig` を返し、file を再生成しない（test） |
| frontend queue / resize | ✓ busy 中の event 破棄、getter 再取得、context 一致時だけ保存、特殊状態から戻った時は保存しない、flush 失敗でも Root 切替を続行、context 交換で pending を破棄（Vitest） |
| startup presentation | ✓ Rust が title / defaults size を main thread で適用し、nullable な `actualLogicalSize`・`sizeApplied`・`specialState` を startup / open / retry で共有。frontend は busy 中の resize を捨て、baseline を設定してから busy を解除 |
| capability | ✓ frontend は `setSize` / `setTitle` を呼ばず、`capabilities/default.json` は変更なし |
| thread | ✓ 新規・置換 command は async + `spawn_blocking`（`drain_viewer_notices` だけ同期だが、mutex の take だけ）。native 操作だけを `run_on_main_thread` へ dispatch し、gate を保持したまま main thread を待たない |
| native menu | ✓ 既定 App / Edit / View / Help を維持し、File に New Window（Cmd+Shift+N）+ Close Window、Window に Minimize / Zoom / Close Window / Refresh / instance 一覧を置く。専用 submenu ID により AppKit の windowsMenu 指定を避け、cfg は macOS 限定 |
| IPC | ✓ 0700 / owner / 非 symlink の検証、socket path 104 byte 未満、16 KiB の length-prefixed JSON、Info 250 ms / 一覧 2 秒 / 並列 8 / listener 8、stale 判定は ECONNREFUSED / NotFound のみ、socket 名 stem と `Info.id` の一致、version 照合、revision による最新一覧だけの適用 |
| activation | ✓ 本体は spike で成立した明示 handoff だけを採用し、requester の非 active 時は明示 error。target は unhide → deminiaturize → 状態観測 → makeKeyAndOrderFront / activate を行い、key・active・onActiveSpace で ack する。14 未満は availability 分岐のみ（未検証を記録済み） |
| 起動・終了 | ✓ bundle 内は `/usr/bin/open -n -a <bundle>`（shell なし）、bundle 検証失敗は error で raw exe へ fallback しない。dev / 他 OS は `current_exe` を spawn して background で回収し、親終了で子を kill しない。重複起動 guard あり。`RunEvent::Exit` で socket を削除 |
| 旧経路の撤去 | ✓ `scan_directory` / `load_viewer_settings` / `save_viewer_preferences` / `save_window_size` / `AppConfigStore` を撤去 |
| 恒久 docs の主要記述 | ✓ interface_spec の command 表 / URL / presentation、detail_design の RootSnapshot / sidecar lock / activation、development_workflow の保存先と手動確認、README の制約と未確認事項は実装と一致（MI-IR-07 の箇所を除く） |
| 未確認の扱い | ✓ Windows / Linux / macOS 14 未満 / App Translocation / NFC・NFD / 製品 UI matrix を成功扱いせず記録（MI-IR-01・08 の不足を除く） |

---

## 4. 追跡課題・確認不足（Phase 4 / completion で扱うもの）

以下は本レビューの指摘ではない。実装記録どおり未確認の項目で、Phase 4 または completion で結果を記録する必要がある。

1. **製品経路の activation**: spike は検証専用 example で、requester / target 間の命令も file 経由である。製品の IPC 経路（Info の再取得 → handoff → `Activate` → ack）で、通常 / 最小化 / 非表示 / 別 Space fullscreen から選択できるかを packaged app で確認する。強制終了した instance を選択した時の error / refresh も含む。
2. **native menu の実表示**: Cmd+W / Cmd+M / Cmd+Q / Full Screen の維持、独自 Window submenu に AppKit が一覧を自動挿入しないこと、複数 No Folder・同 Root・同名 directory の suffix と並び順。
3. **Windows**: cargo check / test / release build（`#[cfg(windows)]` の spawn / lock / path code は macOS では型検査されない）、別 PID 起動、taskbar の見出し、UNC / drive / case alias、`MoveFileExW` による atomic replace。
4. **Linux**: New Window と親終了後の利用の smoke。環境が無ければ未確認のまま記録する。
5. **macOS 14 未満の availability 分岐**、**App Translocation 下の New Window**、**NFC / NFD path の identity**。
6. **実利用者設定の migration**: temp fixture では検証済み。配布版で既存 `settings.json` が V2 へ移行し、旧 Recent / theme / size / jar が defaults として引き継がれることを、利用者の承認を得たうえで確認する。
7. **起動時の表示遷移と WebView 再読込**（MI-IR-02 / 08）。

---

## 5. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 高 | MI-IR-01 | 承認済み設計の必須テストが欠け、IPC 安全境界・一覧表示・起動判定の回帰が自動検出できない。記録上も充足したように見える |
| 中 | MI-IR-02 | 表示と保存先の食い違いは利用者に見えない書込を生む |
| 低 | MI-IR-03〜08 | 局所修正・記述整合・追跡項目の追記で閉じられる |

---

## 6. 結論

実装は承認済み設計の契約（RootSnapshot の原子性、path 内 generation、sidecar lock と field patch、SettingsQueue、Rust 主導の presentation、native menu の完全維持、明示 handoff の activation）をよく満たしている。spike で失敗した経路を fallback として残さず、未確認事項を成功扱いしていない点も適切である。reviewer の再実行でも cargo test 31 件と Vitest 117 件は成功した。

ただし、設計 §11 が必須とした自動ケースの多くが実装されていない。特に IPC の runtime 検証・UUID / version 照合、一覧 label、bundle 判定、startup の global 破損時が欠けており、実装記録にもその欠落が書かれていない（MI-IR-01）。これを解消するまで Phase 4 へは進めない。

**判定: 差し戻し (Changes Requested)。未解決 8 件（blocking 1 件: MI-IR-01）。** MI-IR-01 の対応後に再レビューする。non-blocking 7 件は同じ改訂で閉じるか、実装記録へ追跡項目として明記すること。
