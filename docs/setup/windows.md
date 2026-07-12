# Windows 環境構築

PowerShell を使用し、コマンドは明記がない限りリポジトリルートで実行します。

## 1. 前提ツール

1. Git をインストールする。
2. [.NET SDK](https://dotnet.microsoft.com/download) 10.0 以上をインストールする。
3. [Node.js](https://nodejs.org/) の LTS 版をインストールする。
4. Tauri 用に Visual Studio 2022 Build Tools をインストールし、ワークロード `Desktop development with C++` を選択する。
5. [Rustup](https://www.rust-lang.org/tools/install) を MSVC toolchain でインストールする。
6. Microsoft Edge WebView2 Runtime がない場合は [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) をインストールする。

Tauri の Windows 前提条件は [公式 prerequisites](https://v2.tauri.app/start/prerequisites/#windows) を正とします。WebView2 は Avalonia 版と Tauri 版の両方で使用します。

新しい PowerShell を開き、確認します。

```powershell
git --version
dotnet --version
node --version
npm --version
rustc --version
cargo --version
rustup default stable-msvc
```

## 2. clone と依存復元

```powershell
git clone https://github.com/an-embedded-engineer/MarkdownViewer.git
Set-Location MarkdownViewer

dotnet restore Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
Set-Location markdown-viewer-tauri
npm ci
Set-Location ..
```

## 3. build

```powershell
dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj

Set-Location markdown-viewer-tauri
npm run build
Set-Location src-tauri
cargo check
Set-Location ../..
```

## 4. 実行

Avalonia 版:

```powershell
dotnet run --project Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj
```

Tauri 版:

```powershell
Set-Location markdown-viewer-tauri
npm run tauri dev
```

## PlantUML（任意）

`java -version` で Java を確認し、開発時はリポジトリルートまたは各実装の runtime directory に `plantuml.jar` を配置します。jar はコミットしません。設定ファイルを使う場合を含む詳細は [共通 PlantUML 手順](README.md#plantuml任意)を参照してください。

## 5. publish / bundle

Avalonia x64 self-contained publish:

```powershell
dotnet publish Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -o publish/avalonia/win-x64
```

ARM64 では RID を `win-arm64` に変更します。PlantUML を含める場合は、出力 directory に `plantuml.jar` を手動でコピーしてください。

Tauri bundle:

```powershell
Set-Location markdown-viewer-tauri
npm run tauri build
```

成果物は `markdown-viewer-tauri/src-tauri/target/release/bundle/` 以下に生成されます。MSI 作成時に `VBSCRIPT` 関連のエラーが出る場合は、Windows の optional feature を確認してください。

## 6. トラブルシューティング

- WebView が初期化できない: WebView2 Runtime をインストールまたは更新する。
- `link.exe` や Windows SDK が見つからない: Build Tools の `Desktop development with C++` と Windows SDK を確認する。
- Rust が GNU toolchain を使う: `rustup default stable-msvc` を実行し、PowerShell を開き直す。
- PlantUML が表示されない: `java -version` と [共通 PlantUML 手順](README.md#plantuml任意)を確認する。
