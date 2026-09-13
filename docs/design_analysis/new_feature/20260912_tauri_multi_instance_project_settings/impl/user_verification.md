# Phase 4-a ユーザー動作確認

Phase 4進行承認を受領。実装レビューは全9件解決済み。ユーザー動作確認を継続中で、4-b完了処理・mergeは未実施。

## macOS 確認済み（ユーザー報告）

- ウィンドウタイトルにプロジェクト名・親ディレクトリ名が表示される。
- ウィンドウ内File / macOSメニューバーのFile > New Windowから別プロセスが開く。
- 各ウィンドウで異なるディレクトリを開ける。
- 各ウィンドウのテーマ・サイズを変更し、閉じた後に同じディレクトリを開くと復元される。

確認に使用したOS version / build hashは未採取。上記以外を確認済みとは扱わない。

## macOS 追加確認

| ID | 操作 | 期待結果 | 結果 |
| --- | --- | --- | --- |
| M1 | Windowメニューから別Rootのwindowを選択。対象を最小化・非表示・別Spaceのfullscreenにして再試行 | ディレクトリ名で識別でき、選択先が復帰・前面化する | 未確認 |
| M2 | 同名の別directory、同じRoot、未選択windowを複数開く | 親path / instance IDで一覧を区別できる。現在windowにチェック。終了したwindowはfocus / Refresh後に消える | 未確認 |
| M3 | Cmd+Shift+Nで起動し、起動元をCmd+Qで終了 | 別processのwindowは操作できる。Cmd+W / Cmd+M / Full Screenも機能し、全終了後はDock / Finderから再起動できる | 未確認 |
| M4 | 起動直後のsizeとRootを開いた後のsizeを見る | defaults→project設定が適用され、表示の跳ねが目立たない | 未確認 |
| M5 | WebViewを再読込できる開発環境で再読込（アプリの文書Reloadとは別） | Root・title・Settings対象・tree・保存先が一致する | 未確認（操作可能な環境が必要） |

## 両OS共通の追加確認（Windowsでは全項目）

| ID | 操作 | 期待結果 | 結果 |
| --- | --- | --- | --- |
| C1 | A/Bを別windowで開き、一方でRoot変更・文書Reload・close | 他方のtree / tabs / previewは変化しない | 未確認 |
| C2 | A→B→Aと同windowで移動。folder dialogもcancelする | 設定が各Rootに追従し、cancel時はRoot / title / 設定を保持 | 未確認 |
| C3 | AでPlantUML jar明示指定、Bで別設定またはClear。閉じて再open | 各設定が復元され図が描画される。Clearはruntime探索へ戻る。invalid pathは明示error | 未確認 |
| C4 | 同じRootを2processで開き、一方でtheme、他方でsizeを変更し再open | 変更した別fieldが両方残る。別Rootの設定も保持する（他windowへの即時同期は要求しない） | 未確認 |
| C5 | 通常sizeを設定→最大化 / fullscreen→通常表示→再起動・同Root open | 通常sizeが復元し、特殊状態のsizeで上書きしない | 未確認 |
| C6 | Root切替とresizeを続けて行い、A/Bを再open | 旧Rootのsizeや非同期previewが新Rootへ混線しない | 未確認 |
| C7 | sample_docsのMarkdown / HTML / 相対画像 / Mermaid / PlantUMLを表示、Reload・splitを操作 | 既存previewが動作し、Root切替後も前RootのHTML resourceを使わない | 未確認 |
| C8 | 両processで別folderを開き、Fileメニューを開き直す | Recent Foldersに両方残る | 未確認 |
| C9 | 旧版を全終了して新版を起動 | 旧theme / size / jar設定をdefaultsへ移行し、Recentを保持。新Rootを開くと初回設定生成 | 未確認（旧設定がある環境で実施） |

C9は旧設定がある場合、設定directoryを先にコピーして証跡を残す。既に移行済みなら未実施と報告し、旧schemaへ手編集して戻す必要はない。破損・lock timeout等はPhase3自動test済み。普段の設定を壊す操作は手動確認の必須項目にしない。

## Windows固有

| ID | 操作 | 期待結果 | 結果 |
| --- | --- | --- | --- |
| W1 | 下記build / testとrelease publish | Windows cfgを含めすべて成功 | 未確認 |
| W2 | release exe / shortcutを2回起動し、File > New Windowも利用 | 別PIDで起動し、不要なconsoleが出ない。親を終了しても子は操作できる | 未確認 |
| W3 | 異なるRootを開き、タイトルバー・タスクバーthumbnail・Alt+Tabを見る | 各titleにdirectory名が反映され、対象を選択できる（OSによる省略は可） | 未確認 |
| W4 | 日本語・空白・同名別pathのfolderを開く | title / preview / 設定の再open復元が正しい | 未確認 |
| W5 | 同じ実在folderをdrive letterやpathの大文字小文字違いで指定 | 同じproject設定を利用する | 未確認 |
| W6 | UNC / network folderを利用する場合に開く | 読込・title・設定復元が機能する | 未確認（環境がなければ対象外として報告） |

macOS固有のWindow一覧はWindowsには追加しない。WindowsはOSのタスクバー等で切り替える。

## Windows取得・検証手順

既存cloneのrepository rootでPowerShellから実行する。各コマンドが成功したことを確認して次へ進む。

```powershell
git fetch origin
git switch --track origin/new-feature/tauri-multi-instance-project-settings
# ローカルbranchが既にある場合はgit switchで切替後、git pull --ff-only
git rev-parse --short HEAD
cd markdown-viewer-tauri
npm ci
npm run build
npm test -- --run
cd src-tauri
cargo check
cargo test
cd ../..
# Javaとjarを用意し、既存publish scriptでTauriのみ生成する
.\scripts\publish_apps_with_plantuml.ps1 -SkipAvalonia -PlantUmlJar C:/path/to/plantuml.jar
```

GUI確認は開発serverではなく、生成した `publish/tauri/raw/` のrelease exe、または `publish/tauri/bundle/` のinstallerから行う。必要なNode / Rust / Windows build環境はproject setup docsを参照。RustはCargo.tomlの最低version 1.89以上。

報告形式: OS / commit hash、確認したIDとOK・NG・対象外、NGの操作手順とerror。全項目を一度に報告する必要はない。

## 条件付き未確認事項

macOS 14未満、App Translocation、NFC/NFD、Linux UIは該当環境がなければ未確認として維持する。Phase3のactivation spikeは製品GUIのM1確認を代替しない。今回の追加動作確認結果を受けてPhase4-aの完了可否を判断する。
