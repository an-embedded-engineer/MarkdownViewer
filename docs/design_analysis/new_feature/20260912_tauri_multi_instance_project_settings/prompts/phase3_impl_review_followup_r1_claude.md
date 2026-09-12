初回実装レビュー8件の対応が完了しました。再委譲せず、あなた自身で対応差分を再確認してください。

対象commit: ff84654
前回review commit: dc34e0b
review文書: docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/review/tauri_multi_instance_project_settings_impl_review.md
impl記録: docs/design_analysis/new_feature/20260912_tauri_multi_instance_project_settings/impl/tauri_multi_instance_project_settings_impl.md

MI-IR-01: InstanceDirectory / InstanceProtocol / WindowListを非GUI境界に分離。runtime owner/mode/symlink、UUID/version/remaining_ms、stale cleanup、partial、Info/Activate、label/sort/check、launcher/argv、title、context、startup破損、readonly、初回create競合、Root alias・WebView再接続、queue失敗保持のtestsを追加。impl末尾に設計§11の自動/未確認matrixを追加。
MI-IR-02: startupがcanonicalRootPath/tree/contextを返しReactも復元。保存対象の不一致を解消。
MI-IR-03: gate内準備の採用理由を設計/detailへ記録（競合openの初期化直列化を優先、背景I/O、IPCはgate非依存）。
MI-IR-04: native menuをruntime準備前に設置、runtime異常時はunavailable項目、New Window/Refresh維持。
MI-IR-05: 一時的accept errorのbackoff retry、永久停止の明示案内とunavailable状態。
MI-IR-06〜08: 既存flag定数の再利用とcomment、誤説明/リンク、architectureの役割分担、Phase4 matrix追記。

検証: Rust46件、Vitest118件、cargo check、cargo fmt -- --check、Tauri release .app build成功。
Unix socket bindの4testsはsandboxではOperation not permittedだったため、同じcargo testをsandbox外で実行して46件の成功を確認。skipにはしていません。
GUI/Windows等の未確認事項はmatrixに記録し、spikeで製品経路の確認を代替していません。

まず8件への対応差分を確認し、追加調査は未解決点に限定してください。全IDの状態・未解決件数・承認可否をreview文書へまとめて1回の編集で反映し、review文書のみをコミットしてhashを報告してください。ソースや他docsは編集しないでください。
