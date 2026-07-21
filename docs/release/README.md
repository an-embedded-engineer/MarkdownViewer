# GitHub Release 配布手順

## 1. 目的

Avalonia 版と Tauri 版の publish 済み実行ファイル／インストーラを、GitHub Release からダウンロードできる状態にするための手順をまとめる。

publish コマンド自体の正本は [開発・実行ルール](../rules/development_workflow.md#publish) とし、この文書では release commit の確定、配布用の梱包、GitHub Release への登録、公開確認を扱う。

## 2. 初回の配布対象

最初は現行 publish スクリプトの既定環境に合わせ、次を対象とする。

| 実装 | OS / architecture | Release asset | publish 元 |
| --- | --- | --- | --- |
| Avalonia | macOS arm64 | `.app` とライセンス通知を含む ZIP | `publish/avalonia/MarkdownViewer.Avalonia.app` |
| Tauri | macOS arm64 | `.app` とライセンス通知を含む ZIP | `publish/tauri/markdown-viewer-tauri.app` |
| Avalonia | Windows x64 | self-contained publish とライセンス通知を含む ZIP | `publish/avalonia/win-x64/` |
| Tauri | Windows x64 | NSIS installer | `publish/tauri/bundle/nsis/` |
| Tauri | Windows x64 | MSI installer（必要な場合） | `publish/tauri/bundle/msi/` |

Linux、macOS x64、Windows arm64 を追加する場合は、対象環境での publish、PlantUML runtime 配置、起動確認を別途定義してから配布対象へ加える。

## 3. 全体チェックリスト

- [ ] release version と対象 OS / architecture を決めた
- [ ] version の全定義と成果物内 version が release tag と一致する
- [ ] clean な release commit を作成し、annotated tag を付けた
- [ ] macOS と Windows で同じ tag commit を checkout した
- [ ] 各 OS で build / test / publish が成功した
- [ ] 配布する PlantUML jar と全依存関係のライセンス条件を確認した
- [ ] 必要なライセンス全文と third-party notices を配布物へ含めた
- [ ] asset 名へ version、OS、architecture を含めた
- [ ] SHA-256 checksum を作成した
- [ ] Draft Release へ asset を添付した
- [ ] Draft Release から再ダウンロードした配布物で smoke test を実施した
- [ ] Release notes に必要環境、署名状況、既知制約、source commit を記載した
- [ ] 公開後のダウンロードと checksum を再確認した

いずれかの公開条件を確認できない場合は Release を公開せず、Draft のまま原因を解消する。

## 4. release version と commit を確定する

### 4.1 version の確認対象

少なくとも次の値を同じ version にする。

- Tauri:
  - `markdown-viewer-tauri/src-tauri/tauri.conf.json` の `version`
  - `markdown-viewer-tauri/src-tauri/Cargo.toml` の `package.version`
  - `markdown-viewer-tauri/package.json` の `version`
- Avalonia:
  - `scripts/publish_apps_with_plantuml.sh` が生成する `Info.plist` の `CFBundleShortVersionString` と `CFBundleVersion`
  - `.csproj` から生成される assembly / file version

現状は version の一元管理が未整備で、Windows Avalonia の `.csproj` に明示 version がない。tag と成果物内 version を一致させられない場合は公開を止め、仕様変更または軽微変更 workflow で version 定義と publish スクリプトを更新してから再開する。手動で生成物だけを書き換えない。

### 4.2 release commit と tag

version 更新、必要な文書更新、build / test が完了した commit を release commit とする。未コミット差分がないことを確認して annotated tag を付ける。

```bash
git status --short
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

各 build 環境では同じ tag を checkout し、tag と `HEAD` が一致することを記録する。

```bash
git fetch origin --tags
git switch --detach v0.1.0
git rev-parse HEAD
git rev-list -n 1 v0.1.0
```

2つの SHA が一致し、macOS と Windows でも同じ SHA になっていることを公開条件とする。

## 5. build / test / publish

### 5.1 macOS arm64

依存関係を復元し、[開発・実行ルール](../rules/development_workflow.md#テスト) の検証を行ってから、リポジトリルートで実行する。

```bash
./scripts/publish_apps_with_plantuml.sh \
  --plantuml-jar /absolute/path/to/plantuml.jar
```

次を確認する。

```text
publish/avalonia/MarkdownViewer.Avalonia.app/Contents/MacOS/plantuml.jar
publish/tauri/markdown-viewer-tauri.app/Contents/MacOS/plantuml.jar
```

### 5.2 Windows x64

依存関係を復元し、[開発・実行ルール](../rules/development_workflow.md#テスト) の検証を行ってから、リポジトリルートの PowerShell で実行する。

```powershell
.\scripts\publish_apps_with_plantuml.ps1 `
  -PlantUmlJar C:\absolute\path\to\plantuml.jar `
  -Runtime win-x64 `
  -TauriBundles "nsis,msi"
```

次を確認する。

```text
publish/avalonia/win-x64/plantuml.jar
publish/tauri/raw/plantuml.jar
publish/tauri/bundle/nsis/
publish/tauri/bundle/msi/
```

## 6. ライセンス確認

`LICENSE` はプロジェクト本体の MIT License である。配布物にはこれに加え、実際に同梱する第三者コンポーネントについて必要なライセンス全文と通知を含める。

公開前に次を記録する。

- `plantuml.jar` の version、入手元、SHA-256、配布版のライセンス
- PlantUML jar 内の依存物を含む、jar の再配布条件
- NuGet、npm、Cargo の直接／間接依存関係と通知要否
- 各 ZIP／installer 内でライセンス全文と通知を確認できる場所

PlantUML には複数のライセンス版がある。ファイル名だけで判断せず、実際に配布する jar を確認する。必要な通知内容や再配布条件を確定できない場合は公開しない。参考: [PlantUML FAQ](https://plantuml.com/faq)

## 7. Release asset を作る

asset 名は次の形式へ揃える。

```text
MarkdownViewer-Avalonia-v0.1.0-macos-arm64.zip
MarkdownViewer-Tauri-v0.1.0-macos-arm64.zip
MarkdownViewer-Avalonia-v0.1.0-windows-x64.zip
MarkdownViewer-Tauri-v0.1.0-windows-x64-setup.exe
MarkdownViewer-Tauri-v0.1.0-windows-x64.msi
SHA256SUMS.txt
```

作業用 staging directory は、コミット対象外の `publish/release-assets/<tag>/` 以下に作る。ZIP にはアプリ本体だけでなく、プロジェクトの `LICENSE` と確認済みの third-party notices / license files を含める。

macOS の `.app` は Finder metadata を保持できる `ditto` で ZIP 化する。

```bash
RELEASE_VERSION="v0.1.0"
ASSET_DIR="publish/release-assets/${RELEASE_VERSION}"
mkdir -p "${ASSET_DIR}"

ditto -c -k --sequesterRsrc --keepParent \
  publish/avalonia/MarkdownViewer.Avalonia.app \
  "${ASSET_DIR}/MarkdownViewer-Avalonia-${RELEASE_VERSION}-macos-arm64.zip"

ditto -c -k --sequesterRsrc --keepParent \
  publish/tauri/markdown-viewer-tauri.app \
  "${ASSET_DIR}/MarkdownViewer-Tauri-${RELEASE_VERSION}-macos-arm64.zip"
```

上記は `.app` の ZIP 化例である。正式 asset では、`LICENSE` と確認済みの第三者通知を含む staging directory を作成し、その directory を ZIP 化する。

Windows Avalonia は `publish/avalonia/win-x64/`、`LICENSE`、第三者通知を1つの staging directory へコピーし、`Compress-Archive` で ZIP 化する。Tauri installer は、bundle 内に必要なライセンス通知が組み込まれていることを確認してから、asset 命名規則に合わせてコピーする。

## 8. 現行 macOS DMG の制約

現行 `scripts/publish_apps_with_plantuml.sh` は Tauri bundle を生成した後、`publish/tauri/` へコピーした `.app` にだけ `plantuml.jar` を追加する。このため、同じ処理で先に生成される DMG には `plantuml.jar` が含まれない。

現行スクリプトで生成した DMG は Release asset にしない。jar 入りであることを確認した `publish/tauri/markdown-viewer-tauri.app` を ZIP 配布する。

将来 DMG 作成処理を修正した場合も、DMG からインストールした `.app/Contents/MacOS/plantuml.jar` と PlantUML 表示を確認するまで、この制約を解除しない。

## 9. checksum を作る

最終的な全 asset を1つの directory に集めた後、SHA-256 を生成する。

macOS:

```bash
cd publish/release-assets/v0.1.0
shasum -a 256 *.zip *.exe *.msi > SHA256SUMS.txt
```

存在しない拡張子は glob から外す。Windows では各ファイルに `Get-FileHash -Algorithm SHA256` を実行し、同じ asset 名と hash を `SHA256SUMS.txt` に記録する。

## 10. Draft Release を作る

GitHub の [Releases](https://github.com/an-embedded-engineer/MarkdownViewer/releases) で `Draft a new release` を選び、次を設定する。

1. tag: release commit を指す `v0.1.0`
2. title: `MarkdownViewer v0.1.0`
3. Release notes: 対象 OS / architecture、source commit、必要環境、asset 一覧、署名状況、既知制約
4. assets: OS別 ZIP／installer と `SHA256SUMS.txt`
5. 初回確認中は `Save draft`

GitHub CLI を使う場合:

```bash
gh release create v0.1.0 \
  publish/release-assets/v0.1.0/* \
  --title "MarkdownViewer v0.1.0" \
  --generate-notes \
  --draft
```

GitHub Release は tag に基づいて作成し、実行ファイルなどを asset として添付できる。詳細は [GitHub の Release 管理手順](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) を参照する。

## 11. Draft Release の smoke test

ローカル staging file ではなく、Draft Release からダウンロードした asset を使って確認する。

- [ ] `SHA256SUMS.txt` とダウンロードした全 asset の SHA-256 が一致する
- [ ] ZIP を新しい directory へ展開、または installer で新規インストールできる
- [ ] 配布物の実体からアプリを起動できる
- [ ] folder 選択、Markdown 表示、Mermaid 表示が動作する
- [ ] `sample_docs/plantuml.md` で PlantUML と Mermaid が表示される
- [ ] `plantuml.jar` が想定 runtime directory に存在する
- [ ] version 表示または成果物メタデータが tag と一致する
- [ ] 未署名の場合、OS の警告と利用者向け案内が Release notes と一致する
- [ ] Windows installer の uninstall を確認する

署名済みとして配布する場合は、jar とライセンスファイルを含む最終構成を作った後に署名する。macOS の外部配布では署名と notarization、Windows では code signing を検討する。参考: [Tauri macOS code signing](https://v2.tauri.app/distribute/sign/macos/)、[Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/)

## 12. 公開と公開後確認

smoke test が完了したら Draft Release を Publish する。公開後も Release ページから各 asset を1回ダウンロードし、次を確認する。

- Release tag と source commit が正しい
- 全 asset が表示され、命名と説明が対応している
- SHA-256 が一致する
- Release notes の download 対象、必要環境、署名状況、既知制約が正しい

Release asset に誤りが見つかった場合は利用者へ影響を明記し、同じファイル名を黙って差し替えない。必要に応じて Release を Draft / pre-release 扱いへ戻すか、修正版 version を発行する。

## 13. GitHub Actions による将来自動化

現時点では Release workflow は未実装である。自動化する場合は次の構成を推奨する。

1. `v*` tag push で起動する
2. macOS / Windows job が同じ tag commit から build / test / publish する
3. OS別生成物を Actions artifact として一時保存する
4. release job が全生成物、ライセンス通知、checksum を集約する
5. `permissions: contents: write` を必要な job だけへ設定する
6. Draft Release を作成して asset を添付する
7. 人がダウンロード smoke test を行ってから公開する

Tauri 側の参考実装は [Tauri GitHub Actions guide](https://v2.tauri.app/distribute/pipelines/github/) を参照する。Avalonia と Tauri の両方を扱うため、Tauri の action だけで完結させず、最終 release job で全 asset を集約する。
