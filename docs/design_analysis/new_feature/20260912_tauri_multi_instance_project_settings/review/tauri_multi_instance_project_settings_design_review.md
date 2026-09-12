# TODO-2026-029 Tauri別プロセス起動・ディレクトリ別設定・タイトル表示 設計レビュー

**レビュー日**: 2026-09-12
**レビュー種別**: Phase 2 設計レビュー（初回 + Round 1 再確認）
**対象ドキュメント**: `docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/design/tauri_multi_instance_project_settings_feature_design.md`
**対象 meta**: `docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/meta.md`
**対象 TODO**: `docs/todo/todo.md` TODO-2026-029
**初回レビュー対象コミット**: `85fb535`（docs: design Tauri multi-instance launch and project settings）
**初回レビューコミット**: `e2a846d`
**Round 1 fix コミット**: `4814fbf`（docs: address all initial multi-instance design review findings）
**Round 1 再確認日**: 2026-09-12
**最終判定**: **承認 (Approved)**。Phase 3 へ進行可。初回 18 件は Round 1 fix で設計上すべて解決済みと再確認した。Round 1 で新規検出した **Medium 1 件 / Low 1 件 = 2 件はいずれも non-blocking** で、Phase 3 の設計追記または実装レビューで閉じられる。**未解決 2 件（MI-DR-19、MI-DR-20、いずれも non-blocking）。** Phase 3 冒頭の packaged activation spike（go / no-go）は未実施であり、本承認は spike の成立を前提としない（§8.3）。
**照合した実装**: `markdown-viewer-tauri/src-tauri/src/lib.rs`、`src-tauri/Cargo.toml` / `Cargo.lock` / `tauri.conf.json` / `capabilities/default.json` / `gen/schemas/acl-manifests.json`、`markdown-viewer-tauri/src/App.tsx`、依存 source（`tauri-2.11.2`、`tao-0.35.2`、`muda-0.19.1`）
**レビュー環境**: macOS 26.6.2（25G83）、rustc 1.95.0。Phase 2 はドキュメントのみのため build / test は実行していない。

**初回判定**: **差し戻し (Changes Requested)**。Phase 3 へは進めない。
**検出件数**: 18 件 = High 1 件（blocking）/ Medium 9 件（blocking 5、non-blocking 4）/ Low 8 件
**初回未解決件数**: **18 件**（うち blocking 6 件: MI-DR-01〜06）
**承認条件**: blocking 6 件を設計へ反映し、MI-DR-07（TODO / meta 整合）を同じ改訂で閉じること。non-blocking の残りは設計追記で閉じるか、Phase 3 実装レビューで確認する follow-up として明記すれば承認可能とする。

---

## 概要

別プロセス方式・directory 別設定・native title・macOS Window メニュー一覧を 1 案件の統合設計として扱う妥当性、既存ソースとの統合、Root 切替の失敗・非同期・HTML 世代境界、settings migration と同 process / 別 process 競合、macOS 起動と native menu / IPC の成立性、過剰設計・scope・受け入れ条件の不足を独立に確認した。

設計の骨格は妥当である。

- **別プロセス + 1 プロセス 1 window** は、現行 `DocumentStore.current_root`（`lib.rs:190-193`）がプロセス共有 state であることと整合する。window 別 store 化も、`mvhtml` handler の `webview_label() != "main"` 拒否（`lib.rs:2123-2130`）や `capabilities/default.json` の `windows: ["main"]` の拡張も不要となる。ユーザ指定方式でもあり、同一プロセス複数 window 案の不採用理由は正しい。
- **設定分離**（global = defaults + Recent Folders、project = ViewerSettings）は、既存 `AppConfig { recent_folders, viewer_settings }`（`lib.rs:109-114`）の責務を自然に割っている。初回生成を「最新 global defaults の snapshot」に限定し直前 project をコピーしない判断、field 単位 patch、同 field last-writer-wins の明示は、現行 `saveTheme` が stale な `viewerSettings.plantUmlJarPath` を同送している問題（`App.tsx:603-615`）も解消する。
- **ファイル排他**: 固定 sidecar lock を unlink しない、global / project lock を同時保持しない（lock 順序問題が原理的に発生しない）、replace 前後の失敗区別、既存 temp 命名と `MoveFileExW` 経路の再利用は、既存 `write_app_config_to_path_with`（`lib.rs:615-652`）の契約を正しく引き継いでいる。`File::try_lock` は std で 1.89.0 stable（ローカル toolchain source で確認）であり、最低 version の明記方針も正しい。
- **macOS IPC**: socket 列挙による broker 不要設計、0700 runtime dir の owner / symlink / mode 検証、ECONNREFUSED / NotFound のみを stale とする判定、UUID path 非再利用による誤削除防止、frame 上限と deadline は、この規模として過不足がない。socket path は `/tmp/mv-<uid>-<16hex>/<36>.sock` で概ね 70 byte 程度となり macOS の `sun_path` 上限 104 byte に収まる。
- **Window submenu に専用 ID を使う**判断は、Tauri 2.11.2 の `init_app_menu`（`tauri-2.11.2/src/app.rs:2479-2492`）が `WINDOW_SUBMENU_ID` の submenu だけを `setWindowsMenu` 対象にする実装と整合しており、ローカル標準一覧との二重表示を避けられる。
- 依存予定の `sha2 0.10.9` / `uuid 1.23.1` / `tokio 1.52.3` / `libc 0.2.186` は、すべて既に `Cargo.lock` に transitively 解決済みであり、新規 crate 取得のリスクは小さい。

一方で、**macOS で「Window メニューから選択した別 instance を前面化する」という本案件の中核 UX が、現行 OS と依存実装のままでは成立を前提にできない**（MI-DR-01）。加えて、既定 macOS menu の置換による既存操作の欠落、window size / title の適用主体と capability、HTML 世代の URL 配置と原子性、command 契約の未列挙、Root 切替の過剰な中止条件が、実装者の推測に委ねられている。

---

## 指摘一覧

| ID | 重大度 | blocking | 工程 | 対応状態 | 要旨 |
| --- | --- | --- | --- | --- | --- |
| MI-DR-01 | High | Yes | design | 解決済み | macOS の Activate（前面化）が cooperative activation と tao `set_focus` 実装の制約で成立を前提にできない |
| MI-DR-02 | Medium | Yes | design | 解決済み | custom native menu が Tauri 既定 macOS menu の既存項目（Cmd+W / Cmd+M / Full Screen / Help 等）を落とす |
| MI-DR-03 | Medium | Yes | design | 解決済み | window size / title の適用主体と capability が未確定。maximized / fullscreen 時の Root 切替 size 適用が未定義 |
| MI-DR-04 | Medium | Yes | design | 解決済み | HTML rootGeneration の URL 配置と、root + generation の原子的 snapshot が未定義 |
| MI-DR-05 | Medium | Yes | design | 解決済み | 新規 / 置換 command・event 契約が未列挙で、旧 command の撤去も未記載 |
| MI-DR-06 | Medium | Yes | design | 解決済み | 旧 context の pending resize flush 失敗で Root 切替を中止する方針が可用性を過度に損なう |
| MI-DR-07 | Medium | No | plan | 解決済み | TODO / meta が Dock 検討・旧タイトル案を残し、設計と不整合 |
| MI-DR-08 | Medium | No | design | 解決済み | Tauri sync command は main thread で実行されるため、scan / lock 待ちが Activate・menu 更新を塞ぐ |
| MI-DR-09 | Medium | No | design | 解決済み | 破損・未知 schema・rootPath 不一致・project file 消失時の復旧導線と挙動が未定義 |
| MI-DR-10 | Medium | No | design | 解決済み | 恒久 docs の置換対象行が未特定。再起動時の size / theme 復元が変わる挙動変更も未記載 |
| MI-DR-11 | Low | No | design | 解決済み | 複数 process 間で in-app Recent Folders 表示が stale になる |
| MI-DR-12 | Low | No | design | 解決済み | 同一表示名の重複は同一 Root に限らない（`No Folder` 複数）。一覧順序が未定義 |
| MI-DR-13 | Low | No | design | 解決済み | muda の CheckMenuItem は click で check を自動反転する |
| MI-DR-14 | Low | No | design | 解決済み | 旧版併用時に defaultSettings が黙って失われる具体的な失敗モードが未記載 |
| MI-DR-15 | Low | No | design | 解決済み | OS 側の制約（Cmd+`、Cmd+Tab / Dock の同一 icon、App Translocation）の記録・確認項目がない |
| MI-DR-16 | Low | No | design | 解決済み | Linux の扱いが「既存動作維持」と「New Window 共通経路」で矛盾 |
| MI-DR-17 | Low | No | design | 解決済み | 複数 process テストの harness、macOS NFC / NFD path、Windows cfg code の検証手段が未記載 |
| MI-DR-18 | Low | No | design | 解決済み | PlantUML の「最新 jar 設定」が file 再読込か session snapshot か曖昧 |
| MI-DR-19 | Medium | No | design | 未対応（Round 1 新規） | global load を setup から外した結果、起動時の defaults size / title の適用主体と resize baseline が §4.1 に無い |
| MI-DR-20 | Low | No | design | 未対応（Round 1 新規） | §10 置換表に `detail_design.md:318`（protocol read 中の read lock 保持）と `interface_spec.md:133` / `:151`（`open_document` / `render_plantuml_diagrams` 契約）が無い |

---

## 1. 齟齬・不整合 / 成立性（blocking）

### MI-DR-01 macOS の Activate（前面化）が cooperative activation と tao `set_focus` 実装の制約で成立を前提にできない

**重大度**: High（blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**ドキュメント記載**: §8.1「Activate は対象 UUID を接続先で照合し、main thread へ show / unminimize / set_focus を依頼する。完了応答まで最大 2 秒」。§3「PID だけを保存して OS API で activate する案は…不採用。IPC の接続先 instance 自身が自身の window を復元する」。§12 は「他 instance の最小化 / fullscreen 復元は実装後の packaged app 確認が必要」とだけ記す。

**根拠**:

1. tao 0.35.2 の macOS `set_focus` は `makeKeyAndOrderFront` の後に `activateIgnoringOtherApps: YES` を送るだけである（`tao-0.35.2/src/platform_impl/macos/util/async.rs:230-237`）。macOS 14 以降、AppKit は cooperative app activation へ移行し、`activate(ignoringOtherApps:)` は deprecated となった。前面化は「現在 active な app が activation を譲る（`yieldActivation(to:)`）か、requester が `NSRunningApplication.activate(from:options:)` で渡す」ことを前提とする。本設計では、ユーザが menu を操作した **requester（active な instance A）が何も譲らず**、非 active な **B が自分で activate を試みる**。これは cooperative activation が拒否しうる典型的な形であり、B の window が前面に来ない、または menu bar が A のまま残る結果になりうる。レビュー環境は macOS 26.6.2 であり、この制約の対象である。
2. 同じ `set_focus` は `isMiniaturized()` が true、または `isVisible()` が false なら **何もしない**（`tao-0.35.2/src/platform_impl/macos/window.rs:677-685`）。`unminimize` は `NSWindow::deminiaturize` を呼ぶだけで（同 `window.rs:1035-1050`）、復元 animation 中の状態遷移を待たない。このため §8.1 の「show / unminimize / set_focus」を順に呼んでも、最小化 window では set_focus が黙って no-op になりうる。§11 の手動確認「最小化復元」はこの経路で失敗する可能性が高い。
3. 「完了応答」が何を意味するか（main thread で API を呼び終えたことか、window が key / front になったことか）が未定義である。前者なら、1・2 の失敗は成功 ack として返り、「失敗は表示し一覧を refresh する」（§8.1）が機能しない。

§3 の PID 不採用理由（PID 再利用）は、**activation handoff の宛先として PID を使うこと**までは否定しない。UUID を照合した live 接続上で相手 PID を得て、その PID に activation を譲るだけであれば、誤った PID へ譲っても他 app を前面化する副作用はない。

**推奨対応**:

- §8.1 に activation handoff を明記する。例: `Info` 応答に `pid` を追加する → requester は `NSApplication.yieldActivation(to: NSRunningApplication(processIdentifier:))` を実行してから `Activate` を送る → target は main thread で `deminiaturize` / `makeKeyAndOrderFront` と `NSApp.activate()` を行う。tao `set_focus` 単独には依存しない。
- ack の意味を「target window が focus / key を得たこと（`WindowEvent::Focused(true)` 等）を deadline 内に観測した」と定義する。deadline 超過は失敗として表示する。
- AppKit 呼び出しに必要な依存（`objc2-app-kit` 等。既に tao 経由で transitively 存在する可能性が高い）を §4 の依存予定へ追加する。
- §12 と §11 に、Phase 3 の**最初の作業**として「packaged app・macOS 14 以降・通常 / 最小化 / 別 Space fullscreen の 3 状態で前面化できるか」を検証する spike を置き、成立しない場合の扱い（要求の再確認）を go / no-go 条件として明記する。

### MI-DR-02 custom native menu が Tauri 既定 macOS menu の既存項目を落とす

**重大度**: Medium（blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**ドキュメント記載**: §8.2「macOS のみ既存標準 App / Edit メニューを維持し、File に New Window、Window に `Refresh Window List`、separator、各 instance の check menu item を置く」。

**根拠**: 現行アプリは menu を指定していないため、macOS では `Menu::default` が自動適用されている（`tauri-2.11.2/src/app.rs:2237-2241`）。その内容（`tauri-2.11.2/src/menu/menu.rs:150-248`）は App（About / Services / Hide / Hide Others / Quit）、**File（Close Window = Cmd+W）**、Edit、**View（Enter Full Screen）**、**Window（Minimize = Cmd+M / Zoom / Close Window）**、Help である。§8.2 の「App / Edit を維持」をそのまま実装すると、Cmd+W による window close、Cmd+M、menu からの Full Screen、Help が消える。File / Window submenu を自前で作り直すため、欠落は構造的に起きる。

また `Builder::menu` / `app.set_menu` は Windows では各 window の menu bar として付くため、macOS 限定の cfg gate が必要である。§8.2 の「macOS のみ」は宣言にとどまり、構成手段が書かれていない。

**推奨対応**: §8.2 に macOS menu の完全構成表を置く。既定 menu の全 `PredefinedMenuItem` を維持したうえで、File に New Window（Cmd+Shift+N）+ Close Window、Window に Minimize / Zoom / separator / Refresh Window List / separator / instance 一覧を並べる。menu 構築を `#[cfg(target_os = "macos")]` に閉じることも明記する。§11 の macOS 手動確認に「Cmd+W / Cmd+M / Cmd+Q / Full Screen が従来どおり動く」ことと、「`Window` という title の submenu に AppKit が標準 window 一覧を自動挿入しない」ことの確認を追加する。

### MI-DR-03 window size / title の適用主体と capability が未確定。maximized / fullscreen 時の size 適用が未定義

**重大度**: Medium（blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**ドキュメント記載**: §7.2-3「React の Root / tabs / split を reset し、theme / jar / logical size を適用する」。§7.2-4「programmatic resize 中は抑止し、set_size 完了後の実際の innerSize 読取と次 animation frame までを同期区間にする」。§7.2-5「window.set_title の結果と一覧 snapshot を更新」。§8「起動直後・Root commit 後・retry で Tauri set_title を実行」。§9「capability の main 制約…は維持する」。

**根拠**:

1. `capabilities/default.json` は `core:default` のみを付与している。`core:window` の default permission（`gen/schemas/acl-manifests.json`）は getter と `allow-internal-toggle-maximize` だけで、**`allow-set-size` / `allow-set-title` を含まない**。§7.2 の記述は frontend 主導の `setSize` / `setTitle` とも Rust 主導とも読める。frontend 主導なら capability 拡張が必要になり、§9 の境界記述と衝突する。
2. Rust が `set_size` を行う場合、`onResized` event と command 応答は別経路で frontend に届き、到着順は保証されない。「set_size 完了後…次 animation frame まで」という時間窓は、遅れて届く Resized event を取りこぼしうる。一方、§7.2-4 後半の「同値 size の event は保存不要」は時間に依存しない判定である。
3. Root 切替時に window が maximized / fullscreen / minimized の場合の扱いがない。現行 resize 保存はこの 3 状態を除外している（`App.tsx:1316-1329`）。しかし `set_size` を maximized window へ適用した時の挙動（最大化解除か、restore size の変更か）は OS ごとに異なり、fullscreen 中の macOS では予測しにくい。

**推奨対応**: title と size の適用は Rust の `open_root` / reload commit 経路（または型付き専用 command）で行い、capability を拡張しないと §7.2 / §9 に明記する。resize 保存の抑止は「Root 切替 busy 中の event を破棄 + commit 後は適用済み（実測）size と同値なら保存しない」の 2 条件に一本化し、animation frame 基準を削る。maximized / fullscreen / minimized 中の Root 切替では size を適用せず保存もしない（または解除してから適用する）方針を決め、§11 の session テストと手動確認へ追加する。

### MI-DR-04 HTML rootGeneration の URL 配置と、root + generation の原子的 snapshot が未定義

**重大度**: Medium（blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**ドキュメント記載**: §7.2 末尾「protocol URL へ rootGeneration を含め照合する（既存 root 境界に世代境界を追加）」。§4「ViewerSession: current Root・設定 context・世代番号… DocumentStore の root boundary は再利用」。

**根拠**:

1. 現行 `preview_url` は `mvhtml://localhost/document/<segments>`（Windows は `http://mvhtml.localhost/document/…`）を生成する（`lib.rs:923-948`）。HTML 内の相対 subresource（`style.css`、`img/a.png`）は document URL の path を基準に解決される。そのため、generation を **query に置くと subresource request に引き継がれず**、全 subresource が拒否されるか、subresource だけ世代検証の外に出る。path segment（例: `/document/<generation>/<segments>`）に置く場合だけ、相対参照で自然に継承される。§7.2 はこの配置を決めていない。
2. protocol handler は `DocumentStore.current_root` の read lock だけを取り（`lib.rs:372-384`）、I/O gate は取らない設計である（§7.2「IPC Info は…gate を待たない」と同様、protocol が gate を待つ記述もない）。generation を `ViewerSession`、root を `DocumentStore` と別 lock で持つと、commit 途中に「新 root + 旧 generation」の組を観測しうる。その結果、旧 iframe の request が新 Root の同名 file を返すという、§7.2 が防ごうとしている事象そのものが起きる。

**推奨対応**: generation を `/document/` 直後の path segment に置き、`resolve_protocol_path` がそれを検証して剥がすと明記する（不一致時の status も決める。例: 409 / 410）。root path と generation を 1 つの snapshot（例: `RwLock<Option<RootSnapshot { path, generation }>>`）として同じ lock で commit / read し、`open_document` と protocol が同じ snapshot を使うと §4 / §7.2 に書く。§11 document テストに「相対 subresource が同世代で解決される」「commit 途中の世代混在を観測しない」ケースを追加する。

### MI-DR-05 新規 / 置換 command・event 契約が未列挙で、旧 command の撤去も未記載

**重大度**: Medium（blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**ドキュメント記載**: §5 `new_window`、§7.2 `open_root` / `RootOpenResult`、§8.2「startup load」「event」、§8「retry」が本文に散在する。

**根拠**: 現行 command は `scan_directory` / `open_document` / `render_plantuml_diagrams` / `load_viewer_settings` / `save_viewer_preferences` / `save_window_size` / `load_recent_folders` / `record_recent_folder` / `remove_recent_folder`（`lib.rs:2161-2171`）である。設計は `open_root` 以外について、Reload 用 command、context 付きの settings load / patch / window size 保存、startup load（defaults + recent + 保留 error）、title retry、window 一覧 refresh、menu error event の名前・引数・戻り値・typed stale error の形を定義していない。`scan_directory` / `save_viewer_preferences` / `save_window_size` / `load_viewer_settings` を撤去するのか残すのかも書かれていない。coding rules の「旧経路を残さない」（`docs/rules/coding_rules.md` 共通必須ルール 3）に照らすと、置換対象の明示は設計の責務である。

menu error についても、§8.2 の「未準備なら native dialog へ表示」と「listener 未登録期間の error は Rust に保持し startup load でも返す」が、同じ error を二重表示するのか排他なのかが読み取れない。

**推奨対応**: §4 または新節に「command / event 表（名前、引数、戻り値、error 型、置換する旧 command）」を置き、旧 command は撤去すると明記する。`SettingsContext` と stale error の TS / Rust 型を併記する。menu error の表示経路は一本化する（例: frontend ready 前は Rust に保持して startup load で返し、native dialog は使わない。または逆）。

### MI-DR-06 旧 context の pending resize flush 失敗で Root 切替を中止する方針が可用性を過度に損なう

**重大度**: Medium（blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**ドキュメント記載**: §7.2-1「旧 context の pending resize を flush し、進行中設定保存 queue を待つ。失敗時は旧 Root を維持して切替を中止する」。

**根拠**: flush が失敗する主な原因は、旧 project の settings file が破損した・未知 schema になった（§6.2 で書込停止）、lock timeout、read-only 化などである。いずれも、その project の window size が保存できないだけの問題である。本方針では、これらが発生した瞬間から**その process では別 Root へ一切切り替えられなくなる**。設計は Root 切替 UI を busy にしてから flush するため、ユーザは再起動以外に脱出できない。一方、切替先の設定準備失敗で旧 Root を維持する（§6、§7.2-2）のは、切替先の正しさを守るために必要である。両者は性質が異なる。

**推奨対応**: 旧 context の pending 保存失敗は warning として表示し、pending を破棄して切替を続行する。旧 context の要求は commit 後に stale として拒否される（§7.2）ため、混線は起きない。切替を中止するのは切替先の scan / 設定準備の失敗だけ、と §7.2-1 を改める。§11 session テストの「resize flush 失敗」の期待値もこれに合わせる。

---

## 2. 整合性・設計不足（non-blocking）

### MI-DR-07 TODO / meta が Dock 検討・旧タイトル案を残し、設計と不整合

**重大度**: Medium（non-blocking。ただし承認条件として同じ改訂で閉じる）
**工程**: plan
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**:

- `meta.md`「Phase 2 で確定する事項」が「別プロセスの window を Dock / native menu で識別・選択する方法。一覧への自動集約は未検証」のまま。設計 §1 は Dock を対象外に確定済みである。
- `todo.md` TODO-2026-029 は `phase_2_approval` で Dock 対象外を記録している。しかし `feasibility`（Dock の icon / 一覧が未検証）、`proposed_scope`（「Dock / native menu での集約の可否…を Phase 2 で検証」）、`completion`（「…OS の省略表示や Dock の制約を記録する」）、`non_scope`（「Dock 独自の New Window 項目…必要性を Phase 2 で整理」）が旧記述のまま残っている。
- `proposed_scope` のタイトル案「ディレクトリ名 — MarkdownViewer」「未選択は MarkdownViewer」は、設計 §8 の `<directory name> — <parent path> — MarkdownViewer` / `No Folder — MarkdownViewer` と異なる。設計に「TODO 案からの変更」としての記録もない。
- TODO completion の「キャンセル・失敗時には以前の Root とタイトルを保持する」は §7.2 本文にはあるが、設計 §1 の完了条件に含まれていない。
- `meta.md` の `components` に新規 module（`project_settings.rs`、`viewer_session.rs`、`instance_launcher.rs`、`window_identity.rs`、`macos_instances.rs`、`src/projectSettings.ts`）と、§10 の `docs/setup/README.md` / `docs/tests/README.md` がない。`related_commits` に設計 commit `85fb535` がない（次 commit で追記する運用なら、その旨でよい）。

**推奨対応**: TODO の Dock 関連記述を「対象外（2026-09-12 回答）」へ更新し、タイトル表記を設計と一致させる（または設計側に TODO 案から変更した理由を 1 行残す）。設計 §1 の完了条件へタイトル保持を追加し、meta の「Phase 2 で確定する事項」と `components` を更新する。

### MI-DR-08 Tauri sync command は main thread で実行されるため、scan / lock 待ちが Activate・menu 更新を塞ぐ

**重大度**: Medium（non-blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: Tauri 2 では `async` でない `#[tauri::command]` は main thread で実行される。現行の `scan_directory` / `open_document` / 設定系 command はすべて sync である（`lib.rs:273-287`、`467-554`）。本設計で main thread を必要とする処理が増える。macOS の Activate（main thread で前面化）、native menu の item 更新、`set_title` / `set_size` である。巨大 directory の scan や最大 2 秒の lock retry が main thread を占有すると、他 instance からの Activate が deadline（2 秒）を超え、「失敗」と表示される。§7.1 は lock 待ちの `spawn_blocking` 化だけを述べ、scan・migration・`open` の終了待ち（§5）の実行 thread には触れていない。`setup` hook（`lib.rs:2140-2160`）で global lock 取得と migration を行う場合も、起動時の main thread を最大 2 秒塞ぐ。

**推奨対応**: 新規・置換 command（`open_root`、reload、settings 系、`new_window`）はすべて `async` + `spawn_blocking` とし、main thread で file I/O・scan・lock 待ちを行わないと §7 に明記する。起動時の global 読込 / migration を setup で同期実行するか、frontend の startup load へ移すかも決める。

### MI-DR-09 破損・未知 schema・rootPath 不一致・project file 消失時の復旧導線と挙動が未定義

**重大度**: Medium（non-blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**ドキュメント記載**: §6.2「明示 schemaVersion の未知値・不正 JSON・rootPath 不一致は上書きしない。英語 error を表示し、Settings / Root 切替の書込を止める」。

**根拠**: 無断 reset をしない方針は coding rules に合う。しかしこの方針のままでは、該当 directory は**永久に開けない**（§6「設定保存に失敗した open は Root を切り替えず error」）。しかも app 内にはファイルの場所が出ない。global が破損した場合は、初回 open（defaults の snapshot が取れない）と Recent Folders 更新がどう振る舞うか（Root を開けるのか）も読み取れない。現行は config 破損でも `scan_directory` は config と独立に動作する（`lib.rs:274-279`、`App.tsx:535-564`）。そのため本設計は「設定の破損が閲覧機能を止める」方向の挙動変更になる。さらに、開いている project の settings file が外部で削除された場合に、patch 保存が再作成するのか error になるのか、Reload が何をするのかも未定義である。

**推奨対応**: error message に対象 settings file の絶対 path を含め、README に手動復旧手順（該当 file の退避・削除）を記載すると §6.2 / §10 に明記する。global 破損時に Root open を許すかどうか（許す場合は project 初回生成と Recent 更新だけを失敗 warning にする、など）を決める。current context の project file が消失した場合の save / Reload の挙動を 1 行で確定し、§11 repository テストに追加する。

### MI-DR-10 恒久 docs の置換対象行が未特定。再起動時の size / theme 復元が変わる挙動変更も未記載

**重大度**: Medium（non-blocking）
**工程**: design
**対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: §10 は file 名と topic の列挙だけである。現行 docs には新仕様と両立しない確定記述がある。

- `docs/rules/development_workflow.md:38`「Theme、logical window size、明示 jar path、Recent Folders は…`settings.json` へ保存する」
- `docs/rules/development_workflow.md:207`「resize と再起動後に logical window size が復元され…」: 新設計では、再起動直後の window は Root 未選択であり global defaults の size / theme になる。最後に使った project の size ではなく、復元は「folder を開いた時点」へ移る。**既存ユーザにとっての挙動変更**だが、設計のどこにも明記がない。
- `docs/components/tauri_viewer/interface_spec.md:17`（Settings）、`:24`（File menu 項目）、`:30-36`（Settings dialog）、`:166-182`（設定 command）
- `docs/components/tauri_viewer/detail_design.md:371`、`:387`、`:420`（`AppConfigStore` の単一 lock / 全量 RMW / busy 管理）
- `docs/components/tauri_viewer/README.md:88`（`AppConfigStore` 行）、`markdown-viewer-tauri/README.md:47`

**推奨対応**: §10 を「file / 現行記述（行）/ 置換後の要旨」の表へ改める（TODO-2026-023 / 026 のレビューで確立した運用）。再起動時の size / theme が defaults になり、folder open 時に project 設定へ切り替わることを §6 と README 更新予定へ明記する。§11 の手動確認に「再起動 → defaults、folder open → project 設定」を追加する。

---

## 3. 改善提案（Low）

### MI-DR-11 複数 process 間で in-app Recent Folders 表示が stale になる

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: in-app の Recent Folders は起動時（`App.tsx:1217-1219`）と自 process の record / remove の戻り値（`App.tsx:566-601`）でしか更新されない。§5 の完了条件は「更新消失を防ぐ」だけで、表示の鮮度を扱っていない。A を開いたまま B で folder を開いても、A の File menu に B で開いた folder が出ない。
**推奨対応**: File menu を開く時（または window focus 時）に `load_recent_folders` 相当を再取得すると §6 に 1 行追加する。

### MI-DR-12 同一表示名の重複は同一 Root に限らない。一覧順序が未定義

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: §8 は「同一 Root の複数 instance は `[<id8>]` を付加」とする。しかし、Root 未選択の instance が複数あると、`No Folder — MarkdownViewer` が区別不能な項目として並ぶ。一覧の並び順も未定義で、refresh（focus ごと）のたびに順序が変わりうる。
**推奨対応**: suffix 付加条件を「表示ラベルが重複する全 instance」に一般化し、並び順（例: title → instanceId の安定 sort、自 instance の位置）を §8.2 に定める。

### MI-DR-13 muda の CheckMenuItem は click で check を自動反転する

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: muda 0.19.1 の macOS 実装は、Check 型 item の click 時に `set_checked(!is_checked())` を自動実行してから event を送る（`muda-0.19.1/src/platform_impl/macos/mod.rs:1124-1126`）。他 instance の項目を選ぶとその項目にも check が付き、自 instance の項目を選ぶと check が外れる。Activate の成否にかかわらず、次の refresh まで誤表示が残る。
**推奨対応**: menu event 受信直後に check 状態を「自 instance のみ」へ再適用すると §8.2 に明記する（または通常 item + 独自 marker にする）。

### MI-DR-14 旧版併用時に defaultSettings が黙って失われる具体的な失敗モードが未記載

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: 旧版の `AppConfig` は `#[serde(default)]` で unknown field を拒否しない（`lib.rs:109-114`）。旧版は V2 の file を問題なく読み、`viewerSettings` 欠落を既定値で補い、次の保存で `schemaVersion` / `defaultSettings` を**消した file を書き戻す**。新版はそれを legacy と判定して再 migration し、defaults は旧版の既定値へ置き換わる。error は出ない。§6.2 は「旧版は lock も V2 も理解しない」「downgrade は保証しない」と書くだけで、この無音の失敗を README に書く根拠が弱い。
**推奨対応**: README 記載予定に上記の具体的な結果を書く。あるいは、V2 global を別 file 名にして legacy `settings.json` を migration 元として読むだけにする案を比較し、採否を §6.2 に 1 行残す。

### MI-DR-15 OS 側の制約の記録・確認項目がない

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: TODO completion は「OS の省略表示や Dock の制約を記録する」ことを求めている。別 process 方式では、macOS の Cmd+`（同一 app 内 window 巡回）が instance 間を巡回しない。Cmd+Tab / Dock には同一 icon が instance 数だけ並ぶ。これらは VS Code 型の期待と異なる制約だが、§12 / §10 に記載がない。また GitHub release 配布の未署名 app を Downloads から直接起動すると App Translocation により `current_exe` が一時 mount 配下になるため、`open -n -a <bundle>` の成否を確認する価値がある。
**推奨対応**: §12 と README 更新予定に上記制約を追記し、§11 の macOS 手動確認に「Translocation 下（未移動の app）からの New Window」を追加する。

### MI-DR-16 Linux の扱いが「既存動作維持」と「New Window 共通経路」で矛盾

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: §2 は「Linux は既存動作を維持し、別プロセス起動の共通経路を使う」とする。一方、アプリ内 File > New Window は React menu で全 OS に出る。Linux では新機能が露出するのに、検証対象外になっている。
**推奨対応**: Linux で New Window を表示するか（表示するなら最小の手動確認か「未確認」扱いを明記）、非表示にするかを決める。

### MI-DR-17 複数 process テストの harness、macOS NFC / NFD path、Windows cfg code の検証手段が未記載

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: §11 は「実際の子 process を使った同 project 別 field 更新」「強制終了後 lock 解放」を `cargo test` に求めるが、子 process の起動方法（test binary を env 付き・`--exact` で再実行する等）と timeout を定めていない。identity テストの「日本語」は、macOS で dialog 由来と Recent 由来の path が NFC / NFD で異なる場合に canonicalize 後の hash が一致するか、を明示していない。`#[cfg(windows)]` の新規 code（spawn flags、verbatim 正規化、lock）は macOS の `cargo check` では型検査されない。
**推奨対応**: harness 方式を §11 に 1 行で定め、identity ケースに NFC / NFD を追加する。Windows cfg code は Windows 実機 build を必須とし、それが無い場合は「未確認」として残すと明記する（§11 末尾の方針を automated 側にも適用）。

### MI-DR-18 PlantUML の「最新 jar 設定」が file 再読込か session snapshot か曖昧

**重大度**: Low / **工程**: design / **対応状態**: 解決済み（Round 1 再確認済み。§8 参照）

**根拠**: §6 は「同 project の他 instance へのリアルタイム同期は行わない。フォルダ open、Settings を開く時、Reload で最新設定を読む」とする。一方で「PlantUML 開始時に現在 context の最新 jar 設定を snapshot」とも書く。現行 `render_plantuml_diagrams` は毎回 config file を読む（`lib.rs:159-163`、`453-465`）。これを踏襲すると、render のたびに project lock を取り、他 instance の jar 変更が即時反映されて §6 と矛盾する。
**推奨対応**: 「session が保持する現在 context の in-memory settings から snapshot する（file は読まない）」と明記する。

---

## 4. 整合性確認済み項目

| 項目 | 確認結果 |
| --- | --- |
| 別プロセス方式とユーザ要件（Phase 0 / 追加回答） | ✓ 整合。Dock 独自一覧は対象外、Window メニューで一覧・選択 |
| Root 分離を process 境界で得る（window 別 store 不要） | ✓ `DocumentStore` / `mvhtml` main 制約 / capability を変更不要 |
| `app_config_dir()` 継続利用 | ✓ 現行 `app_config_path`（`lib.rs:719-724`）と同一 resolver |
| global / project lock を同時保持しない | ✓ lock 順序 deadlock が原理的に起きない |
| 固定 sidecar lock・unlink しない・全 read / write 同一 lock | ✓ inode 分裂と migration 競合を防ぐ |
| `File::try_lock` の最低 Rust version | ✓ std で 1.89.0 stable。ローカル rustc 1.95.0 |
| 依存予定 crate | ✓ `sha2` / `uuid` / `tokio` / `libc` は `Cargo.lock` に解決済み |
| Window submenu 専用 ID による二重表示回避 | ✓ `init_app_menu` は `WINDOW_SUBMENU_ID` のみ `setWindowsMenu` |
| `set_title` / `Submenu::append` / `remove` の存在 | ✓ Tauri 2.11.2 source で確認 |
| `open -n -a <bundle path>` による新 instance 起動 | ✓ `man open` の記述どおり。bundle id 探索をしない判断は正しい |
| socket path 長 | ✓ 概ね 70 byte 程度で `sun_path` 104 byte 未満 |
| stale socket 判定（ECONNREFUSED / NotFound のみ） | ✓ timeout で削除しないため稼働中 instance を消さない |
| project identity（canonicalize + rootPath 照合 + domain 分離 hash） | ✓ 衝突・不整合時に別 directory 設定を使わない |
| 初回生成を scan 成功後・project lock 内の存在再確認で行う | ✓ キャンセル・scan 失敗で残骸を作らない |
| ADR 要否 | ✓ 現時点で不要。「採用済み」条件を満たさないため、completion 時に process 単位 Root / 設定 context を再評価すればよい |
| 過剰設計 | ✓ 常駐 broker・汎用 bus・継承階層・リアルタイム同期を持たない。IPC を Info / Activate に限定しており、規模に対して妥当 |

---

## 5. 対応優先度

| 優先度 | 項目 | 理由 |
| --- | --- | --- |
| 高 | MI-DR-01 | macOS の中核 UX（選択した Viewer の前面化）が成立しない可能性があり、Phase 3 冒頭の spike で go / no-go を判定する必要がある |
| 高 | MI-DR-02、MI-DR-03 | 既存操作の欠落と capability 境界の変更は、実装後に戻すと影響が広い |
| 高 | MI-DR-04、MI-DR-05、MI-DR-06 | 世代境界の抜け、旧経路の残存、Root 切替不能は設計段階で閉じるべき |
| 中 | MI-DR-07 | 承認条件。TODO / meta の旧記述は Phase 4 の合否判定を誤らせる |
| 中 | MI-DR-08、MI-DR-09、MI-DR-10 | 実装品質・復旧性・docs 整合に直結する |
| 低 | MI-DR-11〜18 | 局所的な仕様確定・記録・テスト追加で閉じられる |

---

## 6. 結論（初回時点。最終判定は §8.4）

設計は、別プロセス方式の採用理由、設定の責務分割、ファイル排他、Root 切替の世代管理、macOS IPC の規模感のいずれも妥当である。過剰な汎用化も避けられている。

ただし、**macOS で別 instance を前面化する手段は、現行 OS（macOS 14 以降の cooperative activation）と tao `set_focus` の実装（最小化中は no-op、`activateIgnoringOtherApps` 依存）の下で成立を前提にできない**（MI-DR-01）。これは Window メニュー一覧という要求の中核であるため、handoff 方式・ack 定義・Phase 3 冒頭の spike と go / no-go 条件を設計へ入れる必要がある。加えて、既定 macOS menu の欠落（MI-DR-02）、size / title の適用主体と capability（MI-DR-03）、HTML 世代の URL 配置と原子性（MI-DR-04）、command 契約と旧経路撤去（MI-DR-05）、Root 切替の中止条件（MI-DR-06）を確定すること。

**判定: 差し戻し (Changes Requested)。未解決 18 件（blocking 6 件）。** blocking 6 件と MI-DR-07 を反映した改訂後に再レビューする。


## 7. 実装担当による設計反映（2026-09-12、reviewer再確認待ち）

初回判定は履歴として維持する。MI-DR-01〜18の全件を設計へ反映した。現時点の状態は対応済み・再確認待ちであり、reviewer承認やPhase 3実機確認を完了扱いにしない。

| ID | 対応・参照先 |
| --- | --- |
| MI-DR-01 | 設計§8.1 requester handoff・AppKit API・key+active ack、§11 Phase 3冒頭spikeとgo / no-go、§4依存追加 |
| MI-DR-02 | §8.2全native menu表・macOS cfg、§11既存shortcut回帰 |
| MI-DR-03 | §7.2 Rustのみでsize/title適用・実測baseline・特殊window状態skip |
| MI-DR-04 | §7.2単一RootSnapshot、path generation、400/410と相対resource、§11原子性test |
| MI-DR-05 | §4.1 command/event/typed error/patch、旧command撤去、notice単一経路 |
| MI-DR-06 | §7.2旧context flush失敗はwarningで続行、candidate準備失敗だけ中止 |
| MI-DR-07 | TODOのDock・title・defaultsを同期、meta components/commit/決定事項更新、§1完了条件 |
| MI-DR-08 | §7.2 async/spawn_blocking、setup登録のみ、native dispatch時gate解放 |
| MI-DR-09 | §6.2 errorにpath、手動退避復旧、global破損時既存project可、file消失は明示openまで再生成なし |
| MI-DR-10 | §10現行行と置換要旨表、§6復元タイミング変更、§11手動確認 |
| MI-DR-11 | §6 File menu open時Recent再取得・失敗表示 |
| MI-DR-12 | §8 No Folderを含む重複label全般、§8.2安定sort |
| MI-DR-13 | §8.2 click直後checkをselfのみへ再設定 |
| MI-DR-14 | §6.2旧版によるschema/defaults消失を明記、別filename案の不採用理由 |
| MI-DR-15 | §12 OS巡回・icon集約非保証、§11 App Translocation確認 |
| MI-DR-16 | §2 Linux New Window提供を明示、§11実機なければ未確認 |
| MI-DR-17 | §11 child test harness/deadline/回収、NFC/NFD、Windows実機build必須 |
| MI-DR-18 | §6 in-memory settings snapshotからjar取得、更新契機を限定 |

---

## 8. Round 1 再確認（2026-09-12、reviewer）

**対象**: `4814fbf` の設計・TODO・meta 差分（`e2a846d..4814fbf`）。追加調査は未解決論点の成立性だけに限った（`objc2-app-kit 0.3.2` の binding 有無、Tauri 既定 menu との差分、`core:window` default permission）。Phase 2 設計レビューとして文書だけを確認した。build / test と Phase 3 の実機 spike は実施していない。

### 8.1 blocking 6 件の再確認

| ID | 判定 | 確認内容 |
| --- | --- | --- |
| MI-DR-01 | 解決 | 設計 §8.1 は `Info` に `pid` を追加する。requester は main thread で live 接続先 PID の `NSRunningApplication` を取得し、`yieldActivation(to:)` で activation を譲ってから `Activate` を送る。target は UUID を再照合し、`unhide` → `deminiaturize`（完了 notification / state 観測を main thread を塞がず待つ）→ `makeKeyAndOrderFront` + `NSApp.activate` を行う。tao `set_focus` 単独や API 呼出成功には依存しない。ack は「対象 window が key かつ NSApp が active」を main thread で観測して初めて返す。`Focused` event は再確認の trigger にとどめ、deadline は handoff 開始から 2 秒、期限切れ後に届いた処理は新たな activate を始めない。macOS 14 未満は API availability 分岐で旧 API を使い、同じ ack 条件を適用する。14 以降の handoff 失敗から旧 API へ fallback しないことも明記されており、coding rules のフォールバック規定に適合する。`objc2-app-kit 0.3.2`（`Cargo.lock` 解決済み）に `NSApplication::activate` / `yieldActivationToApplication`、`NSRunningApplication::runningApplicationWithProcessIdentifier` / `activateFromApplication_options` が存在することを依存 source で確認した。§11 は「Phase 3 の最初に packaged spike を実装し、macOS 14 以降の通常 / 最小化 / 別 Space fullscreen の 3 状態で key・active を deadline 内に観測できること」を go 条件としている。不成立なら後続の設定統合へ進まず、実際の失敗をユーザへ報告して要件を再確認する。§12 と meta も spike を未実施として扱っており、成功を先取りしていない。 |
| MI-DR-02 | 解決 | 設計 §8.2 は `#[cfg(target_os = "macos")]` に閉じた完全な menu 表を持つ。File の Close Window（Cmd+W）、View の Enter Full Screen、Window の Minimize（Cmd+M）/ Zoom / Close Window、Help を含み、Tauri 2.11.2 `Menu::default` の全項目を包含する。App 行の Show All は既定に無い追加項目だが、標準の `PredefinedMenuItem` であり既存操作を損なわないため許容する。Help は既定の Help submenu を維持するとしており、`HELP_SUBMENU_ID` による help menu 登録も保たれる。§11 に Cmd+W / Cmd+M / Cmd+Q / Full Screen の維持と、独自 Window submenu へ AppKit が一覧を自動挿入しないことの確認がある。 |
| MI-DR-03 | 解決 | 設計 §7.2-3 で、Root commit 後に Rust が main thread 上で title と logical size を適用し、実測 size を `RootOpenResult.presentation { actualLogicalSize, sizeApplied }` として返す。frontend は `setSize` / `setTitle` を呼ばず、capability は追加しない。`core:window` default に set 系 permission が無い現状と整合する。§7.2-4 は animation frame 等の時間窓を廃止した。busy 中の event は破棄し、応答の実測 size を baseline とする。busy 解除後は payload ではなく getter で再取得し、「取得開始時 context = 現在 context かつ baseline と異なる」場合だけ保存する。maximized / fullscreen / minimized 中は size の適用も保存もしない。通常状態へ戻った時の実測値は baseline として受け入れるだけで、戻る操作自体では保存しない。いずれも getter（`core:window:default` に含まれる）だけで実装でき、Retry も同じ baseline 経路へ共通化されている。 |
| MI-DR-04 | 解決 | 設計 §7.2 で `DocumentStore` の正本を `RwLock<Option<RootSnapshot { path, generation }>>` とし、path と generation を単一 lock で commit / clone する。`ViewerSession` に current root を複製しない。これで「新 path + 旧 generation」の組は構造上作れない。HTML URL は `/document/<generation>/<segments>`（macOS / Windows とも path segment）で、相対 CSS / JS / image が generation を継承する。不一致は 410、未指定・不正 format は 400 とし、generation を除いた segments に既存 decode / canonical boundary 検査を適用する。旧 URL 互換は持たない。§11 に相対 subresource の generation 継承と RootSnapshot の原子性テストがある。Phase 3 実装レビューでは、`open_document` の context 検証が I/O に使うのと同じ snapshot clone の generation と照合しているかを確認する（別経路で session を読むと検証と I/O の間に commit が挟まりうる。frontend の世代 guard で表示には出ないため、指摘ではなく確認項目とする）。 |
| MI-DR-05 | 解決 | 設計 §4.1 に次がそろっている。`SettingsContext`（Rust tagged enum / TS union、generation は十進文字列）、`ViewerError { code, message, configPath? }`、12 command の表（引数・戻り値・置換する旧経路）、`PatchField` による「未指定 / Set / Set(null)=Clear」の区別、旧 4 command（`scan_directory` / `load_viewer_settings` / `save_viewer_preferences` / `save_window_size`）の登録・実装・呼出・テストからの撤去、native menu 操作を frontend command にしない方針。notice は Rust queue を正本とし、`viewer-notices-available` event は通知だけに使う drain 方式に一本化された。native dialog との二重経路は無い。起動時の defaults size 適用だけが表から漏れている（→ MI-DR-19。non-blocking）。 |
| MI-DR-06 | 解決 | 設計 §7.2-1 で、旧 context の pending 保存失敗は warning 表示 + pending 破棄で切替を続行し、切替中止は candidate scan / 設定準備の失敗に限定した。§11 に「旧保存失敗でも新 Root へ移れること」が追加された。§6.2 の「Settings / Root 切替の書込を止める」は、同節末尾（global 破損時の既存 project open 可、current project file 消失時も別 Root へ移れる）と §7.2-1 によって「切替に伴う書込（初回生成・Recent）を止める」意味に限定されると読め、矛盾しない。 |

### 8.2 non-blocking 12 件の再確認

| ID | 判定 | 確認内容 |
| --- | --- | --- |
| MI-DR-07 | 解決 | TODO の `feasibility` / `proposed_scope` / `non_scope` / `completion` / `phase_2_decisions` から Dock 検討と「Phase 2 で検証」の旧記述が除かれ、Dock 独自一覧・icon 集約は対象外（2026-09-12 回答）と同期した。タイトルは設計 §8 と同じ表記になり、設計側にも「Phase 0 の短いタイトル案から変更」した理由がある。設計 §1 に完了条件 7（キャンセル・準備失敗時の Root / title 保持、commit 後の表示失敗は warning / Retry）が追加された。meta の `components`（新 module 6 件、setup / tests docs）、`related_commits`（`85fb535`、`e2a846d`）、「Phase 2 設計判断」（spike 未検証を明記）を更新済み。 |
| MI-DR-08 | 解決 | 設計 §7.2 で、新規・置換 command をすべて async とし、file I/O・scan・lock 待ち・process 終了待ちを `spawn_blocking` へ移した。gate の取得待ちも main thread で行わない。setup は service / listener / menu 登録だけにした。native 操作だけを main thread へ dispatch し、gate を保持したまま main thread の完了を待たない。 |
| MI-DR-09 | 解決 | 設計 §6.2 で、`invalidConfig` / `missingConfig` に設定ファイルの絶対 path を含め、README に手動復旧手順を記載する。global 破損時は既存かつ正常な project を open 可能とし、新規生成・defaults 保存・Recent 操作だけを error にする。初回 open は「project 存在確認 → 未存在時のみ defaults snapshot」の順。current project file の外部削除は `missingConfig` とし、勝手に再生成せず、明示 open でのみ再作成する。いずれも §11 の自動ケースに追加された。 |
| MI-DR-10 | 解決 | 設計 §10 が「file / 現行記述 / 置換内容」の表になり、`development_workflow.md:38` / `:207`、`interface_spec.md:17,24,30-36,166-182`、`detail_design.md:371,387,420`、README 2 件を特定した。§6 に「再起動直後は defaults、project 設定は folder open 時に復元」の挙動変更、§11 に同手動確認がある。表の漏れ 2 箇所は MI-DR-20（Low）として分離した。 |
| MI-DR-11 | 解決 | 設計 §6 で、File menu を開く時に Recent を再取得する。失敗時は以前の snapshot と error を表示する。 |
| MI-DR-12 | 解決 | 設計 §8 で suffix 条件を「No Folder を含む表示ラベル重複」全般に拡張した。§8.2 で一覧を suffix 前 title → 完全 instanceId の安定 sort とし、self を先頭へ移動しない。 |
| MI-DR-13 | 解決 | 設計 §8.2 で、menu event 受信直後に全 item の check を `id == self.instanceId` へ戻す。Activate の成否とは独立して表示を保つ。 |
| MI-DR-14 | 解決 | 設計 §6.2 で、旧版の上書きによる `schemaVersion` / `defaultSettings` の無音消失を README へ書く制約として明記した。別名 V2 file 案は比較のうえ不採用とし、理由（履歴・defaults の二重管理）も記録された。 |
| MI-DR-15 | 解決 | 設計 §12 に Cmd+` と Window 一覧の違い、Cmd+Tab / Dock の icon 非集約、Translocation 失敗時の説明を記載した。§11 に未移動 Downloads の App Translocation 下での New Window 確認がある。 |
| MI-DR-16 | 解決 | 設計 §2 で、Linux にも New Window・directory 設定・title を提供し、compile / unit test の対象に含めることを明記した。実機がなければ未確認とする（§11 に smoke の扱いあり）。native 一覧は macOS のみ。 |
| MI-DR-17 | 解決 | 設計 §11 に、test binary の worker test を `--exact` + 専用 env で再起動する harness、ready barrier、child / barrier 10 秒・case 30 秒の deadline、timeout 時の kill / wait 回収、通常 app に隠し test mode を作らない方針を記載した。NFC / NFD ケースと、Windows cfg code の Windows 上 `cargo check` / `test` / release build 必須（無ければ未確認）も明記された。 |
| MI-DR-18 | 解決 | 設計 §6 で、PlantUML は現在 context の in-memory settings から jar を snapshot し、file を再読込しない。snapshot の更新契機は open / Settings load / Reload / patch 成功に限定され、§6 のリアルタイム同期なし方針と整合する。 |

### 8.3 Round 1 新規指摘

#### MI-DR-19 global load を setup から外した結果、起動時の defaults size / title の適用主体と resize baseline が §4.1 に無い

**重大度**: Medium（non-blocking）
**工程**: design
**対応状態**: 未対応（Phase 3 着手時に設計へ 1 行追記、または Phase 3 実装レビューで確認）

**根拠**: 現行は `setup` hook が global settings を読み、frontend の resize listener 登録前に `set_size` で起動時 size を復元している（`lib.rs:2140-2160`）。Round 1 で MI-DR-08 に対応するため、設計 §7.2 は「setup では service / listener / menu 登録だけを行い、global load / migration は frontend startup command へ移す」とした。その結果、次の点が未定義になった。

- §4.1 の `load_startup_state` の戻り値は `context / settings / recentFolders / warnings / globalConfigError` だけで、defaults の logical size を誰が適用するかが無い。frontend は `setSize` を呼ばない（§7.2-3、capability 非追加）ため、表のまま実装すると「Root 未選択時の resize は defaults へ保存される（§6）が、起動時には適用されない」回帰になる。
- 起動時の size 適用は frontend の resize listener 登録後に起きるため、§7.2-4 の baseline 規則（busy 中 event 破棄 + 実測 baseline）を起動時にも適用しないと、適用結果の Resized event を利用者 resize として defaults へ書き戻しうる。
- §8 は「起動直後…set_title を実行」とするが、setup が登録だけになった後、起動時 title をどこで適用するかが同様に表に無い。

設計原則（§6「起動時は global defaults を適用」、§7.2-3「size / title は Rust のみ」）から答えは一意に導けるため、blocking とはしない。

**推奨対応**: `load_startup_state` が Rust 側で `No Folder` title と defaults の logical size（maximized / fullscreen / minimized でなければ）を main thread で適用し、`presentation { actualLogicalSize, sizeApplied }` を返すと §4.1 に追記する。frontend は応答までを startup busy として resize event を破棄し、実測値を baseline とする（§7.2-4 と共通の policy）。global 破損時は表示用既定値の size を適用するのか現状 size を維持するのかも併記する。§11 frontend / session テストに「起動時 size 適用で defaults へ保存しない」を追加する。

#### MI-DR-20 §10 置換表に protocol lock と `open_document` / render 契約の記述が無い

**重大度**: Low（non-blocking）
**工程**: design
**対応状態**: 未対応（Phase 3 の docs 反映時に対応、実装レビューで確認）

**根拠**: 次の現行記述が §10 の表に含まれていない。

- `docs/components/tauri_viewer/detail_design.md:318`「`DocumentStore` は成功した `scan_directory` の canonical root を `RwLock<Option<PathBuf>>` へ保持し…protocol read 中は read lock を保持する」: 設計 §7.2 の `RootSnapshot` clone 方式（snapshot を一度取得し I/O 完了まで利用）、`scan_directory` 撤去と矛盾する。
- `docs/components/tauri_viewer/interface_spec.md:133`（`open_document` の契約）、`:151`（`render_plantuml_diagrams` の契約）: §4.1 で context 引数と session snapshot 利用へ変わる。

表の注記「行番号は目安…対象 section を検索して更新」と、detail_design 行の置換内容に `RootSnapshot` が含まれることから実装者が拾える可能性は高いが、置換対象として明示されていない。

**推奨対応**: §10 の表の `detail_design.md` 行に `:318` を、`interface_spec.md` 行に `:133` / `:151` を追加する。

### 8.4 件数と判定

| 区分 | 件数 |
| --- | --- |
| 初回指摘 | 18 件（High 1 / Medium 9 / Low 8）→ **全件解決** |
| Round 1 新規 | 2 件（Medium 1 / Low 1）、いずれも non-blocking |
| **未解決** | **2 件**（MI-DR-19、MI-DR-20。blocking 0 件） |

**判定: 承認 (Approved)。Phase 3 へ進行可。**

承認の前提と Phase 3 への引き継ぎ:

1. 本承認は Phase 2 設計レビューとしての判定であり、**macOS activation handoff の実機成立は確認していない**。設計 §11 のとおり、Phase 3 の最初に packaged spike を実施し、macOS 14 以降の通常 / 最小化 / 別 Space fullscreen で key・active を deadline 内に観測できなければ、後続実装へ進まずユーザへ報告して要件を再確認すること。spike の結果（requester / target 双方）は Phase 3 の記録に残し、成功扱いで隠さないこと。
2. MI-DR-19 は Phase 3 着手時に設計 §4.1 へ追記し、MI-DR-20 は Phase 3 の恒久 docs 反映で閉じる。いずれも Phase 3 実装レビューで確認する。
3. Phase 3 実装レビューでは、§8.1 MI-DR-04 に記した `open_document` の context 検証元（I/O と同じ snapshot clone）も確認する。
