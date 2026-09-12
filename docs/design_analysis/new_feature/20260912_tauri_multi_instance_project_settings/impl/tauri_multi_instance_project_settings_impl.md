# Tauri別プロセス・directory設定 実装記録

## 状態

Phase 3実装draft。実装レビュー前。Phase 4のユーザー動作確認は未実施。

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
| npm test -- --run | 117件成功 |
| cargo check --offline | 成功 |
| cargo test --offline | 31件成功。子processによる同時保存・Recent更新・lock timeout・強制終了後unlockを含む |
| cargo fmt -- --check | 成功 |
| CARGO_NET_OFFLINE=true npm run tauri -- build --bundles app --ci | 成功。target/release/bundle/macos/markdown-viewer-tauri.app |

## 未確認と後続確認

- 製品UIのfolder picker、Settings dialog、native Window一覧の手動matrixはPhase 4ユーザー動作確認へ残す。spike成功を製品UI全体の確認に置き換えない。
- Windows上のcargo check / test / release build、taskbarタイトル、UNC / case aliasはこのmacOS環境で未確認。
- Linux UI、macOS 14未満、App Translocation、macOS NFC / NFD identityは該当条件で未確認。
- 配布版起動でのuser設定migrationを無断検証する代わりに、temp fixtureでmigration / unknown schema / broken global / missing projectを検証した。

## 実装レビュー

レビュー準備中。
