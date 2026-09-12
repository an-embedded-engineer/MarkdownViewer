# テスト

## 概要

Tauri版はRust unit testとVitest frontend policy testを持つ。ビルド・型チェック・自動test・手動UI確認を品質ゲートとして扱う。WebView固有のsandbox / CSP / custom protocol動作をjsdomだけで証明したとは扱わない。

## テスト構成

```text
MarkdownViewer/
├── Avalonia/MarkdownViewer.Avalonia/      — Avaloniaアプリ本体
├── markdown-viewer-tauri/src/*.test.ts    — Vitest frontend policy test
├── markdown-viewer-tauri/src-tauri/src/   — Rust unit test（`lib.rs`）
└── docs/tests/                            — テスト方針
```

追加候補:

- `Avalonia/MarkdownViewer.Avalonia.Tests/`
- React component / WebView integration test

## テストカテゴリ

- Build check: コンパイル、型チェック、Rust check。
- Automated unit: document response / bridge policy、root / path / MIME / protocol response / bridge injection。
- Automated unit: `tabStrip.test.ts`でitem reveal geometry、非finite入力、6px drag threshold、drop pane narrowing、pointer座標のshell境界判定、pointer / keyboard scrollbar表示stateのOR policyを、`paneRuntime.test.ts`でvisual stateからaccessible suffix / busyへのmappingを検証する。
- Manual UI check: フォルダ選択、Markdown / trusted HTML表示、relative resource、Mermaid / PlantUML、Markdown image viewer（zoom / pan / focus / layout非退行）、TabStripの40px geometry / WebView scrollbar（低速・高速のpointer往復、native scrollbar上通過、明示keyboard modalityの表示切替）/ Pointer Events lifecycle / focus scroll、sandbox / CSP、テーマ切替、Reload。DOM pointer capture、click順、CSS実寸、native scrollbar hit-testとfocus modalityはjsdom未採用のため手動matrixで確認する。
- Publish smoke check: `publish/` 配下の `.app` 起動確認。

## 実行方法

```text
cd markdown-viewer-tauri
npm run build
npm test -- --run

cd src-tauri
cargo fmt -- --check
cargo check
cargo test
```

- 開発・実行ルール: `docs/rules/development_workflow.md`
- テスト方針: `docs/tests/strategy.md`

## 複数process / directory設定

Rustのproject_settings testsはtest binaryをworkerとして起動し、ready barrier後に同一projectの別fieldとRecent Foldersを同時更新する。worker待機は10秒、timeout時はkill / waitで回収する。lock保持workerの強制終了と再取得も確認する。ViewerSession testはcandidate失敗・stale context・旧HTML世代410・snapshot境界を検証する。macos_instances testsはframe上限とread deadline、Vitest projectSettings.test.tsはfield patch・queue・resize baselineを検証する。

検証専用activation_spike exampleとscripts/check_macos_activation_spike.pyは実際に2つのTauri app processを起動する。通常Viewerの設定を変更せず、GUI成立性をJSONに記録する。製品のnative menu・folder picker・Settings dialogとWindows / Linux固有挙動は手動確認に残す。

追加の非GUIテストは、InstanceProtocolのUUID / version / remaining_ms、stale cleanup、partial list、InstanceDirectoryのowner / symlink / mode、WindowListの重複 / sort / check、bundle判定とshell非使用argv、startup破損global、WebView再接続、readonly保存失敗、初回create競合、Root失敗時queue保持を対象にする。native activation callbackはテスト用応答に置き換えてprotocol境界を検証し、製品のAppKit表示成功を証明したとは扱わない。GUI・OS固有の未確認matrixは案件impl記録に対応表を置く。
