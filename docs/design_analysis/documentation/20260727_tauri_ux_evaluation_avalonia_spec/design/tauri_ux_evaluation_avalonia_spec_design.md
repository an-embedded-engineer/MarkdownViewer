# Tauri 先行 UX 評価と Avalonia 反映仕様化 文書更新設計

## 1. 背景と目的

Tauri 版では MenuBar / StatusBar、Recent Folders、Multi-tab、Viewer settings、trusted HTML、Explorer UX、responsive preview、image viewer、左右 2 pane Split View が先行実装され、各 workflow の自動検証・レビューと主要シナリオのユーザ確認が完了している。Split View には pane-local tab group、pane 間 tab 移動、上下 split の follow-up が残るが、single / 左右 2 pane の基盤は Avalonia 反映仕様を検討できる段階に達した。

本 topic の目的は次の 2 点である。

1. 既存の完了記録を根拠に、Tauri 先行 UX の採用仕様、未検証事項、Tauri 固有実装を区別し、Avalonia へ渡す共通仕様と stack 差分を確定する。
2. Tauri Split View follow-up と Avalonia 追随 todo を、同じ基盤を繰り返し変更しない実装単位へ整理・統合し、依存順序を更新する。

本 topic は docs-only であり、新しいアプリ動作確認やソース変更は行わない。「評価済み」は既存 workflow で確認された範囲だけを指し、未実施の platform / accessibility / security matrix を成功扱いしない。

## 2. 対象文書

### 2.1 更新対象

- `docs/todo/todo.md`
- `docs/todo/todo_archive_2026.md`
- `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`
- `docs/components/avalonia_viewer/README.md`
- `docs/components/avalonia_viewer/basic_design.md`
- `docs/components/avalonia_viewer/detail_design.md`
- `docs/components/avalonia_viewer/interface_spec.md`
- `docs/components/avalonia_viewer/issues.md`
- `docs/design_analysis/documentation/20260727_tauri_ux_evaluation_avalonia_spec/`
- `docs/history/README.md` と本 topic の history 文書

### 2.2 評価根拠として参照する文書

- Tauri component docs: `docs/components/tauri_viewer/`
- Tauri 先行案件の `change_report.md`、設計、ユーザ確認記録
- `docs/todo/todo_archive_2026.md`
- `TODO-2026-019`（Explorer UX）、`TODO-2026-021`（responsive preview）、`TODO-2026-022`（image viewer）の完了記録
- UI/UX 調査・WBS: `docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/` と `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/`
- 共通 architecture / rules / ADR index

### 2.3 非対象

- Tauri / Avalonia のソースコード、設定、スクリプト、fixture、runtime asset
- Avalonia 各 todo の詳細なクラス・API・XAML 設計
- 新規のアプリ起動、手動操作、platform matrix 実施
- 3 pane 以上、入れ子 split tree、編集、未保存状態、layout 永続化

## 3. 読者と利用場面

- Avalonia 反映 work item の設計者が、共通 UX と stack 固有判断を切り分ける時
- todo 担当者が、着手順序と統合済み項目を確認する時
- Tauri follow-up 担当者が、Avalonia baseline を不必要にブロックしない範囲を確認する時
- 最終比較時に、同じ利用者契約と異なる内部実装を区別する時

## 4. 評価方法と表現

### 4.1 根拠レベル

評価結果では各項目を次の 3 段階で記録する。

- `confirmed`: change report にユーザ確認または自動検証結果が明記されている。
- `specified`: 設計・恒久 docs とレビューでは確定しているが、個別の手動 PASS を推定できない。
- `follow-up`: platform 固有確認、追加 UX、または未実装機能として別 todo / issues で追跡する。

### 4.2 Avalonia 反映区分

- `common`: 利用者が観測する操作、状態遷移、security outcome、accessibility outcome。両 stack で一致させる。
- `adapted`: 同じ outcome を Avalonia の XAML / MVVM / NativeWebView / .NET service 境界で実現する。
- `tauri-only`: custom protocol、Tauri IPC / capability、React DOM ref などの内部方式。Avalonia へ移植しない。
- `deferred`: baseline の完了を待たせない拡張または platform matrix。

## 5. Tauri UX 評価の記載方針

評価文書は次を機能群ごとに表形式で整理する。

| 機能群 | 主な共通仕様 | 根拠の扱い | Avalonia 方針 |
| --- | --- | --- | --- |
| MenuBar / StatusBar | 操作領域と状態表示を分離し、active document / busy / error を現在対象に追随させる | TODO-003 の確認範囲を `confirmed` とする | Window 内 Menu と下部 status 領域を使う |
| Recent Folders | 成功した root を最大 10 件、重複昇格、削除、再起動復元 | TODO-004 を `confirmed` | typed user config service に保存する |
| Viewer settings | Theme、logical window size、PlantUML jar path を確認・保存し、Recent Folders と共存 | TODO-014 を `confirmed`、Windows atomic replace は `follow-up` | Recent Folders と同じ設定基盤へ統合する |
| Multi-tab | root 内 document を path 単位で再利用し、activate / close / Reload / link と async result を tab identity で守る | TODO-005 を `confirmed` | typed document tab model を ViewModel の正本にする |
| Split View baseline | single / 左右 2 pane、global document collection、pane-local selection / runtime、active pane routing | TODO-006 の主要操作を `confirmed`、詳細 keyboard / ARIA は `specified` | Tauri follow-up を待たず同 baseline を反映する |
| trusted HTML | root 内 UTF-8 `.html`、root 内 resource、外部 http(s) 委譲、host / navigation 制限 | macOS 主要シナリオを `confirmed`、他 platform を `follow-up` | NativeWebView の navigation / bridge 境界へ適応する |
| Explorer UX | resize、必要時の横 scroll、型別 icon |主要操作を `confirmed`、keyboard / ARIA の個別 PASS は推定しない | GridSplitter / TreeView で shell layout と同時反映する |
| Responsive preview | preview content box 追従と wide content の局所 overflow | TODO-021 の確認を `confirmed` | Avalonia の現状差分を各 work item 設計時に確認し、独立 todo は現時点で追加しない |
| Image viewer | Markdown image / Mermaid / PlantUML の overlay、zoom / pan / focus return | TODO-022 の確認を `confirmed` | Avalonia baseline へ自動追加せず、最終比較で採否判断する deferred 候補とする |

評価結果は「Tauri と同じ内部構造」を要求しない。たとえば Tauri custom protocol、sandboxed iframe、React `inert`、Rust atomic replace は根拠となる outcome を抽出し、Avalonia では利用可能な platform adapter と .NET service に置き換える。

## 6. todo 統合・分割方針

### 6.1 Tauri Split View follow-up

#### TODO-2026-023 と TODO-2026-024 を統合する

`pane-local tab ownership` だけを先に導入すると、利用者が pane 間で tab を再配置する操作を持たない中間状態が生じる。さらに open / close / fallback / focus / runtime identity は tab 移動と同じ typed transition を変更する。したがって TODO-2026-023 を「Tauri pane-local tab group / pane 間移動」として拡張し、TODO-2026-024 を統合済みとして archive する。

統合後も document data cache は共有し、pane-local ordered tab IDs / active tab / move transition を同じ workflow で設計・実装する。drag and drop、reorder、pin は非対象のままとし、明示的かつ keyboard 到達可能な移動操作までを扱う。

#### TODO-2026-025 は分離維持する

上下 split は ownership ではなく orientation、axis size policy、separator input / ARIA、狭高さ縮退の変更である。TODO-2026-023 の pane-local ownership を前提とするが、別 workflow のまま維持する。3 pane 以上や split tree は TODO-2026-025 へ混ぜず、必要になった時点で WBS 対象とする。

#### Avalonia baseline をブロックしない

TODO-2026-023 / 025 は Tauri の追加 UX であり、現在確認済みの global document collection + pane-local selection による左右 2 pane baseline の Avalonia 反映をブロックしない。実装完了後に両 stack へ採用するかは TODO-2026-012 の最終同期で再評価する。

### 6.2 Avalonia shell 領域を統合する

TODO-2026-008 に TODO-2026-020 を統合し、「Avalonia shell / Explorer UX foundation」とする。

理由:

- 両方が `MainWindow.axaml` の top / center / bottom grid と Explorer / Preview 境界を変更する。
- MenuBar / StatusBar 導入と同時に GridSplitter、Explorer scroll viewport、icon template を確定すれば、後続 TabStrip / Split View が依存する workspace 領域を一度で固定できる。
- status の active document 対応は後続 Multi-tab で拡張するが、shell の配置と単一 document 時の契約は先に完成できる。

TODO-2026-020 は統合済みとして archive し、Tauri Explorer UX 由来の完了条件と source reference を TODO-2026-008 へ移す。

### 6.3 Avalonia 設定基盤を統合する

TODO-2026-009 に TODO-2026-015 を統合し、「Avalonia app settings / Recent Folders」とする。

理由:

- Recent Folders、Theme、logical window size、PlantUML jar path は同じ user config JSON、schema migration、atomic save、startup load を共有する。
- 別 workflow にすると `IAppSettingsService` と Settings UI / Menu の配線を連続して変更し、lost update と migration の検証を重複させる。
- Tauri で採用済みの field-specific update outcome を、Avalonia では 1 つの typed settings snapshot / service として自然に実装できる。

TODO-2026-015 は統合済みとして archive し、設定 UI、保存、復元、Recent Folders 共存の完了条件を TODO-2026-009 へ移す。

### 6.4 trusted HTML を Multi-tab より先に置く

TODO-2026-018 は独立維持するが、TODO-2026-008 完了後かつ TODO-2026-010 より前に実施する。TODO-2026-010 は TODO-2026-018 に依存させる。

理由:

- Explorer node と open document を Markdown 専用から typed Markdown / HTML model へ一般化してから Multi-tab を構築すれば、tab model と async guard を二度作り直さずに済む。
- HTML security / WebView lifecycle は独立した高リスク境界であり、shell や settings と統合するには大きすぎる。
- TODO-2026-018 と TODO-2026-009 は TODO-2026-008 後に並行可能とする。

### 6.5 Multi-tab と Split View は分離維持する

TODO-2026-010 と TODO-2026-011 は統合しない。

- Multi-tab は typed collection、active tab、close / link / reload、document cache が中心である。
- Split View は複数 NativeWebView host、pane-local runtime、focus、separator、active pane routing が中心であり、platform resource / lifecycle の不確実性が高い。
- TODO-2026-010 完了時に single pane で document state を安定させ、TODO-2026-011 で current Tauri baseline を反映する方が検証失敗を局所化できる。

### 6.6 最終同期の依存

TODO-2026-012 は TODO-2026-011 完了後に実施する。統合後の依存は推移的に満たされるため、統合済み ID を dependency に残さない。Tauri TODO-2026-023 / 025 は baseline 完了条件へ含めず、完了していれば採否を、未完なら follow-up 状態を最終同期へ記録する。

### 6.7 更新後の直接依存

active todo と WBS は次の直接依存へ同期する。TODO-2026-009 と TODO-2026-018 は TODO-2026-008 後に並行でき、TODO-2026-010 は両方の完了を待つ。

| TODO | 直接依存 | 理由 |
| --- | --- | --- |
| TODO-2026-008 | TODO-2026-007 | 評価済み shell / Explorer 契約を受け取る |
| TODO-2026-009 | TODO-2026-008 | Menu / Settings の配置先と shell を前提にする |
| TODO-2026-018 | TODO-2026-008 | Explorer と preview host の基盤を前提にする |
| TODO-2026-010 | TODO-2026-009, TODO-2026-018 | app settings と typed Markdown / HTML document model の両方を tab state に取り込む |
| TODO-2026-011 | TODO-2026-010 | 安定した single-pane tab collection を pane-local selection / runtime へ拡張する |
| TODO-2026-012 | TODO-2026-011 | 推移的に全 Avalonia rollout を完了した後で最終同期する |

TODO-2026-015 / 020 / 024 は統合後の active dependency に残さない。

## 7. 更新後の推奨実行順序

1. TODO-2026-008 Avalonia shell / Explorer UX foundation
2. TODO-2026-009 Avalonia app settings / Recent Folders と TODO-2026-018 Avalonia trusted HTML（並行可能）
3. TODO-2026-010 Avalonia Multi-tab core
4. TODO-2026-011 Avalonia Split View baseline
5. TODO-2026-012 両実装 UI/UX docs 最終同期

Tauri follow-up は別系列とする。

1. TODO-2026-023 pane-local tab group / pane 間移動
2. TODO-2026-025 上下・左右 split orientation

TODO-2026-019 / 021 / 022 はすべて完了済みである。TODO-2026-019 は TODO-2026-020 統合判断の直接 source、TODO-2026-021 / 022 は評価範囲を補う source reference として TODO-2026-007 / WP-005 に記録する。後二者は当初の baseline gate ではなく、完了後に追加された評価資料であるため dependency には追加しない。

## 8. 恒久文書の更新方針

Avalonia component docs には未実装機能を現在仕様として混在させない。既存の実装記述は維持し、新しい「Tauri 評価済み Avalonia 反映仕様」節を設けて、planned / common / adapted / deferred を明示する。

- `README.md`: 反映 roadmap と参照先を短く追加する。
- `basic_design.md`: 共通 UX 原則、Avalonia 責務境界、導入順序を追加する。
- `detail_design.md`: planned state / service / NativeWebView 境界と、各 TODO が所有する範囲を追加する。
- `interface_spec.md`: 利用者向け target contract を追加し、未実装であることを明示する。
- `issues.md`: NativeWebView 複数 host、trusted HTML platform matrix、設定保存 platform 差分などをリスクとして追跡する。

Tauri component docs は現行実装と一致しており、評価結果は本 topic と Avalonia docs から参照する。Tauri の現行仕様を書き換える必要がある場合だけ局所更新する。

## 9. 削除・統合・移動・archive 判断

- TODO-2026-024: TODO-2026-023 へ統合し、archive に `Status: integrated` と統合理由を残す。
- TODO-2026-020: TODO-2026-008 へ統合し、archive に source Tauri TODO と移管した完了条件を残す。
- TODO-2026-015: TODO-2026-009 へ統合し、archive に設定 schema / UI / persistence が同じ基盤である理由を残す。
- 元 ID は再利用しない。既存設計・history からの参照を壊さないため archive entry を残す。
- TODO-2026-007: workflow 完了時に通常どおり done として archive する。

## 10. リンク・索引・重複・用語・履歴の確認観点

- `rg` で TODO-2026-024 / 020 / 015 の参照元を列挙し、統合先または archive への説明が必要か確認する。
- WBS の WP-006 / WP-007 を統合後の scope に更新し、旧 WP-009 までの ID は安易に採番し直さない。
- `depends_on` に archive 済み統合 IDを残さない。
- TODO-2026-007 / WP-005 から TODO-2026-019 / 021 / 022 の評価根拠を追跡できることを確認する。
- `Tauri先行 UX`、`common specification`、`stack adaptation`、`baseline` の用語を統一する。
- 現行実装と planned contract を同じ時制で書かない。
- docs-only のため `diff.zip` を作成しない。
- 採用済み横断判断は段階導入方針の具体化だが、現時点では本プロジェクト固有の rollout plan であり、新規 ADR は作成しない。最終同期で複数案件へ再利用される判断になった場合に再評価する。
- todo 再編と共通仕様化は将来の実装担当者へ影響するため history を追加する。

## 11. 文書検証

- `git diff --check`
- Markdown 内の相対 link target を抽出して存在確認する。
- `rg` による旧 todo dependency、重複 summary、統合済み ID の active entry 残存確認
- 変更ファイルが Markdown のみであることを `git diff --name-only` で確認する。

アプリ build / test / manual verification は実行しない。これは docs-only workflow であり、評価根拠は既存の完了記録に限定するためである。

## 12. 完了条件

- Tauri UX 評価に根拠レベルと Avalonia 反映区分が記載される。
- Avalonia の共通仕様、stack 差分、未検証事項が component docs から参照できる。
- TODO-2026-023 / 024、008 / 020、009 / 015 の統合判断が todo / archive / WBS で整合する。
- TODO-2026-018 → 010 → 011 の依存順と、Tauri follow-up が Avalonia baseline をブロックしない方針が明確になる。
- TODO / WBS の直接依存が 6.7 の表と一致し、TODO-2026-015 / 020 / 024 が active dependency に残らない。
- レビュー指摘が解消され、リンク・索引・重複・archive・history の整合確認が完了する。
- ソース変更と `diff.zip` が存在しない。
