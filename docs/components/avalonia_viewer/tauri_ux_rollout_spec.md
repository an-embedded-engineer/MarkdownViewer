# Tauri 先行 UX の Avalonia 反映仕様

## 位置づけ

この文書は、Tauri版で先行実装・評価したUXをAvalonia版へ反映する際の共通仕様、Avalonia固有の適応方針、未検証事項を定義する。現在のAvalonia実装を説明する文書ではなく、`TODO-2026-008`から`TODO-2026-012`で段階導入するtarget contractである。

評価の詳細経緯とtodo再編判断は[`TODO-2026-007`の設計分析](../../design_analysis/documentation/20260727_tauri_ux_evaluation_avalonia_spec/design/tauri_ux_evaluation_avalonia_spec_design.md)を参照する。

## 評価ラベル

- `confirmed`: Tauri先行workflowのchange reportにユーザ確認または自動検証結果がある。
- `specified`: Tauriの設計・恒久docs・レビューで確定しているが、個別の手動PASSを推定できない。
- `follow-up`: platform固有確認または追加UXとして別途追跡する。

Avaloniaへの反映区分は次のとおりとする。

- `common`: 利用者が観測する操作、状態遷移、security / accessibility outcomeを合わせる。
- `adapted`: 同じoutcomeをXAML、MVVM、NativeWebView、.NET Serviceの責務境界で実現する。
- `tauri-only`: React DOM、Rust command、Tauri IPC / capability / custom protocolの内部方式は移植しない。
- `deferred`: Avalonia baselineの完了条件へ含めない。

## UX評価結果

| 機能群 | 評価 | Tauriで確認・確定した内容 | Avalonia反映 |
| --- | --- | --- | --- |
| MenuBar / StatusBar | `confirmed` | 操作領域とroot / active document / loading / error表示を分離し、Reload等を現在対象へroutingする | `common`。Window内`Menu`と下部status領域へ`adapted`する |
| Recent Folders | 主要操作`confirmed`、境界仕様`specified` | entry追加・削除・再オープンは確認済み。最大10件、重複昇格、missing path error、再起動復元は設計・実装レビューで確定しているが個別PASSを推定しない | `common`。typed user config serviceへ`adapted`する |
| Viewer settings | `confirmed` | Theme、logical window size、canonical `plantuml.jar` pathを確認・保存し、Recent Foldersと共存する | `common`。TODO-2026-009でRecent Foldersと同時導入する |
| Viewer settings Windows保存 | `follow-up` | TauriのWindows atomic replace / Unicode / verbatim pathは未検証 | Tauri TODO-2026-016の課題であり、Avaloniaでは.NETのplatform適合手段を独立検証する |
| Multi-tab | `confirmed` | root内documentをpathで再利用し、activate / close / Reload / relative linkとasync resultをtab / revisionで守る | `common`。typed Markdown / HTML document modelをViewModelの正本とする |
| Split View baseline | 主要操作`confirmed`、詳細`specified` | single / 左右2pane、global document collection、pane-local selection / runtime、active pane routing、requested ratio、close / root fallback | `common`。TODO-2026-011で同じbaselineをNativeWebView host境界へ`adapted`する |
| pane-local tab group / pane間移動 | `follow-up` | TODO-2026-023へ統合して追跡 | Avalonia baselineをブロックしない。TODO-2026-012で採否を再評価する |
| 上下split | `follow-up` | TODO-2026-025で追跡 | Avalonia baselineをブロックしない。左右2paneの安定後に採否を再評価する |
| trusted HTML | macOS主要操作`confirmed`、他platform`follow-up` | root内UTF-8 `.html`、許可resource、user-clicked http(s)の外部委譲、root外 / unsafe scheme / host到達拒否 | `common` outcomeをNativeWebView navigation / bridge / platform adapterへ`adapted`する |
| Explorer UX | 主要操作`confirmed`、keyboard / ARIA詳細`specified` | resize、必要時だけの横scroll、directory / Markdown / HTML / image icon | `common`。GridSplitter、ScrollViewer、TreeView templateへ`adapted`する |
| Responsive preview | `confirmed` | Markdown bodyはpreview content boxに追従し、wide elementだけが局所overflowする | target contractとして維持する。現状差分は各Avalonia work item設計時に確認し、現時点で独立todoを増やさない |
| Image viewer | `confirmed` | Markdown image / Mermaid / PlantUMLをoverlay表示し、zoom / pan / focus returnを提供する | `deferred`。Avalonia baselineへ自動追加せず、TODO-2026-012で価値とNativeWebView制約を再評価する |

## 共通UX仕様

### ShellとExplorer

- 上からMenuBar、root / error等の補助領域、document workspace、StatusBarの責務を分ける。
- `Open Folder`、`Reload`、Theme、Settings、Split ViewはMenuBarから到達可能にする。
- StatusBarは操作buttonを持たず、root、active document、loading / rendering、errorの短い状態を表示する。
- Explorer / Preview境界はpointerとkeyboardで操作でき、focus indicator、accessible name、orientation、現在値を公開する。
- Explorerの要求幅とlayoutでclampされた実幅を区別し、狭幅後に再拡大した時は利用者の要求幅へ戻す。
- treeの横scrollはcontentがpane幅を超える時だけ表示し、node種別をiconだけでなく選択 / disabled / disclosure stateと併せて判別可能にする。

### SettingsとRecent Folders

- Recent Folders、Theme、logical window size、PlantUML jar pathは1つのtyped user settings schemaで管理する。
- root openが成功した時だけrecent entryを追加し、同じpathは重複させず先頭へ移動する。最大10件とする。
- field単位の更新で他fieldを失わず、保存失敗を成功扱いしない。
- Settings UIは現在値を表示し、Save / Cancel、jar pathの選択 / Clear、field別validation error、focus containmentを持つ。
- windowはlogical client sizeを保存し、minimized / maximized / fullscreenの一時sizeを通常sizeとして保存しない。

### Typed documentとMulti-tab

- TODO-2026-018でMarkdown / trusted HTMLを表すtyped document modelを先に確立する。
- tab collection、active tab、document data / revision / loading / errorを明示的な型で管理し、`CurrentPath`等の旧単一document正本を並存させない。
- Explorerまたはrelative linkで同じroot内pathを開く時、既存tabがあればactivateし、なければ追加する。
- close、root変更、Reload、Theme変更後も有効なtabまたはempty stateへ一貫して復旧する。
- async resultはtab ID、document revision、必要に応じてpane IDでguardし、stale resultを他documentへ適用しない。

### Split View baseline

- initial modeはsingle、splitは左右2paneとし、3pane以上、上下split、layout persistenceはbaseline対象外とする。
- document data collectionはglobal、表示選択とpreview runtimeはpane-localとする。同じdocumentを両paneへ選択してもdataを複製しない。
- split on時はprimaryを維持し、可能なら隣接する別tabをsecondaryへ選ぶ。候補がなければsecondaryの未選択を正当なstateとする。
- split off時は選択済みactive paneをprimaryへ引き継ぐ。active paneが未選択なら既存primaryを維持し、両pane未選択かつtabが残る時だけ先頭tabへfallbackする。
- 上記split on / off規則はTODO-2026-006のbaselineである。TauriではTODO-2026-023で両groupの所属・順序・選択を保持するpane-local tab group仕様へ置換済みであり、TODO-2026-011 / TODO-2026-012でAvaloniaへ採用するsemanticsを確定する。
- Explorer、Reload、relative link、StatusBar、ErrorBannerはactive paneを対象にし、HTML bridgeやimage viewer等の発生元がある操作はoriginating paneを保持する。
- separatorはpointer / keyboardで操作し、requested ratioとclamp後の実幅を分離する。狭い領域では両paneを等しく縮退させ、再拡大時にrequested ratioを復元する。
- pane間でMarkdown / HTML / Mermaid / PlantUMLのloading、error、ready、timeout、生成DOM ID、focusが混線しない。

### trusted HTML security outcome

- 選択root内のtrusted UTF-8 `.html`だけをdocumentとして扱う。`.htm`、非UTF-8、root外documentはbaseline対象外とする。
- root内の許可resourceだけを読み込み、path canonicalizationとsymlink境界を検証する。
- top-level navigation、popup、form / download、unsafe scheme、外部network、host bridgeの不要なsurfaceを拒否する。
- user gestureを伴う`http:` / `https:`だけをscheme検証後にOS標準browserへ渡す。
- Tauriのcustom protocol / sandbox / capability構成を複製せず、NativeWebViewで利用可能なnavigation interception、resource policy、platform adapterを組み合わせて同じoutcomeを目指す。
- macOS / Windows / LinuxのNativeWebView実装差を実機matrixで確認し、未確認platformを成功扱いしない。

## Avalonia責務境界

- View: Menu、GridSplitter、TabControl、pane host、focus / accessibility、StorageProviderを担当する。
- ViewModel: typed settings、global document collection、active pane、pane selection、loading / error、command routingの正本を持つ。
- Service: settings load / save、file tree、Markdown rendering、trusted HTML resource / navigation policy、PlantUML runtime解決を担当する。
- NativeWebView adapter: document navigate、message / navigation検証、pane / tab / revision identity、platform差分を閉じ込める。

React state、DOM ref、Rust command、Tauri capabilityをAvaloniaへ持ち込まない。Tauriのpure policyで確定した状態遷移は、C#のtyped model / serviceとして再表現する。

## 導入順序

| 順序 | TODO | 直接依存 | 目的 |
| --- | --- | --- | --- |
| 1 | TODO-2026-008 shell / Explorer | TODO-2026-007 | 後続workspaceのlayoutと入口を固定する |
| 2a | TODO-2026-009 settings / Recent Folders | TODO-2026-008 | user configを一度で導入する |
| 2b | TODO-2026-018 trusted HTML | TODO-2026-008 | typed Markdown / HTML documentとsecurity境界を先に作る |
| 3 | TODO-2026-010 Multi-tab | TODO-2026-009, TODO-2026-018 | settingsとtyped documentをtab stateへ統合する |
| 4 | TODO-2026-011 Split View | TODO-2026-010 | 安定したsingle-pane tabを2paneへ拡張する |
| 5 | TODO-2026-012 final sync | TODO-2026-011 | 実装差分とfollow-up採否を最終同期する |

TODO-2026-009とTODO-2026-018は並行可能である。Tauri TODO-2026-023 / 025はこの順序の依存に追加しない。

## 未解決・実装時確認

- 複数NativeWebView hostのmemory / lifecycle / focus / hidden pane描画コスト。
- NativeWebViewのplatform別navigation / subresource interceptionとhost bridge制限。
- trusted HTMLのmacOS / Windows / Linux security matrix。
- settings保存のplatform適合性、atomicity、破損JSON / partial field復旧。
- Explorer splitterとsplit separatorのkeyboard / screen reader結果。
- Tauri pane-local tab group / pane間移動、上下split、Avalonia image viewerの採否。

これらは該当core workflowで設計・検証し、未確認結果を推定で閉じない。
