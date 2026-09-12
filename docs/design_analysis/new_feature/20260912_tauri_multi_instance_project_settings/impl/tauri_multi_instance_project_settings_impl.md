# Tauri別プロセス・directory設定 実装記録

## 状態

初回実装レビュー8件へ対応済み。再レビュー待ち。Phase 4のユーザー動作確認は未実施。

## Activation spikeのgo判定

通常Viewerの設定に触れない専用Tauri exampleを`.app`に梱包し、同じbundleを2プロセス起動した。Rust AppKit操作とnative stateを25ms間隔で記録し、requester / target双方を比較した。

| 経路 | 結果 |
| --- | --- |
| yieldActivation + target activate | 通常windowでも2秒以内にactive / keyを取得できず失敗 |
| yieldActivation + requesterがtarget.activateFromApplication(ActivateAllWindows) + target復元 | 通常68ms、最小化647ms、別Space fullscreen401msで成功 |

成功条件はkey / activeに加えonActiveSpaceを確認した。fullscreen targetは前状態でonActiveSpace=false、後状態でtrue。環境はmacOS 26.6.2。失敗経路を本体fallbackとして残さず、明示handoff経路を採用する。

- [初回失敗の記録](activation_spike/activation-results.json)
- [明示handoffの成功記録](activation_spike/explicit_handoff/activation-results.json)
- 再現: `cargo build --example activation_spike`後、`scripts/check_macos_activation_spike.py --strategy yield-explicit`。通常設定には書き込まず検証専用windowのみを操作する。

## 実装と設計差分

| 対象 | 実装 |
| --- | --- |
| InstanceLauncher | macOS bundleのopen -n -a / raw current_exe spawn、重複起動要求guard、親終了でchildをkillしない |
| WindowIdentity / WindowMenuController | Root名・parent title、native全menu操作維持、UUID socket Info / Activate、deadline、partial表示、check復旧 |
| SettingsRepository | global V2へのmigration、project V1、canonical path SHA-256、固定sidecar lock、field patch、既存projectはglobal破損時もopen可 |
| ViewerSession / DocumentStore | context gate、単一RootSnapshot、candidate成功後commit、snapshotと世代でHTML旧要求410、in-memory jar |
| React SettingsQueue | startup / Root切替 / Retryのbusyと実測baseline、500ms resize、旧保存flush失敗でも切替継続、field差分patch、旧contextの非同期結果拒否 |

Phase 2から明確化した点:

- 前面化にはrequester側のactivateFromApplicationを追加し、設計§8.1を実機結果に合わせる。対象自身によるactivateだけでは成立しなかった。
- presentationへspecialStateを追加し、特殊window状態でRoot変更した場合も通常状態への復帰を保存しない。actualLogicalSizeは全適用経路でnullableを共有する。
- new_windowは成功時void、retry_window_presentationは`[presentation,warnings]`。既存ViewerSettingsLoadResultのwarningsはstring配列を継続する。native noticeはUUID付きid/message queueで表示する。
- 既存atomic JSON write helperをgeneric化して再利用し、不要な二重write実装を作らない。directory sync失敗は既存契約どおり保存成功+stderr warning。
- cfg(test)のscan_root / open_documentは既存DocumentStore fixture用。アプリcommandとして旧scan_directory / settings commandsは登録・実装から撤去した。

## 恒久ドキュメント

Tauri README、component basic / detail / interface / README、architecture overview / code patterns / pitfalls、development workflow、setup、testsへ起動・設定・migration・Root世代・thread / lock / IPC・復旧と検証手順を反映した。

## 検証

| コマンド / 確認 | 結果 |
| --- | --- |
| cargo build --offline --example activation_spike | 成功 |
| macOS packaged activation spike | 上記3条件成功、初回失敗と修正の記録あり |
| npm run build | 成功（Viteの既存chunk size warningあり） |
| npm test -- --run | 118件成功 |
| cargo check --offline | 成功 |
| cargo test --offline（socket bind許可環境） | 46件成功。子processによる同時保存・Recent更新・lock timeout・強制終了後unlockを含む |
| cargo fmt -- --check | 成功 |
| CARGO_NET_OFFLINE=true npm run tauri -- build --bundles app --ci | 成功。target/release/bundle/macos/markdown-viewer-tauri.app |

## 未確認と後続確認

- 製品UIのfolder picker、Settings dialog、native Window一覧の手動matrixはPhase 4ユーザー動作確認へ残す。spike成功を製品UI全体の確認に置き換えない。
- Windows上のcargo check / test / release build、taskbarタイトル、UNC / case aliasはこのmacOS環境で未確認。
- Linux UI、macOS 14未満、App Translocation、macOS NFC / NFD identityは該当条件で未確認。
- 配布版起動でのuser設定migrationを無断検証する代わりに、temp fixtureでmigration / unknown schema / broken global / missing projectを検証した。

## 実装レビュー

acbf345で最終レビュー承認。初回8件・追加1件の全9件解決、未解決0件。

## 初回実装レビュー対応

review commit: dc34e0b。MI-IR-01〜08へ対応し、2f292acで全件解決確認済み。

| ID | 対応 |
| --- | --- |
| MI-IR-01 | InstanceDirectory / InstanceProtocol / WindowListを非GUI境界へ分離してテスト追加。下表で未確認matrixも明示 |
| MI-IR-02 | StartupStateにcanonicalRootPath / treeを追加し、WebView再読み込みでRootと設定対象を復元。回帰test追加 |
| MI-IR-03 | 準備からcommitまでgateを保持する理由を設計 / detail docsへ明記（競合初期化の直列化を優先） |
| MI-IR-04 | native menu設置をruntime準備の前へ移動。失敗時もNew WindowとRefreshを残しunavailable表示 |
| MI-IR-05 | 一時的accept errorは100ms backoffで再試行、回復不能時は明示停止・再起動案内。分類test追加 |
| MI-IR-06 | CREATE_NO_WINDOW定数を再利用し、debug console / release GUIの効果をcommentで訂正 |
| MI-IR-07 | component説明・リンク・ViewerErrorを修正し、architecture各文書を役割別に整理。主要commitもmetaへ追加 |
| MI-IR-08 | 起動時の表示遷移とWebView再読み込みをPhase 4確認matrixへ追加 |

### 設計§11の検証対応表

| ケース | 自動検証 / 状態 | 未実施の理由・確認先 |
| --- | --- | --- |
| 初回生成 / migration / defaults分離 / schema異常 / missing project / readonly | repository tests（readonlyはmacOS非root） | Windowsのreadonly / atomic replaceはWindows実機でPhase 4確認 |
| 同process/別processのfield更新、Recent、初回create競合、lock timeout / 強制終了解放 | actual child worker tests | 実ユーザー設定のmigrationは旧Viewerを終了した上でPhase 4確認 |
| contextの非canonical値、candidate失敗・stale保存・Root alias、WebView再接続、Reload世代 | session tests | WebViewの実際の再読込操作と表示・保存先は製品UIでPhase 4確認 |
| 旧HTML世代410、generation欠落/不正400、相対resource、root外拒否 | document / session tests | 製品iframe / Mermaid / PlantUMLの表示matrixはPhase 4確認 |
| 2サービスのInfo / Activate応答、UUID / version / remaining_ms、stale cleanup、timeout、partial | Unix listener/streamのprotocol tests。native callbackだけテスト用応答 | 製品IPC + AppKitのend-to-endは製品bundleでPhase 4確認。spikeはfile経由のため代替としない |
| runtime owner / mode / symlink / path長 | InstanceDirectory tests（other ownerは期待uid不一致で検証） | 実際のnative menuがunavailable表示でもNew WindowできることはPhase 4確認 |
| No Folder重複 / UUID prefix衝突 / sort / self check | WindowList pure tests | AppKitのチェック自動反転と再描画・keyboardは製品menuでPhase 4確認 |
| title root / 同名異path / 日本語・空白、bundle判定 / argv | identity / launcher tests | NFC/NFD・Windows drive/UNC/case・Translocationは各実機のPhase 4確認 |
| queue直列化 / Root失敗保持 / 旧flush失敗後の移動 / startup・特殊state baseline / field patch | Vitest | Settings modal対象表示・focus・実resize / startup適用時に保存しないことはPhase 4確認 |
| native通常 / 最小化 / 別Space fullscreen activation | packaged Tauri spikeで確認 | 製品経路、非表示、親終了、失効item、Cmd+W/M/Q/Full ScreenはPhase 4確認 |
| 起動直後800x600→defaults表示遷移 | 未実施（native視覚確認が必要） | Phase 4で目立つ場合は初期非表示→presentation後表示をfollow-up検討 |
| Windows cfg build・release / Linux UI / macOS14未満 | 未実施（該当環境なし） | Windows / Linux / 対象macOSの実機で確認し、未確認を成功扱いにしない |

Unix socketのbindはsandboxでOperation not permittedとなったため、同じcargo testをsandbox外で再実行して検証した。テストをskipして成功扱いにはしていない。

## Round 1追加指摘対応

MI-IR-09: window_identity.rsのtest moduleをファイル末尾へ移動。製品コードの動作変更なし。cargo fmt -- --check、タイトルの対象test（1件）、cargo clippy --offline --all-targetsが成功。新規warningは0件、lib.rsの既存warning 2件（derivable_impls / items_after_test_module）のみ。acbf345で解決確認済み。

## Phase 3完了・引継ぎ

最終レビュー承認: acbf345。Phase 4-aはユーザー承認待ち。上記matrixの未確認項目は引き続き未確認であり、レビュー承認を製品GUIやWindows動作確認の代替としない。

確認用appは `publish/tauri/TODO-2026-029/markdown-viewer-tauri.app` に配置（生成物・非コミット）。ff84654のrelease build成果物をコピーした。以降のsource差分はtest moduleの配置のみ。実利用者の設定を用いた製品起動は実施していない。
