# GitHub Release 配布手順書 設計レビュー

**レビュー日**: 2026-07-21

**対象設計**: `docs/design_analysis/documentation/20260721_github_release_guide/design/github_release_guide_design.md`

**対象 meta**: `docs/design_analysis/documentation/20260721_github_release_guide/meta.md`

**レビュー対象コミット**: `5152c15 docs: design GitHub release guide`

**判定**: **条件付き承認 (Conditionally Approved)**。High 指摘を設計へ反映後、Phase 3 進行可。

---

## 概要

新設する `docs/release/README.md` の方針を、`README.md`、`docs/rules/development_workflow.md`、macOS / Windows の publish スクリプト、Tauri / Avalonia のバージョン定義と突き合わせて確認した。

Windows x64 と macOS arm64 に初回配布対象を限定すること、既存 publish コマンドを正本から参照すること、生成物をコミットしないこと、GitHub Actions・署名・DMG 対応を未実装として扱うことは妥当である。一方、反復利用するリリース手順として公開物の同一性と公開可否を判断する停止条件が不足している。

## 1. 必須指摘

### 1.1 バージョン整合を成立させる対象と停止条件が未定義

設計 36 行は「バージョン整合」を公開前チェックへ含めるが、現行のバージョン実体は次のように分散している。

- Tauri: `markdown-viewer-tauri/src-tauri/tauri.conf.json`、`markdown-viewer-tauri/src-tauri/Cargo.toml`、`markdown-viewer-tauri/package.json` は `0.1.0`
- macOS Avalonia: `scripts/publish_apps_with_plantuml.sh` の `Info.plist` 生成部分に `0.1.0` がハードコードされている
- Windows Avalonia: `.csproj` に明示的な `Version` がない

この状態では、`v0.1.0` 以外の Release で既存 publish コマンドを実行しても、成果物の内部バージョンを Release tag と一致させられない。「確認する」だけでは不一致を解消できず、設計 7 行の「繰り返し利用できる手順書」を満たさない。

**推奨対応**: リリースバージョンの確認対象を具体的なファイル・成果物メタデータまで列挙する。現在の仕組みで一致しない場合は公開を止め、別 workflow でバージョン定義または publish スクリプトを更新してから再開する停止条件を設計へ追加する。少なくとも、Avalonia の macOS / Windows 内部バージョンが tag と一致することを検証対象に含める。

**severity**: High

### 1.2 Release tag と各 OS 成果物を同一コミットへ結び付ける条件がない

設計の文書構成は publish・梱包の後に「Git tag と Draft Release の作成」を置いているが、次の条件を定義していない。

- clean worktree から開始すること
- macOS / Windows の双方を同一 commit から build すること
- Release tag がその commit を指すこと
- asset 名、Release notes、チェックサムに対象バージョンと対応アーキテクチャを記録すること
- tag 作成後に再 build した場合も、build 元 commit が変わっていないこと

これらがないと、GitHub Release が示す source tag とダウンロードした実行ファイルのソースを追跡できない。OS ごとの手作業を案内する本手順では特に誤りやすい。

**推奨対応**: 「clean worktree と release commit の確定 → tag 作成または commit SHA 固定 → 各 OS で同じ commit を checkout → publish / package → Draft Release へ登録」という順序を方針化する。tag を build 後に作る場合は、両 OS の build 元 `HEAD` と tag の commit が一致することを公開前チェックへ含める。

**severity**: High

### 1.3 第三者ライセンス確認の範囲と公開停止条件が狭い

設計 36 行は「PlantUML と MIT のライセンス通知」を挙げるが、現行スクリプトは指定された任意の `plantuml.jar` をそのまま配布物へコピーし、その jar の配布版、取得元、バージョン、ライセンスを検証しない。また、実行ファイルやインストーラには NuGet、npm、Cargo 由来の第三者コンポーネントも含まれるため、プロジェクトの `LICENSE` と PlantUML の通知だけで必要な対応が完了すると断定できない。

**推奨対応**: 公開前に、配布する `plantuml.jar` の正確な版・取得元・ライセンス条件を確認して必要なライセンス全文と通知を同梱することを停止条件として定義する。併せて、アプリ依存関係の第三者ライセンス確認と通知要否を確認対象へ含め、「MIT と PlantUML だけで常に十分」と読める表現を避ける。確認できない場合は公開しないことを明記する。

**severity**: High

## 2. 重要な改善指摘

### 2.1 macOS DMG の制約は「可能性」ではなく現行実装で確定している

設計 37 行は DMG に `plantuml.jar` が含まれない「可能性がある」とする。しかし現行スクリプトは、Tauri bundle を build した後に `target/release/bundle/macos/*.app` を `publish/tauri/` へコピーし、そのコピー先へだけ jar を追加する。`tauri.conf.json` に jar の resource 指定もないため、同じ build で先に生成される DMG には jar が入らない。

**推奨対応**: 「現行スクリプトで生成した DMG は配布対象外」と断定し、`publish/tauri/markdown-viewer-tauri.app/Contents/MacOS/plantuml.jar` を確認してから ZIP 化する手順を方針化する。将来スクリプトを修正した後も、DMG を展開またはインストールして jar の同梱を再確認するまで制約を解除しない。

**severity**: Medium

### 2.2 公開前後チェックに配布物そのものの smoke test が明記されていない

設計は公開前後チェックリストを設けるが、更新方針で具体化されているのはバージョン、通知、チェックサム、署名警告である。workspace からの起動確認だけでは、ZIP の欠落、インストーラへの resource 組み込み漏れ、Release asset の取り違えを検出できない。

**推奨対応**: 各 asset について、対象 OS / architecture で次を公開条件に含める。

- ZIP は展開後、インストーラはインストール後の実体から起動する
- `plantuml.jar` の配置を確認し、`sample_docs/plantuml.md` で PlantUML と Mermaid の表示を確認する
- Draft または公開済み Release からダウンロードしたファイルの SHA-256 が `SHA256SUMS.txt` と一致することを確認する
- 署名しない場合は OS 警告と利用者向け回避案内を Release notes に明示する

**severity**: Medium

## 3. 整合確認済み項目

| 項目 | 結果 |
| --- | --- |
| `docs/rules/development_workflow.md` を publish コマンドの正本とする | 整合 |
| macOS arm64 / Windows x64 を初回対象とする | 現行スクリプトの既定 runtime と整合 |
| macOS `.app`、Windows Avalonia、Windows Tauri の出力先 | `publish/avalonia/*`、`publish/tauri/*` の実装と整合 |
| Windows Tauri の NSIS / MSI へ jar を resource として含める | PowerShell スクリプトの一時 resource 設定と整合 |
| `publish/` と `plantuml.jar` をコミットしない | README、development workflow、project rules と整合 |
| ルート README から新手順へ導線を追加する | 現行 README の「ドキュメント」節へ自然に追加可能 |
| `meta.md` | category、各 status、対象・非対象は documentation-workflow の Phase 2 状態と整合 |

## 4. 判定

配布対象、文書配置、README 導線、既存 publish スクリプトを正本とする構成は妥当である。ただし、1.1 のバージョン実体、1.2 の source tag と binary の追跡性、1.3 の第三者ライセンス確認は、公開後に修正しにくい Release asset の正当性に直結する。

したがって **条件付き承認**とする。High 3 件を設計へ反映し、Medium 2 件を設計または Phase 3 の具体的チェックリストへ確実に反映した後に Phase 3 へ進行してよい。
