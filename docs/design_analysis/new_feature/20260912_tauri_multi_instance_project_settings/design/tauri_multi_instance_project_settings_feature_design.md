# Tauri別プロセス起動・ディレクトリ別設定・タイトル表示 設計

## 1. 背景・要求・完了条件

対象はTODO-2026-029。Windowsの実行ファイル再起動と同様、macOSでもGUI操作で独立したViewerプロセスを起動する。1プロセス1windowを維持し、各Rootの設定をユーザー用領域に保存する。Rootを開かずにOSのwindow切替UIだけで閲覧先を識別できることを目指す。

2026-09-12の追加回答で、macOSはメニューバーの`Window`メニューで一覧・選択できればよいと確認済み。Dock右クリックメニューの完全再現・複数instanceのDockアイコン集約は要求しない。Phase 0の「Windowメニュー・Dock一覧」の未確定部分を本判断で確定する。

完了条件:

1. File > New WindowとmacOS Cmd+Shift+Nで別PIDのViewerが起動し、元Viewer終了後も操作できる。
2. 各プロセスのRoot / tabs / HTML配信が独立する。
3. Root名をnative titleに表示し、Windowsのタイトルバー・タスクバーとmacOS Windowメニューで識別・選択できる。
4. theme / logical window size / PlantUML pathがdirectory別に初回生成・保存・復元される。
5. 別directory、同directoryの複数プロセス、Recent Foldersの同時更新で無関係な設定を失わない。
6. 自動検証とmacOS / Windowsの手動確認を行い、環境不足は未確認として残す。

## 2. 対象・非対象・最小提供範囲

対象: Tauri版macOS / Windows、アプリ内FileのNew Window、macOS native File / Windowメニュー、native title、directory設定、共通Recent Folders、設定保存のプロセス間排他。

非対象: Avalonia、同一プロセス複数window、window間tab移動、session全体復元、Dock独自メニュー、グローバルhotkey、外部アプリのwindow列挙、他ユーザーや別端末のinstance、移動したdirectoryの設定追跡、設定のリアルタイム同期。Linuxは既存動作を維持し、別プロセス起動の共通経路を使うがnative一覧の保証対象はmacOSのみ。

Rootの分離、設定、起動、一覧を1案件の統合設計として扱う。IPCはmacOSの`Info` / `Activate`に限定し、汎用アプリbusや常駐brokerへ拡張しない。

## 3. 採用案・不採用案・before / after

| 項目 | before | after / 理由 |
| --- | --- | --- |
| 起動 | macOS通常再openでは新規instanceにならない | 明示New Windowで別プロセス。ユーザ指定方式 |
| Root | 1プロセス内でDocumentStoreを共有 | そのまま維持。各プロセスのmain / Rootは独立 |
| タイトル | 固定markdown-viewer-tauri | Root名・親pathを含む識別用title |
| 設定 | settings.jsonに全directory共通settingsと履歴 | 共通defaults / 履歴 + directory別settings |
| 排他 | Mutexとatomic replace | 同一ファイルのread-modify-write全体をプロセス間lockで保護 |
| macOS一覧 | native機構は同一processのwindowが中心 | 自アプリinstanceへ問い合わせ、native Windowメニューへ一覧構築 |

同一プロセス複数window案はユーザ意図に合わないため不採用。PIDだけを保存してOS APIでactivateする案は、PID再利用と最小化window復元を扱いにくいため不採用。IPCの接続先instance自身が自身のwindowを復元する。既存設定JSON全体をdirectory数分複製する案はRecent Foldersの責務が混ざるため不採用。

## 4. 責務と影響範囲

| モジュール / 型 | 責務 |
| --- | --- |
| `src-tauri/src/project_settings.rs` / `SettingsRepository` | typed schema、identity、初期化・migration・field単位更新 |
| 同module / `AtomicJsonFile`、`ConfigFileLock` | 共通JSONのatomic replace、durability warning、sidecar lockのRAII |
| `src-tauri/src/viewer_session.rs` / `ViewerSession` | current Root・設定context・世代番号・Root切替の調停。DocumentStoreのroot boundaryは再利用 |
| `src-tauri/src/instance_launcher.rs` / `InstanceLauncher` | cfg別の別process起動、起動失敗の説明 |
| `src-tauri/src/window_identity.rs` / `WindowIdentity` | titleとinstance一覧の同一表示モデル |
| `src-tauri/src/macos_instances.rs` / `InstanceDirectory`、`WindowMenuController` | macOS限定IPCとnative一覧、activate要求 |
| `lib.rs` | Tauri登録・command adapter・既存render機能の統合 |
| `src/projectSettings.ts` + tests | Root切替世代、設定保存queue、resize保存抑止のpure policy |
| `src/App.tsx` | File / Settings表示、Root操作、UI反映、エラー提示 |

既存AppConfigStoreのread/updateとatomic writeをSettingsRepositoryへ移設し、共通・projectで同一実装を使う。PlantUML runtime resolverとDocumentStoreのpath / protocol検証は維持。module直下関数はTauri commandなどframework adapterと既存pure policyに限り、新規I/Oは所有型のmethodへ置く。新規interfaceの型境界はserde struct / enumとTS unionに限定する。

依存予定: SHA-256用`sha2`、instance ID用`uuid`のv4 feature、macOSのIPC用`tokio`のnet / io-util / time / sync（Tauriと整合する1系）、UID / filesystem検査用macOS限定`libc`。実装時にCargo.lockへ解決結果を固定する。File lockはRust stdの1.89以降を使用し、Cargo.tomlのrust-versionとsetup docsへ最低1.89を記載する。現在ローカルrustcは1.95.0。

## 5. 起動と終了

- アプリ内File > New Windowは共通Rust command `new_window`へ送る。macOS native File > New WindowのCmd+Shift+Nも同じInstanceLauncherを呼ぶ。WebView側で同shortcutを二重登録しない。
- macOS packaged実行はcurrent_exeから`Contents/MacOS/<exe>`構造を検証し、自身の`.app`絶対pathを求める。`/usr/bin/open`へ引数配列`-n`, `-a`, `<bundle path>`を渡す。shell経由やbundle identifierによる別copyの探索はしない。open終了statusを確認し、失敗は英語errorで返す。
- macOS dev（bundle構造外）とWindows / Linuxはcurrent_exeを直接spawn。stdinをnullにし、GUI起動でterminalを増やさない。Windowsは既存GUI subsystemを維持し、必要なcreation flagsはraw exe実機で検証する。子process待機はbackgroundで回収し、親終了で子をkillする仕組みは追加しない。
- bundle検出失敗とdev判定を混同しない。`.app/Contents/MacOS`にいるがbundle検証が失敗した場合は起動失敗とし、raw exeへfallbackしない。
- New Window操作中はその起動要求だけを重複送信不可にする。完了後は繰り返し起動可。起動成功はOSが起動要求を受理したことを意味し、child初期化失敗はchild自身で表示する。
- 新規ViewerはRoot未選択。現在のRootを子へ自動引継ぎしない。
- close / Quitはそのプロセスのみ終了する。macOSも最後のwindow closeで当該processを終了し、Dock / Finderから再起動できる。全instanceをまとめてQuitする導線は持たない。
- dev子は同じVite serverに依存するため、dev server終了後の独立動作は保証しない。親終了後の独立性はpackaged app / Windows releaseで判定する。

## 6. ディレクトリ設定と初期値

保存先は既存Tauri `app_config_dir()`を継続利用する。WindowsのAppData系、macOSのApplication Support系のアプリ専用領域であり、具体pathはTauri resolverを正とする。

```text
<app_config_dir>/
  settings.json                       # schemaVersion=2、defaultSettings、recentFolders
  settings.lock                       # 共通設定の固定sidecar
  projects/<projectId>/settings.json   # schemaVersion=1、rootPath、settings
  projects/<projectId>/settings.lock   # project単位の固定sidecar
```

`GlobalConfigV2 { schemaVersion: 2, defaultSettings: ViewerSettings, recentFolders: RecentFolderEntry[] }`

`ProjectConfigV1 { schemaVersion: 1, rootPath: String, settings: ViewerSettings }`

ViewerSettingsは既存theme / windowSize / plantUmlJarPathの3field。global defaultsはRoot未選択時の設定でもある。Settings dialogには未選択時`Default settings for new folders`、選択後`Settings for <root>`を表示し、利用者が保存対象を識別できるようにする。

- アプリ起動時はglobal defaultsを適用する。Root未選択時の設定変更・resizeはdefaultsへ保存する。
- directory初回open成功時には最新global defaultsのsnapshotからproject settingsを生成する。直前に開いていた別projectの設定はコピーしない。
- 次回open時はproject settingsを優先し、global defaults変更を既存projectへ自動適用しない。
- 初回ファイル生成はRootのcanonicalize / directory判定 / tree構築と設定検証が成功した後、project lock内で存在を再確認して行う。キャンセル・scan失敗では生成しない。設定保存に失敗したopenはRootを切り替えずエラーにする。
- 同projectの他instanceへのリアルタイム同期は行わない。フォルダopen、Settingsを開く時、Reloadで最新設定を読む。Reloadではtheme / jarを更新するが、意図せぬresizeを避けwindow sizeは再適用しない。Rootを開き直す時にはsizeも適用する。
- Settingsの保存はUIで変更したfieldだけpatchする。themeの単独切替もthemeだけ、resizeはwindowSizeだけ。同じfieldの競合はlock取得後に最後に成功した更新を採用。dialogを開いた時点の他fieldで最新設定を上書きしない。
- PlantUML開始時に現在contextの最新jar設定をsnapshotし、実行中jobのruntimeは途中で変更しない。結果は既存tab revisionと新しいRoot世代でguardする。

### 6.1 Project identity

既存normalize_pathのcanonical絶対pathを基に、domain文字列`markdown-viewer-project-v1` + platform識別子 + pathのUTF-8 bytesをSHA-256に入力し、64桁hexをprojectIdとする。Windows内部verbatim表記の正規化は一箇所へ固定し、UI表示用pathとは分ける。caseを一律小文字化しない（case-sensitive directoryを混同させない）。symlinkはcanonicalizeにより実体pathへまとめる。

保存済みrootPathとcanonical pathの一致を必ず確認する。不一致はhash衝突 / 不整合エラーとして別directoryの設定を使わない。OSのcanonicalizeが同一表記へ収束しないaliasは別identityとなる制約を明記し、Windowsの大小文字 / drive・UNC表記を実機検証する。移動 / renameは新projectとして扱い、古い設定の自動探索や削除はしない。既存同様UTF-8として扱えないpathは明示errorにする。

### 6.2 移行と破損

- global読込時にsidecar lockを取得し、schemaVersionなしの現行AppConfigを一度だけV2へ変換する。recentFoldersを保持し、viewerSettingsをdefaultSettingsへ移す。
- 現行schemaでviewerSettings省略時は既存既定値、invalid sizeは既存normalize policyとwarningを継続。既知schemaの欠落fieldはtyped defaultで補完する。
- 明示schemaVersionの未知値・不正JSON・rootPath不一致は上書きしない。英語errorを表示し、Settings / Root切替の書込を止める。無断resetや「別ファイルが読めればよい」というfallbackはしない。
- global未作成の場合は既定値で初期化する。旧schemaの読み取りはmigration入口に限定し、通常処理はV2 / ProjectV1へ一本化する。
- globalとprojectのschemaでversion必須、typed validationを行う。旧版アプリとの同時実行・downgradeは保証しない。旧版はlockもV2も理解しないため、移行前に旧版を終了する運用をREADMEに記載する。

## 7. 保存排他とRoot切替の整合

### 7.1 ファイル更新

ファイルごとの固定`settings.lock`をread/write/createで開き、File::try_lockのretryに最大2秒を設ける。lock待ちはspawn_blockingで実行しUI threadを占有しない。lockファイルはunlink / replaceしない（inode分裂を防ぐ）。全read / migrate / create / updateが同じlockを使う。

lock取得 → 最新JSON読込 → patch / validation → unique tempへ書込・sync → atomic replace → directory sync → unlockの順。PID + sequenceの既存temp命名と既存Windows MoveFileExW経路を再利用し、共通JSON helperにまとめる。replace前の失敗は旧ファイル保持、replace後のdirectory sync失敗は保存成功+durability warningとして区別する。lock timeoutは保存失敗として表示し、後続の明示操作で再試行可能にする。

globalとproject lockは同時に保持しない。初回作成用defaultsをglobal lock下でsnapshotし解放後、project lockを取る。first-create競合は後着が既存projectを使用する。Recent Foldersはglobal read-modify-writeとdedupeを排他下で行う。

### 7.2 Session contextと非同期処理

`SettingsContext = Default | Project { projectId, rootGeneration }`。Rust ViewerSessionが現在contextを発行し、frontendから任意pathを保存先に指定させない。設定保存・renderにcontextを添付し、session現在値と異なる要求はtyped stale errorで拒否する。context検証から同期設定更新完了まではsession操作gateで直列化する。IPC Infoは小さいsnapshotを読むだけで、このI/O gateを待たない。

Root切替:

1. UIのRoot / 設定操作をbusyにし、新規resize debounce受付を止める。旧contextのpending resizeをflushし、進行中設定保存queueを待つ。失敗時は旧Rootを維持して切替を中止する。
2. `open_root` commandでcandidate treeとproject設定を準備する。DocumentStoreのscan_rootをprepare / commitに分離し、失敗時にcurrent rootを先に変えない。設定生成が成功した後にsession gate内でRootとcontext世代をcommitする。
3. 応答`RootOpenResult { tree, canonicalRootPath, settings, context, warnings }`でReactのRoot / tabs / splitをresetし、theme / jar / logical sizeを適用する。frontend設定queueはcontext交換と共に旧timer・pendingを破棄する。
4. size適用によるonResizedは保存しない。programmatic resize中は抑止し、set_size完了後の実際のinnerSize読取と次animation frameまでを同期区間にする。以降も同値sizeのeventは保存不要と判定する。次の利用者resizeは新contextで保存する。
5. window.set_titleの結果と一覧snapshotを更新し、初期documentを開く。タイトル・OS size適用失敗はRoot成功後のUI適用warningとして表示し、成功したRootを別Rootへrollbackしない。titleにはRetry操作を提供し、一覧には新Rootの正しいsnapshotを出す。
6. Recent FoldersはRoot成功後に更新する。履歴保存だけ失敗した時は新Rootを維持し既存どおりwarningを表示する。

Reloadは新Rootのcommitやproject初期化を行わず、現在Rootのtree再scanと最新settings再読込を行う。削除済みRootはerrorとして保持する。Root変更で開始済みのdocument / PlantUML応答はrootGeneration不一致で反映しない。HTMLはプロセス内の現在Rootを用いる既存境界を維持し、root切替後に旧iframeから来る要求が新Rootの同名fileを表示しないよう、protocol URLへrootGenerationを含め照合する（既存root境界に世代境界を追加）。これはwindow別store化ではない。

## 8. タイトルとmacOS Window一覧

タイトルは常に`<directory name> — <parent path> — MarkdownViewer`とする。常時親pathを含めるため、同名Rootの有無で他processのtitleを更新する必要がない。filesystem rootはroot pathをdirectory nameとして表示し、重複parentは省略する。未選択は`No Folder — MarkdownViewer`。同一Rootの複数instanceはWindowメニューだけ`[<instance ID先頭8桁>]`を付加して区別する。ID prefix衝突時は完全UUIDを使う。OS省略表示は許容し、native menuは完全なpath表記を渡す。

Root / identity snapshotはRustを正本にし、document.titleの更新だけでnative title更新を代替しない。起動直後・Root commit後・retryでTauri set_titleを実行する。

### 8.1 macOS限定instance通信

各processがUUID v4のinstanceIdを生成し、Unix domain socketを1つ持つ。RustのmacOS専用InstanceDirectoryが管理し、webview / HTMLへsocket pathやIPC権限を公開しない。

- Runtime領域は短い`/tmp/mv-<uid>-<app identifier SHA256先頭16桁>/`、mode0700。UIDはOS APIで取得。directoryはsymlink_metadataでowner、種別、modeを検証し、他owner / symlink / 不正modeなら作成・通信を拒否する。socket名は`<UUID>.sock`。Unix socket path上限を事前検証する。
- socket一覧を列挙して直接問い合わせるためPIDレジストリや常駐brokerは不要。同ユーザー・同appid・同protocol versionのinstanceだけを扱う。devは別namespace suffixとし配布版へ混在させない。
- typed protocol V1: `Info` → `{instanceId, title, rootPath, protocolVersion}`、`Activate { instanceId }` → success / error。1接続1要求、length prefix付きJSON、最大16KiB。不正型・未知version・過大frameを拒否する。
- Tokioでconnect / 完全frame read-writeをdeadline付きで行い、Infoは1相手250ms、一覧全体2秒、同時接続8件まで。部分一覧時は`Some windows could not be reached`をdisabled menu itemで示す。readerの小分け送信でdeadlineを延長しない。
- Activateは対象UUIDを接続先で照合し、main threadへshow / unminimize / set_focusを依頼する。完了応答まで最大2秒。相手終了・timeout・OS拒否は失敗として表示し一覧をrefreshする。PID再利用による他アプリactivateをしない。
- listenerのin-flight上限8、超過接続は閉じる。InfoはRoot / identity snapshotを読み、設定ファイルへは触れない。通信でファイルopenや設定変更は受け付けない。
- 正常終了で自分のsocketを削除。異常終了の残骸は接続拒否またはNotFoundのみをstaleと判定する。timeoutだけで削除しない。UUID socket pathを再利用しないためstale削除が新processのsocketを消すことはない。親directoryは稼働中に削除しない。

### 8.2 native menu

macOSのみ既存標準App / Editメニューを維持し、FileにNew Window、Windowに`Refresh Window List`、separator、各instanceのcheck menu itemを置く。TauriのOS既定window列挙に他process集約を期待せず、専用IDのsubmenuをWindowとして構成する。local標準一覧との二重表示を避け、自動windows-menu指定を併用しない。現在instanceにcheckを付ける。

起動、Root commit、window focus取得、Refresh操作で一覧取得を要求する。同時refreshは最新世代のみ適用し、main threadでmenu itemを更新する。常時pollingは行わない。別processの起動・終了直後やfocus取得から取得完了まで古いsnapshotが見えることはあり、Refreshで更新できる。選択時はUUIDでlive相手を確認する。native acceleratorとReact操作は同一serviceへ集約する。

自身を選択した場合もshow / unminimize / set_focusの共通methodを使う。メニューのerrorはfrontend準備済みなら既存ErrorBannerへeventで表示し、未準備ならnative dialogへ表示する。event listener未登録期間のerrorはRustに保持しstartup loadでも返す。

## 9. 互換性・セキュリティ・拡張性

capabilityのmain制約とHTML originのIPC禁止は維持する。新規commandはmainからだけ呼べる既存境界へ登録し、汎用shell / arbitrary executable / 任意pathへの設定書込APIを公開しない。

directory設定とruntime socketは別責務。設定schemaのversionを明示し、将来のproject preferenceはViewerSettingsへの追加として扱う。現時点で継承階層、workspace tree、汎用message brokerは作らない。同一ユーザー権限で設定領域を書き換えられるアプリを敵対境界には含めないが、別ユーザーのruntime領域へ接続しない。

## 10. 恒久ドキュメント更新予定

- Tauri README: New Window、Window一覧、設定保存場所 / 初期値 / directory切替、旧版終了とmigration、dev制約。
- docs/components/tauri_viewer/README.md: service、command、schema、lifecycle、IPC。
- docs/architecture/overview.md / code_patterns.md / common_pitfalls.md: process単位Root、設定contextと世代、file lock、HTML世代境界。
- docs/rules/development_workflow.md / docs/tests/README.md: 検証コマンドと複数process・設定・native menu手動確認。
- docs/setup/README.md: Rust最低version。必要に応じ比較設計へTauri固有差分へのリンク。

## 11. 検証

自動: `npm test -- --run`、`npm run build`（markdown-viewer-tauri）、`cargo fmt -- --check`、`cargo check`、`cargo test`（src-tauri）。Phase 2はドキュメント変更のみなので実装buildの実行はPhase 3とする。

| 区分 | 必須ケース |
| --- | --- |
| repository | 初回生成、再open、既存global migration、invalid / unknown schema、read-only失敗、defaultsとproject分離 |
| identity | 同名異path、日本語・空白、symlink、filesystem root、Windows drive / UNC / case表記、不一致検出 |
| 排他 | 実際の子processを使った同project別field更新、同field最終更新、Recent Folders追加、初回create競合、lock timeout、強制終了後lock解放 |
| session | candidate scan / settings失敗で旧Root保持、resize flush失敗、旧context保存拒否、Root切替中のsize適用、Reload時size不変 |
| document | 旧Root async結果拒否、HTML旧generation拒否、Markdown / HTML / Mermaid / PlantUML既存回帰 |
| 起動 | argv builderのshell非使用・bundle判定、起動失敗、native shortcut1操作1process |
| IPC | 二つの独立serviceでInfo / Activate ack、UUID不一致、unknown version、過大frame、timeout、partial list、stale cleanup、安全でないruntime dir拒否 |
| frontend | field単位patch、context交換、debounce flush / discard、Root failure保持、settings modalの対象表示 |

macOS packaged app: 3instanceで別Root・同Rootを開き、Window一覧から選択、最小化復元、背景 / 非表示 / fullscreen切替、親終了後の利用、Cmd+Shift+N、最後のclose後Finder / Dock再起動。強制終了したinstanceを再選択してerror / refresh、同名directory・長pathの識別を確認する。

Windows release: ショートカットとFile両方の別PID起動、親終了後の利用、title / taskbar thumbnail見出し、同directory競合、Unicode / drive / UNC、atomic replaceを確認する。macOSでのcargo成功をWindows確認の代替にしない。

## 12. リスク・残る実機確認

- macOS native menuの更新とfocus、他instanceの最小化 / fullscreen復元は実装後のpackaged app確認が必要。設計時点で動作検証済みとはしない。
- Window一覧はfocus / 明示refresh時のsnapshotであり常時同期ではない。失効した項目は選択時にエラーとして扱う。
- root切替のtransactionはfilesystemとnative window操作の分散atomic性を保証しない。Root成功後のtitle / size errorをwarningで明示する。
- 同projectの同fieldは最後の保存が有効。window sizeを複数instanceで個別保存するsession modelは対象外。
- canonicalize alias、旧版との混在、network filesystemのlock semanticsは制約。settingsはユーザーのローカル設定領域に置く前提とし、同期drive越しの同時更新は保証しない。
- rootGenerationのHTML URL導入は既存protocolテストへ回帰ケースを追加し、旧URL互換経路は残さない（URLはsession内生成物）。

## 13. 調査根拠

- ローカルCargo.lock: Tauri 2.11.2。依存sourceのWebviewWindow::set_title、Submenu::append / remove、app_config_dirを確認。
- ローカルmacOS `man open`: `-n`は稼働中でも新instanceを開く。`-a`で特定bundleを指定できる。
- [Apple createsNewApplicationInstance](https://developer.apple.com/documentation/appkit/nsworkspace/openconfiguration/createsnewapplicationinstance): 通常起動は既存appを利用する。
- [Tauri menu API](https://docs.rs/tauri/latest/tauri/menu/index.html): native submenu / menu eventの構成。
- [Rust File locks](https://doc.rust-lang.org/std/fs/struct.File.html#method.try_lock): 1.89以降のプロセス間lockとhandle解放時のunlock。
- [Rust canonicalize](https://doc.rust-lang.org/std/fs/fn.canonicalize.html): symlink解決・Windows extended path表記。
- [Rust UnixStream](https://doc.rust-lang.org/std/os/unix/net/struct.UnixStream.html): Unix domain socket。deadline付きasync実装はTokioで行う。

## 14. レビュー対応履歴

初回レビュー待ち。
