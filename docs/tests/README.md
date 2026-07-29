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
- Automated unit: `tabStrip.test.ts`でitem reveal geometry、非finite入力、6px drag threshold、drop pane narrowing、pointer座標のstrip境界判定を、`paneRuntime.test.ts`でvisual stateからaccessible suffix / busyへのmappingを検証する。
- Manual UI check: フォルダ選択、Markdown / trusted HTML表示、relative resource、Mermaid / PlantUML、Markdown image viewer（zoom / pan / focus / layout非退行）、TabStripの40px geometry / WebView scrollbar（低速・高速のpointer往復とkeyboard `:focus-visible`の表示切替）/ Pointer Events lifecycle / focus scroll、sandbox / CSP、テーマ切替、Reload。DOM pointer capture、click順、CSS実寸、native scrollbar再描画とfocus modalityはjsdom未採用のため手動matrixで確認する。
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
