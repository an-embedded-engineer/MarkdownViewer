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
7. フォルダ選択キャンセル・切替先scan / 設定準備失敗では以前のRootとtitleを保持する。Root commit後のOS表示適用失敗は成功したRootを維持してwarningとRetryを提示する。

## 2. 対象・非対象・最小提供範囲

対象: Tauri版macOS / Windows、アプリ内FileのNew Window、macOS native File / Windowメニュー、native title、directory設定、共通Recent Folders、設定保存のプロセス間排他。

非対象: Avalonia、同一プロセス複数window、window間tab移動、session全体復元、Dock独自メニュー、グローバルhotkey、外部アプリのwindow列挙、他ユーザーや別端末のinstance、移動したdirectoryの設定追跡、設定のリアルタイム同期。LinuxにもFile > New Windowとdirectory設定・titleを提供する。共通経路のcompile / unit test対象に含め、Linux実機起動は環境があれば確認し、なければ未確認と明記する。native一覧はmacOSのみ。

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

同一プロセス複数window案はユーザ意図に合わないため不採用。PIDだけを保存したレジストリからOS APIでactivateする案はPID再利用を扱いにくいため不採用。UUIDを照合したlive IPCでPIDを取得し、requesterがAppKitでactivationを譲り、target自身がwindowを復元する。PIDはhandoffの補助であってinstance identityではない。既存設定JSON全体をdirectory数分複製する案はRecent Foldersの責務が混ざるため不採用。

## 4. 責務と影響範囲

| モジュール / 型 | 責務 |
| --- | --- |
| `src-tauri/src/project_settings.rs` / `SettingsRepository` | typed schema、identity、初期化・migration・field単位更新 |
| 既存generic JSON write helper、同module / `ConfigFileLock` | 共通JSONのatomic replace、durability warning、sidecar lockのRAII |
| `src-tauri/src/viewer_session.rs` / `ViewerSession` | 設定context・settings snapshot・Root切替の調停。Rootと世代の正本はDocumentStoreの単一RootSnapshot |
| `src-tauri/src/instance_launcher.rs` / `InstanceLauncher` | cfg別の別process起動、起動失敗の説明 |
| `src-tauri/src/window_identity.rs` / `WindowIdentity` | titleとinstance一覧の同一表示モデル |
| `src-tauri/src/macos_instances.rs` / `InstanceDirectory`、`WindowMenuController` | macOS限定IPCとnative一覧、activate要求 |
| `lib.rs` | Tauri登録・command adapter・既存render機能の統合 |
| `src/projectSettings.ts` + tests | Root切替世代、設定保存queue、resize保存抑止のpure policy |
| `src/App.tsx` | File / Settings表示、Root操作、UI反映、エラー提示 |

既存AppConfigStoreのread/updateとatomic writeをSettingsRepositoryへ移設し、共通・projectで同一実装を使う。PlantUML runtime resolverとDocumentStoreのpath / protocol検証は維持。module直下関数はTauri commandなどframework adapterと既存pure policyに限り、新規I/Oは所有型のmethodへ置く。新規interfaceの型境界はserde struct / enumとTS unionに限定する。

依存予定: SHA-256用`sha2`、instance ID用`uuid`のv4 feature、macOSのIPC用`tokio`のnet / io-util / time / sync（Tauriと整合する1系）、UID / filesystem検査用macOS限定`libc`。AppKit activationにはmacOS限定の`objc2` / `objc2-app-kit` / `objc2-foundation`を直接依存として宣言し、NSApplication / NSRunningApplication / NSWindowと必要なnotification機能に限定する。実装時にCargo.lockへ解決結果を固定する。File lockはRust stdの1.89以降を使用し、Cargo.tomlのrust-versionとsetup docsへ最低1.89を記載する。現在ローカルrustcは1.95.0。

### 4.1 command / event契約

Rust `SettingsContext`はserdeのtagged enum、TSは`{ kind: "default", rootGeneration: string } | { kind: "project", projectId: string, rootGeneration: string }`。rootGenerationはu64をcanonical十進文字列で渡しJS整数精度へ依存しない。Root未選択は世代0。Rust以外が新contextを発行しない。

変更するcommandのerrorは`ViewerError { code: "staleContext" | "invalidConfig" | "missingConfig" | "io" | "lockTimeout" | "launch" | "activation" | "invalidRequest", message: string, configPath?: string }`。英語messageはUIへ表示し、既存toErrorMessageもこのshapeを認識する。ViewerSettingsLoadResultのwarningは既存のstring配列を維持する。native操作のnoticeはUUIDのidとmessageを持つqueueで取り出す。

| command | 引数 | 戻り値 / 操作 | 旧経路 |
| --- | --- | --- | --- |
| `load_startup_state` | なし | context、settings、recentFolders、presentation、warnings、globalConfigError。RustがNo Folder titleとdefaults sizeを適用し実測baselineを返す | `load_viewer_settings`のstartup用途を置換 |
| `open_root` | path、expectedContext | RootOpenResult（§7）。旧contextと照合後candidate準備・commit | `scan_directory`のopen用途を置換 |
| `reload_root` | context | tree、sessionへ反映したsettings、warnings。Root世代不変・size非適用 | `scan_directory`のReload用途を置換 |
| `load_context_settings` | context | settings、warnings。file読込後session snapshotを更新 | `load_viewer_settings`を置換 |
| `patch_context_settings` | context、patch | 最新fileへ変更fieldだけmergeしたsettings、warnings。session snapshotも更新 | `save_viewer_preferences` / `save_window_size`を置換 |
| `open_document` | context、path | 既存document response。context validationを追加 | 同名commandの契約更新 |
| `render_plantuml_diagrams` | context、sources | 既存render response。session settings snapshot使用 | 同名commandの契約更新 |
| `load_recent_folders` | なし | 既存entries | global lock経路へ更新 |
| `record_recent_folder` / `remove_recent_folder` | path | 既存entries | global lock経路へ更新 |
| `new_window` | なし | 起動要求受理（成功時void） | 新規 |
| `retry_window_presentation` | context | `[presentation, warnings]` | 新規。現session値だけを適用 |
| `drain_viewer_notices` | なし | Rustに保持したnotice配列を取り出す | 新規 |

patchはTSのoptional fieldsとRustの明示PatchField enumで`未指定` / `Set(value)`を区別する。jarの`Set(null)`はClearであり未指定ではない。empty patchはno-op。任意path / generationへの保存は拒否する。

`scan_directory` / `load_viewer_settings` / `save_viewer_preferences` / `save_window_size`は登録・実装・呼出・テストから撤去する。既存Recent commandsは保存先をV2へ一本化する。native menuのrefresh / activateはRust内部methodのみで、不要なfrontend commandを追加しない。

noticeはRust queueを正本とし、`viewer-notices-available` eventは取り出しの通知だけに使う。frontendはlistenerを登録後にstartup loadとdrainを行い、その後eventでdrainする。未登録時もqueueに残り、native dialogとの二重表示経路は持たない。startup global errorはstartup応答にだけ載せる。close時には当該processのqueueを破棄する。

startupはRust側でglobal load / migrationをbackground実行後、main threadで`No Folder — MarkdownViewer`とdefaults logical sizeを適用する。maximized / fullscreen / minimized中はsizeを適用しない。global破損時は表示用既定値のsizeを適用するがJSONへ保存せず明示errorを返す。`presentation { actualLogicalSize: WindowSize | null, sizeApplied: boolean, specialState: boolean }`を返し、frontendは応答までstartup busyとしてresize eventを破棄し、実測sizeをbaselineに設定してからbusyを解除する。startup・Root open・Retryは§7.2の共通presentation policyを使う。getter失敗時はactualLogicalSize=nullとwarningを返し、最初に取得できた実測値をbaselineにするだけで保存しない。startup適用によるresizeでdefaultsを書き戻さない。

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
- 再起動直後は最後のprojectのtheme / sizeではなくglobal defaultsになる。最後のproject設定の復元タイミングはそのfolderを開いた時点へ変わる。session自動復元は行わない。
- Recent FoldersはFileメニューを開く時に最新global entriesを取得する。取得失敗時は以前のsnapshotを残してerrorを表示し、古い一覧と判別できる状態にする。常時同期は行わない。
- Settingsの保存はUIで変更したfieldだけpatchする。themeの単独切替もthemeだけ、resizeはwindowSizeだけ。同じfieldの競合はlock取得後に最後に成功した更新を採用。dialogを開いた時点の他fieldで最新設定を上書きしない。
- PlantUML開始時は現在contextのin-memory settingsからjarをsnapshotし、fileを再読込しない。snapshotはopen / Settings load / Reload / patch成功時に更新する。実行中jobのruntimeは途中で変更せず、結果は既存tab revisionと新しいRoot世代でguardする。

### 6.1 Project identity

既存normalize_pathのcanonical絶対pathを基に、domain文字列`markdown-viewer-project-v1` + platform識別子 + pathのUTF-8 bytesをSHA-256に入力し、64桁hexをprojectIdとする。Windows内部verbatim表記の正規化は一箇所へ固定し、UI表示用pathとは分ける。caseを一律小文字化しない（case-sensitive directoryを混同させない）。symlinkはcanonicalizeにより実体pathへまとめる。

保存済みrootPathとcanonical pathの一致を必ず確認する。不一致はhash衝突 / 不整合エラーとして別directoryの設定を使わない。OSのcanonicalizeが同一表記へ収束しないaliasは別identityとなる制約を明記し、Windowsの大小文字 / drive・UNC表記を実機検証する。移動 / renameは新projectとして扱い、古い設定の自動探索や削除はしない。既存同様UTF-8として扱えないpathは明示errorにする。

### 6.2 移行と破損

- global読込時にsidecar lockを取得し、schemaVersionなしの現行AppConfigを一度だけV2へ変換する。recentFoldersを保持し、viewerSettingsをdefaultSettingsへ移す。
- 現行schemaでviewerSettings省略時は既存既定値、invalid sizeは既存normalize policyとwarningを継続。既知schemaの欠落fieldはtyped defaultで補完する。
- 明示schemaVersionの未知値・不正JSON・rootPath不一致は上書きしない。英語errorを表示し、Settings / Root切替の書込を止める。無断resetや「別ファイルが読めればよい」というfallbackはしない。
- global未作成の場合は既定値で初期化する。旧schemaの読み取りはmigration入口に限定し、通常処理はV2 / ProjectV1へ一本化する。
- globalとprojectのschemaでversion必須、typed validationを行う。旧版アプリとの同時実行・downgradeは保証しない。旧版はlockもV2も理解しないため、移行前に旧版を終了する運用をREADMEに記載する。
- 同じglobal filenameを維持する案を採用する。別名V2 fileは旧版による上書きを防げるが、履歴・defaultsが二重管理となりユーザーが混在に気付きにくいため採用しない。旧版はunknown fieldを無視するので、V2へ保存するとschemaVersion / defaultSettingsを消し、次回migrationでdefaultsが旧版の既定値へ戻る具体的な制約をREADMEへ書く。
- invalidConfig / missingConfig errorにはsettingsファイルの絶対pathを含める。手動復旧は全Viewer終了 → 対象JSONをユーザーが退避 → globalなら再起動、projectなら対象folderを明示openして再生成、とREADMEで案内する。アプリは自動削除・退避をしない。
- global破損時は表示用の既定値でRoot未選択UIを出し明示errorを保持する。既存かつ正常なprojectはglobal defaultsを読む必要がないためopen可能。新project生成・defaults保存・Recent操作はerrorとなる。既存project open後のRecent失敗はwarningのみで閲覧を止めない。初回openはproject存在確認 → 未存在の場合のみglobal defaults snapshot → project lock内で再確認の順にする。
- current project fileが外部削除された場合、patch / Settings load / ReloadはmissingConfig errorとし、勝手に再生成しない。現在のdocumentとsettings snapshotを保持し、別Rootへは移れる。対象folderを明示的に開き直した場合のみ初回生成規則で再作成する。

## 7. 保存排他とRoot切替の整合

### 7.1 ファイル更新

ファイルごとの固定`settings.lock`をread/write/createで開き、File::try_lockのretryに最大2秒を設ける。lock待ちはspawn_blockingで実行しUI threadを占有しない。lockファイルはunlink / replaceしない（inode分裂を防ぐ）。全read / migrate / create / updateが同じlockを使う。

lock取得 → 最新JSON読込 → patch / validation → unique tempへ書込・sync → atomic replace → directory sync → unlockの順。PID + sequenceの既存temp命名と既存Windows MoveFileExW経路を再利用し、共通JSON helperにまとめる。replace前の失敗は旧ファイル保持、replace後のdirectory sync失敗は保存成功+durability warningとして区別する。lock timeoutは保存失敗として表示し、後続の明示操作で再試行可能にする。

globalとproject lockは同時に保持しない。初回作成用defaultsをglobal lock下でsnapshotし解放後、project lockを取る。first-create競合は後着が既存projectを使用する。Recent Foldersはglobal read-modify-writeとdedupeを排他下で行う。

### 7.2 Session contextと非同期処理

Rust ViewerSessionが§4.1の現在contextを発行し、frontendから任意pathを保存先に指定させない。設定保存・renderにcontextを添付し、session現在値と異なる要求はtyped stale errorで拒否する。context検証から設定更新完了まではsession操作gateで直列化する。IPC Infoは小さいsnapshotを読むだけで、このI/O gateを待たない。

全新規・置換commandをasyncとし、file I/O、scan、lock待ち、process終了待ちはspawn_blockingへ移す。session gateの取得待ちもmain threadでは行わない。setupではservice / listener / menu登録だけを行い、global load / migrationはfrontend startup commandへ移す。native操作だけをmain threadへdispatchし、gateを保持したままmain threadの完了待ちをしない。

Root切替:

1. UIのRoot / 設定操作をbusyにし、新規resize debounce受付を止める。旧contextのpending resizeをflushし、進行中設定保存queueを待つ。旧context保存の失敗はwarningとして表示しpendingを破棄して切替を続行する。切替中止はcandidate scan / 設定準備の失敗に限定し、旧設定の破損・lock timeoutでそのprocessを閉じ込めない。
2. `open_root` commandでcandidate treeとproject設定を準備する。DocumentStoreのscan_rootをprepare / commitに分離し、失敗時にcurrent rootを先に変えない。設定生成が成功した後にsession gate内でRootとcontext世代をcommitする。
3. Root commit後、Rustがmain thread上でnative titleとlogical sizeを適用して実測sizeを読む。応答`RootOpenResult { tree, canonicalRootPath, settings, context, presentation: { actualLogicalSize, sizeApplied, specialState }, warnings }`でReactのRoot / tabs / splitをresetしtheme / jarを反映する。frontendはsetSize / setTitleを直接呼ばず、capability追加は不要。context交換時に旧timer・pendingを破棄する。
4. Root切替busy中のresize eventは破棄し、応答の実測sizeを保存不要のbaselineとする。busy解除後はevent payloadの古いサイズを使わずgettersで現在sizeを再取得し、取得開始時contextと現在contextが一致しbaselineと異なる場合だけ保存する。animation frame等の時間窓は使わない。maximized / fullscreen / minimized中はRootのsize適用も保存もしない。通常状態へ戻った際の現在実測sizeを新baselineとして受け入れ、戻る操作自体ではproject設定を上書きしない。次の利用者resizeから新contextへ保存する。特殊状態から戻った際のproject size自動適用は行わず、必要なら通常状態でfolderを開き直す。
5. 一覧snapshotを更新し初期documentを開く。タイトル・OS size適用失敗はRoot成功後のUI適用warningとして表示し、成功したRootを別Rootへrollbackしない。Retryは`retry_window_presentation`へ現在contextを渡し、Rustが現在sessionのtitle / sizeだけを再適用する。baseline更新はopen_rootと共通化し、その間のresizeを抑止する。一覧には新Rootの正しいsnapshotを出す。
6. Recent FoldersはRoot成功後に更新する。履歴保存だけ失敗した時は新Rootを維持し既存どおりwarningを表示する。

Reloadは新Rootのcommitやproject初期化を行わず、現在Rootのtree再scanと最新settings再読込を両方準備してから反映する。どちらかが失敗した場合は既存tree / settingsを保持する。削除済みRootはerrorとして保持する。Root変更で開始済みのdocument / PlantUML応答はrootGeneration不一致で反映しない。

DocumentStoreの正本を`RwLock<Option<RootSnapshot { path, generation }>>`とし、pathとgenerationを単一lockでcommit / cloneする。ViewerSessionに別のcurrent rootを複製しない。open_documentとprotocolはこのsnapshotを一度だけ取得し、そのpathをI/O完了まで利用する。commitと前後した要求が返せるのは取得時の旧Rootまたは新Rootであり、新pathと旧generationの組は作らない。

HTML URLはmacOSで`mvhtml://localhost/document/<generation>/<segments>`、Windowsで`http://mvhtml.localhost/document/<generation>/<segments>`。generationはqueryではなくpathに置くためHTMLの相対CSS / JS / imageにも継承される。parserはcanonical十進generationを検証し、取得snapshotと異なるなら410 Gone、未指定・不正formatは400。generationを除いたsegmentsに既存decode / canonical boundary検査を適用する。旧URL互換は持たない。旧iframeがcommit後に要求したURLは世代不一致で新Rootを読めない。これはwindow別store化ではない。

## 8. タイトルとmacOS Window一覧

タイトルは常に`<directory name> — <parent path> — MarkdownViewer`とする。Phase 0の短いタイトル案から変更し、他processの状態に依存せず同名Rootを識別するため常時親pathを含める。filesystem rootはroot pathをdirectory nameとして表示し、重複parentは省略する。未選択は`No Folder — MarkdownViewer`。同一Root・複数No Folderを含む表示ラベル重複時はWindowメニューだけ`[<instance ID先頭8桁>]`を付加する。ID prefix衝突時は完全UUIDを使う。OS省略表示は許容し、native menuは完全なpath表記を渡す。

Root / identity snapshotはRustを正本にし、document.titleの更新だけでnative title更新を代替しない。起動直後・Root commit後・retryでTauri set_titleを実行する。

### 8.1 macOS限定instance通信

各processがUUID v4のinstanceIdを生成し、Unix domain socketを1つ持つ。RustのmacOS専用InstanceDirectoryが管理し、webview / HTMLへsocket pathやIPC権限を公開しない。

- Runtime領域は短い`/tmp/mv-<uid>-<app identifier SHA256先頭16桁>/`、mode0700。UIDはOS APIで取得。directoryはsymlink_metadataでowner、種別、modeを検証し、他owner / symlink / 不正modeなら作成・通信を拒否する。socket名は`<UUID>.sock`。Unix socket path上限を事前検証する。
- socket一覧を列挙して直接問い合わせるためPIDレジストリや常駐brokerは不要。同ユーザー・同appid・同protocol versionのinstanceだけを扱う。devは別namespace suffixとし配布版へ混在させない。
- typed protocol V1: `Info { version }` → `{id, pid, title, version}`、`Activate { version, id, remaining_ms }` → focused / error。通常Infoは1接続1要求。選択時は同じlive接続上でInfoを再取得してUUID / PIDを照合し、次にActivateを送る2段階handshakeを許す。length prefix付きJSON、最大16KiB。不正型・未知version・過大frameを拒否する。
- Tokioでconnect / 完全frame read-writeをdeadline付きで行い、Infoは1相手250ms、一覧全体2秒、同時接続8件まで。部分一覧時は`Some windows could not be reached`をdisabled menu itemで示す。readerの小分け送信でdeadlineを延長しない。
- macOS 14以降はrequesterのmain threadでlive接続先PIDのNSRunningApplicationを取得し、NSApplication.yieldActivation(to:)でactivationを譲り、target.activateFromApplication(currentApplication, ActivateAllWindows)の成功を確認してからActivateを送る。Phase 3の実機spikeでyieldだけでは失敗し、この明示handoff追加により3条件のgoを確認した。targetはUUIDを再照合し、main threadでNSApp.unhide、deminiaturizeを必要時に実行し、復元完了後にmakeKeyAndOrderFrontとNSApp.activateを行う。taoのset_focus単独やAPI呼出成功だけに依存しない。deminiaturize完了notification / state観測を待ち、待機中main threadを塞がない。
- ackは対象windowがkeyかつNSAppがactiveであることをmain threadで観測して初めて返す。Focused eventは再確認のtriggerとし、window key / app activeの両方を確認する。要求全体のdeadlineはlive Info再取得開始から2秒、遅れて届いたtarget処理は期限切れなら新たなactivateを開始しない。相手終了・timeout・OS拒否はerrorとして表示し一覧をrefreshする。
- 現在のmacOS最低対応versionをこの機能だけで引き上げない。14未満はAPI availability判定で従来のAppKit activation APIを使い、同じkey / active ack条件を適用する。これはOS API availabilityのための必須分岐であり、14以降のhandoff失敗から旧APIへfallbackしない。AppKit bindingのavailability guardとmain-thread ownershipをmacOS adapterへ閉じ込める。
- listenerのin-flight上限8、超過接続は閉じる。InfoはRoot / identity snapshotを読み、設定ファイルへは触れない。通信でファイルopenや設定変更は受け付けない。
- 正常終了で自分のsocketを削除。異常終了の残骸は接続拒否またはNotFoundのみをstaleと判定する。timeoutだけで削除しない。UUID socket pathを再利用しないためstale削除が新processのsocketを消すことはない。親directoryは稼働中に削除しない。

### 8.2 native menu

menu構築は`#[cfg(target_os = "macos")]`に閉じ、Windowsにnative menu barを追加しない。Tauri既定menuの全操作を以下の構成で維持する。

| menu | 項目 |
| --- | --- |
| App | About / Services / Hide / Hide Others / Quit（既定PredefinedMenuItemを維持） |
| File | New Window（Cmd+Shift+N）/ Close Window（Cmd+W） |
| Edit | Undo / Redo / Cut / Copy / Paste / Select All（既定どおり） |
| View | Enter Full Screen（既定どおり） |
| Window | Minimize（Cmd+M）/ Zoom / Close Window / separator / Refresh Window List / separator / instance一覧 |
| Help | 既定Help submenuを維持 |

TauriのOS既定window列挙に他process集約を期待せず、専用IDのsubmenuをWindowとして構成する。local標準一覧との二重表示を避け、自動windows-menu指定を併用しない。各instanceをcheck menu itemとして追加し現在instanceだけcheckする。mudaのclick時自動反転はmenu event受信直後に全itemを`id == self.instanceId`へ戻し、Activate成功 / 失敗とは独立して正しい表示を維持する。一覧はsuffix追加前のtitle、同値なら完全instanceIdで安定sortし、selfだけを先頭移動しない。

起動、Root commit、window focus取得、Refresh操作で一覧取得を要求する。同時refreshは最新世代のみ適用し、main threadでmenu itemを更新する。常時pollingは行わない。別processの起動・終了直後やfocus取得から取得完了まで古いsnapshotが見えることはあり、Refreshで更新できる。選択時はUUIDでlive相手を確認する。native acceleratorとReact操作は同一serviceへ集約する。

自身を選択した場合はhandoffを省略しtarget復元とkey / active確認の共通methodを使う。メニューのerrorは§4.1のnotice queue / drain経路だけで表示する。

## 9. 互換性・セキュリティ・拡張性

capabilityのmain制約とHTML originのIPC禁止は維持する。新規commandはmainからだけ呼べる既存境界へ登録し、汎用shell / arbitrary executable / 任意pathへの設定書込APIを公開しない。

directory設定とruntime socketは別責務。設定schemaのversionを明示し、将来のproject preferenceはViewerSettingsへの追加として扱う。現時点で継承階層、workspace tree、汎用message brokerは作らない。同一ユーザー権限で設定領域を書き換えられるアプリを敵対境界には含めないが、別ユーザーのruntime領域へ接続しない。

## 10. 恒久ドキュメント更新予定

行番号は85fb535時点の目安であり、実装後は対象sectionを検索して更新する。

| file / 現行記述 | 置換・追記内容 |
| --- | --- |
| markdown-viewer-tauri/README.md:47 設定の保存 | directory別保存、再起動はdefaults / folder openで復元、New Window / Window、手動復旧・旧版併用によるdefaults消失、dev / OS制約 |
| docs/components/tauri_viewer/README.md:88 AppConfigStore | SettingsRepository / ViewerSession / launcher / IPCと責務表 |
| docs/components/tauri_viewer/interface_spec.md:17,24,30-36 Settings / File、133 open_document、151 render_plantuml_diagrams、166-182 settings commands | scope表示、field patch、§4.1のcontext引数・session snapshot・command / event、native menu全構成 |
| docs/components/tauri_viewer/detail_design.md:318 protocol read中lock保持、371,387,420 設定store / RMW / busy | 単一RootSnapshotをclone後lock解放しsnapshotでI/O、global / project schema、sidecar lock、settings snapshot、gate・thread・notice queue・activation |
| docs/rules/development_workflow.md:38 単一settings.json | 共通defaults / Recent + projects保存に置換 |
| docs/rules/development_workflow.md:207 再起動size復元 | 再起動直後defaults、folder openでproject復元、特殊window状態の適用skip、複数process検証 |
| docs/architecture/overview.md / code_patterns.md / common_pitfalls.md | process単位Root、context・世代・file lock、HTML新URLと旧経路撤去 |
| docs/tests/README.md | 多process harness、deadline、native activation spike、Windows cfg / Linux未確認の区別 |
| docs/setup/README.md | Rust最低1.89とplatform別build条件 |

比較設計は必要に応じTauri固有差分へのリンクを追記する。採用済み横断判断のADR要否はcompletionで再評価する。

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

多process test harnessはRust test binaryを専用worker testの`--exact` + テスト専用envで再起動し、temp directoryとready barrierを渡す。親がreadyを確認して競合を発生させ、各child / barrierに10秒、case全体30秒のdeadlineを設ける。timeoutはkill / waitで回収しtest失敗。強制終了と再lock取得も実processで確認し、通常appの隠しtest modeは作らない。

追加自動ケース: startup size/title適用と実測baseline・defaultsへ保存しないこと・破損global / getter失敗時の明示error、相対HTML subresourceのgeneration継承、RootSnapshotの原子的read / commit、旧保存失敗でも新Rootへ移れること、special window stateのsize適用・保存skip、global破損時の既存project open / 初回生成失敗、current project file消失、Recent再読込、No Folder重複、check反転の復旧、NFC / NFD path。NFC / NFDがOSで同じ実体を指す場合はcanonical path / hashが一致するか実機でも確認し、別実体は別identityを保つ。

Phase 3の最初に小さなpackaged activation spikeを実装し、macOS 14以降で通常 / 最小化 / 別Space fullscreenの3状態のkey・activeをdeadline内に観測できることをgo条件とする。requester / target双方の結果を記録し、成立しない場合は後続の設定統合へ進まず実際の失敗をユーザーへ報告して導線・要件を再確認する。OSによるfocus制約を成功扱いで隠さない。14未満のAPI分岐はavailable checkで型・呼出を確認し、実機がなければ未確認を残す。

macOS packaged app: 3instanceで別Root・同Rootを開き、Window一覧から選択、最小化復元、背景 / 非表示 / fullscreen切替、親終了後の利用、Cmd+Shift+N、最後のclose後Finder / Dock再起動。強制終了したinstanceを再選択してerror / refresh、同名directory・複数No Folder・長pathの識別を確認する。Cmd+W / Cmd+M / Cmd+Q / Full Screenの既存操作、独自Window submenuへのAppKit自動一覧挿入がないこと、再起動defaults→folder openでproject復元、未移動DownloadsのApp Translocation下でのNew Windowも確認する。

Windows release: ショートカットとFile両方の別PID起動、親終了後の利用、title / taskbar thumbnail見出し、同directory競合、Unicode / drive / UNC、atomic replaceを確認する。macOSでのcargo成功をWindows確認の代替にしない。

Windows cfgのspawn / lock / path codeはWindows上のcargo check / cargo test / release buildを必須確認にする。Windows環境がなければ未確認として残し、macOSの検証成功だけで対応完了とは記載しない。LinuxはNew Window起動と親終了後利用のsmokeを行うか、環境がなければ未確認と記録する。

## 12. リスク・残る実機確認

- macOS native menuの更新とfocus、他instanceの最小化 / fullscreen復元はPhase 3冒頭spikeのgo / no-go項目。cooperative activationのAPIが存在してもOSは成功を保証しないため、設計時点で動作検証済みとはしない。
- 別process方式ではCmd+`による同一processのwindow巡回と本Window一覧は異なる。Cmd+Tab / Dockに同じアイコンのinstanceが複数並ぶ場合があり、単一iconへの集約は保証しない。OS versionごとの実測をREADMEへ記録する。App Translocation中のbundle再起動も未検証で、失敗した場合は検出したbundle pathと起動errorを説明する。
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
- [Apple NSApplication.activate](https://developer.apple.com/documentation/appkit/nsapplication/activate()): requesterからのcooperative handoffと、activate呼出が成功を保証しないこと。
- [objc2-app-kit NSApplication](https://docs.rs/objc2-app-kit/latest/objc2_app_kit/struct.NSApplication.html): yieldActivationToApplication / activateのRust binding。

## 14. レビュー対応履歴

初回レビュー`e2a846d`の18件は`f5fafe3`で解決確認。追加MI-DR-19 / 20も含む全20件が`c4bf9c7`で解決確認され、設計レビュー承認・未解決0件。Phase 3の実機spikeは明示handoff追加でgo確認済み。詳細はimpl記録を参照。

| 指摘 | 反映先 |
| --- | --- |
| MI-DR-01 | §4依存、§8.1 handoff / ack、§11 spike、§12 go / no-go |
| MI-DR-02 | §8.2 native menu完全表、§11既存操作維持 |
| MI-DR-03 | §7.2 Rust適用・実測baseline・特殊state |
| MI-DR-04 | §7.2単一RootSnapshot・URL path generation・410、§11 |
| MI-DR-05 | §4.1 command / event / error / 旧経路撤去 |
| MI-DR-06 | §7.2旧保存失敗はwarningで続行、§11 |
| MI-DR-07 | §1完了条件、§8タイトル理由、TODO / meta同期 |
| MI-DR-08 | §7.2 async / spawn_blocking / setup契約 |
| MI-DR-09 | §6.2破損・消失・手動復旧・global異常時 |
| MI-DR-10 | §6復元時点、§10対象行と置換表 |
| MI-DR-11 | §6 File menuでRecent再読込 |
| MI-DR-12 | §8重複label全般・§8.2安定sort |
| MI-DR-13 | §8.2 click後check復旧 |
| MI-DR-14 | §6.2旧版の無音消失・別filename比較 |
| MI-DR-15 | §11 Translocation・§12 OS巡回制約 |
| MI-DR-16 | §2 Linux提供範囲・§11未確認扱い |
| MI-DR-17 | §11 worker harness / timeout / NFC・NFD / Windows build |
| MI-DR-18 | §6 PlantUMLはin-memory snapshot |
| MI-DR-19 | §4.1 startup presentation・共通baseline・global異常時のsize、§11保存抑止test |
| MI-DR-20 | §10 protocol lock・open_document / renderの恒久docs置換行を追加 |
