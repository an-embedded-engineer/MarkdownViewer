# GitHub Release 配布手順書 実装文書レビュー

**レビュー日**: 2026-07-21

**対象コミット**: `700b8c9 docs: add GitHub release distribution guide`

**主対象**: `docs/release/README.md`、`README.md`、`impl/github_release_guide_impl.md`

**判定**: **要修正 (Changes Required)**。High 2件を解消し、文書検証結果を実施記録へ反映した後に再確認が必要。

## 概要

publish コマンド、出力先、version 定義、DMG 制約、README の導線、外部リンクを既存文書とスクリプトへ突き合わせた。release commit に annotated tag を付け、両 OS で同じ tag commit を build する順序は設計レビューの指摘に沿っている。現行 DMG を配布対象外とする判断も実装と一致する。

一方、記載された梱包例はライセンス通知を実際には含めず、Windows installer については通知を組み込む手段が現行設定にも手順にもない。また、OS 間で成果物を集約する工程がないため、checksum と `gh release create` のコマンドを一連の手順として実行できない。

## 1. 必須指摘

### 1.1 ライセンス同梱を満たす正式な梱包手順がない

`docs/release/README.md` 142行は ZIP に `LICENSE` と第三者通知を含めると定義するが、146～158行の唯一の macOS コマンド例は `.app` を直接 ZIP 化するため、どちらも含まれない。160行は staging directory を作るよう説明するだけで、その directory 構成とコマンドがないため、例をコピーした利用者はチェックリスト31行を満たさない asset を作る。

Windows Tauri はさらに、162行で installer 内の通知を「確認」するだけである。現行 `publish_apps_with_plantuml.ps1` が一時 resource として組み込むのは `plantuml.jar` だけであり、`tauri.conf.json` にプロジェクト `LICENSE` や第三者通知の resource 定義はない。したがって現行手順から生成した NSIS / MSI 単体は、118～125行が要求する通知同梱を成立させられない。

**推奨対応**:

- macOS 2実装と Windows Avalonia について、アプリ本体、`LICENSE`、`THIRD_PARTY_NOTICES.txt`、必要なライセンス全文を staging directory へコピーし、その directory を ZIP 化する実行可能な完全例へ置き換える。
- Tauri installer は、別 workflow で license files を installer resource へ組み込むまで公開停止とするか、installer と通知一式を1つの配布 ZIP に入れる方針へ asset 表・命名・smoke test を統一する。
- `java -jar <jar> -version` と `java -jar <jar> -license` など、実際の jar の版・ライセンスを記録する確認例を加える。

**severity**: High

### 1.2 OS別 asset の集約工程がなく、checksum／CLI登録手順が完結しない

macOS の例は `publish/release-assets/v0.1.0/` に2個の ZIP を作るが、Windows Avalonia ZIP、NSIS、MSI を同じ directory へどの名前でコピーし、macOS または Windows のどちらへ集約するかを定義していない。その状態で174行は「全 asset を1つの directory に集めた後」とだけ述べ、178～180行と197～203行は全 asset がローカルに存在する前提で checksum 生成と upload を行う。

また、`*.msi` は任意 asset であるため、zsh では存在しない glob がコマンド実行前にエラーになる。183行の「存在しない拡張子は glob から外す」は手動編集を要求し、忘れにくい反復手順として不安定である。

**推奨対応**:

- Windows 側の staging、ZIP、NSIS / MSI の実ファイル選択と rename を PowerShell コマンドで明記する。
- OS間の受け渡し方法を Actions artifact、別の一時共有先、または OS ごとの `gh release upload` のいずれかへ固定する。
- checksum をどの環境で最終生成するかを固定し、存在する通常ファイルだけを列挙する安全な例にする。
- `gh release create` はその環境に存在する asset だけを渡し、残りを `gh release upload` する構成にする場合は、その順序も記載する。

**severity**: High

## 2. 重要な改善指摘

### 2.1 version 整合の確認対象はあるが、成果物の確認方法が具体化されていない

45～55行は version 定義と公開停止条件を正しく列挙している。しかし、生成後の Avalonia assembly / file version、macOS `Info.plist`、Tauri bundle / installer metadata を確認するコマンドがなく、217行も「version 表示または成果物メタデータ」と選択的である。現行 Avalonia `.csproj` に明示 version がないため、この確認は初回 `v0.1.0` でも実際に停止判断へ直結する。

**推奨対応**: OS・成果物ごとの確認コマンドと期待値を示し、全成果物について tag との一致を必須にする。現在一致しない Avalonia は、55行の停止条件に従い別 workflow で version 定義を整備することを初回リリースの前提として明示する。

**severity**: Medium

### 2.2 Release notes の「必要環境」が抽象的で、配布利用者向け前提を落としやすい

36行と191行は必要環境を記載するとするが、具体的な確認項目や notes 雛形がない。配布物は `plantuml.jar` を含む一方 Java runtime を含まず、Windows は WebView2 Runtime を利用する。macOS Avalonia の生成 `Info.plist` は minimum system version 13.0 を設定している。

**推奨対応**: Release notes の必須項目として、確認済み OS version、CPU architecture、Java の要否と確認済み／必要 version、Windows WebView2、署名・notarization 状況を列挙する。Java の最低 version は推測せず、配布する jar と smoke test 結果から確定する。

**severity**: Medium

### 2.3 実施記録に Phase 3 の文書検証結果がない

`impl/github_release_guide_impl.md` 25～27行は「Phase 3 レビュー反映後に追記する」とだけ記載し、実行コマンドと結果がない。documentation-workflow Phase 3 が求めるリンク、索引、重複、docs-only の検証記録を満たしていない。

**推奨対応**: 少なくとも `git diff --check`、変更ファイル一覧による docs-only 確認、README と相対リンクの存在確認、旧記述・重複記述の `rg` 確認、外部公式リンクの到達確認を実行し、コマンドと結果を実施記録へ追記する。

**severity**: Medium

## 3. 整合確認済み項目

| 項目 | 結果 |
| --- | --- |
| macOS / Windows publish コマンドと既定出力先 | `docs/rules/development_workflow.md`、setup docs、両 publish script と整合 |
| Windows Tauri の `plantuml.jar` | PowerShell script の一時 resource 設定により installer へ組み込まれる |
| 現行 macOS DMG の扱い | bundle 生成後にコピー先 `.app` へだけ jar を追加する実装と整合し、配布対象外の判断は正しい |
| release commit / tag 順序 | clean release commit → annotated tag → 両 OS で同じ tag commit を checkout する構成で設計方針と整合 |
| version 定義 | Tauri 3定義は `0.1.0`、macOS Avalonia `Info.plist` は script 内 `0.1.0`、Avalonia `.csproj` は明示 version なしとの記載が正しい |
| README 導線と相対リンク | `README.md` から `docs/release/README.md` へ到達でき、development workflow の `#publish` / `#テスト` 参照先が存在 |
| 外部リンク | PlantUML FAQ、GitHub Release 管理、Tauri の macOS / Windows signing、GitHub Actions guide は到達可能 |
| docs-only | 対象コミットの変更は Markdown 4ファイルのみ |

## 4. 判定

tag / commit の追跡性、DMG 制約、公開前後の smoke test、公式リンクは妥当である。しかし、現状のコマンド例からはライセンス条件を満たす asset を生成できず、全 OS の asset を集約して checksum と Draft Release 登録まで完了することもできないため、**要修正**とする。

High 2件の手順を実行可能なコマンドへ具体化し、Medium 指摘と文書検証結果を反映した後に再レビューする。

---

## 5. 再レビュー（2026-07-21）

**再レビュー対象**: 初回レビュー後の `docs/release/README.md` 未コミット差分

**判定**: **条件付き承認 (Conditionally Approved)**。前回の High 2件は解消。以下の Medium 2件を反映した後は再レビュー不要。

### 5.1 前回指摘の確認結果

| 指摘 | 結果 | 確認内容 |
| --- | --- | --- |
| High 1.1 ライセンス同梱を満たす正式な梱包手順 | 解消 | macOS 2実装、Windows Avalonia、Windows Tauri NSIS / MSI のすべてで、アプリまたは installer、`LICENSE`、`THIRD_PARTY_NOTICES.txt`、`third_party_licenses/` を staging して ZIP 化する完全例になった。通知ファイル未作成時の公開停止条件と PlantUML の version / license / SHA-256 確認例も追加された。 |
| High 1.2 OS別 asset の集約工程 | 解消 | 1台へ集約せず、各 OS で asset ごとの `.sha256` を作り、空の Draft Release 作成後に同一 tag へ `gh release upload` する構成へ統一された。任意 MSI による未展開 glob 問題も解消した。 |
| Medium 2.1 version 確認方法 | 一部解消 | macOS bundle と Windows raw executable の確認コマンド、および初回 Release 前の Avalonia version 定義整備が追加された。下記 5.2.1 は残る。 |
| Medium 2.2 Release notes の必要環境 | 解消 | OS / CPU、Java、WebView2、macOS minimum version、署名・notarization、DMG 制約が必須項目として具体化された。 |
| Medium 2.3 実施記録の文書検証結果 | 解消 | `git diff --check`、docs-only、ローカルリンク、旧記述・必須停止条件、外部公式リンクの確認結果が追記された。 |

### 5.2 残指摘

#### 5.2.1 version 確認コマンドが宣言した確認範囲を満たしていない

4.1 は Avalonia macOS の `CFBundleShortVersionString` と `CFBundleVersion` の両方を対象とするが、追加コマンドが読むのは前者だけである。また Windows 節は「生成後とインストール後の実行ファイル」を確認すると書く一方、例は `publish/avalonia/...` と `publish/tauri/raw/...` の生成物だけを読み、NSIS / MSI からインストールされた Tauri executable を確認していない。

**推奨対応**: macOS 2 bundle について両 key を確認する。Windows はインストール先 executable の `VersionInfo` 確認を smoke test 側へ明記し、raw Tauri executable と installer 経由の実体が同じ release version であることを必須にする。

**severity**: Medium

#### 5.2.2 既存 asset directory に古い成果物が残り得る

staging directory は既存なら停止するが、asset directory は `mkdir -p` / `New-Item -Force` で再利用する。失敗後に staging だけを除去して再実行した場合や、任意 MSI を今回は作らなかった場合、同じ version directory の古い ZIP / `.sha256` が残り、checksum loop と `gh release upload .../*` がそれを公開し得る。

**推奨対応**: macOS / Windows とも、作業開始時に OS 別 asset directory が存在したら停止するか、OS 別の新規 directory を使用する。自動削除ではなく fail-fast とし、利用者が対象を確認してから退避または削除する運用を記載する。

**severity**: Medium

### 5.3 軽微な整合補正

ライセンス確認節の「各 ZIP／installer 内」は、現在の配布方針では installer 自体ではなく「各 Release asset ZIP 内」が正確である。Windows installer をライセンス一式と同じ ZIP に包む方針へ合わせて用語を統一することを推奨する。

### 5.4 再レビュー結論

ライセンスを含む配布 ZIP と OS 別 upload の手順が具体化され、前回の公開阻害要因は解消した。残る指摘は、version 検証範囲と再実行時の stale asset 防止であり、いずれも既存方針を変えない局所補正である。workflow 実施記録の文書検証結果も確定した。

したがって **条件付き承認**とする。5.2 の2件を反映すれば Phase 3 を完了してよい。
