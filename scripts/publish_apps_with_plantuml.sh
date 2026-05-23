#!/usr/bin/env bash

if [ -n "${ZSH_EVAL_CONTEXT:-}" ]; then
  case ":${ZSH_EVAL_CONTEXT}:" in
    *:file:*)
      echo "Do not source this script. Run it as a command instead:" >&2
      echo "  ./scripts/publish_apps_with_plantuml.sh [options]" >&2
      return 2 2>/dev/null || exit 2
      ;;
  esac
fi

if [ -n "${BASH_VERSION:-}" ] && [ "${BASH_SOURCE[0]}" != "$0" ]; then
  echo "Do not source this script. Run it as a command instead:" >&2
  echo "  ./scripts/publish_apps_with_plantuml.sh [options]" >&2
  return 2
fi

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/publish_apps_with_plantuml.sh [options]

Options:
  --plantuml-jar <path>   Path to plantuml.jar. Defaults to PLANTUML_JAR_PATH or ./plantuml.jar.
  --publish-root <path>   Output root. Defaults to ./publish.
  --configuration <name>  .NET configuration. Defaults to Release.
  --runtime <rid>         .NET runtime identifier. Defaults to osx-arm64.
  --tauri-bundles <list>  Tauri bundle list. Defaults to app. Use "app,dmg" to also build a dmg.
  --skip-avalonia         Skip Avalonia publish.
  --skip-tauri            Skip Tauri bundle build.
  -h, --help              Show this help.

Outputs:
  publish/avalonia/raw/plantuml.jar
  publish/avalonia/MarkdownViewer.Avalonia.app/Contents/MacOS/plantuml.jar
  publish/tauri/markdown-viewer-tauri.app/Contents/MacOS/plantuml.jar
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

resolve_path() {
  local path="$1"
  local dir
  local base
  dir="$(dirname "${path}")"
  base="$(basename "${path}")"

  if [[ -d "${dir}" ]]; then
    printf "%s/%s\n" "$(cd "${dir}" && pwd)" "${base}"
  else
    printf "%s\n" "${path}"
  fi
}

CONFIGURATION="${CONFIGURATION:-Release}"
RUNTIME="${RUNTIME:-osx-arm64}"
TAURI_BUNDLES="${TAURI_BUNDLES:-app}"
PUBLISH_ROOT="${PUBLISH_ROOT:-${REPO_ROOT}/publish}"
PLANTUML_JAR="${PLANTUML_JAR_PATH:-${REPO_ROOT}/plantuml.jar}"
SKIP_AVALONIA=false
SKIP_TAURI=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plantuml-jar)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --plantuml-jar" >&2
        exit 2
      fi
      PLANTUML_JAR="$2"
      shift 2
      ;;
    --publish-root)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --publish-root" >&2
        exit 2
      fi
      PUBLISH_ROOT="$2"
      shift 2
      ;;
    --configuration)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --configuration" >&2
        exit 2
      fi
      CONFIGURATION="$2"
      shift 2
      ;;
    --runtime)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --runtime" >&2
        exit 2
      fi
      RUNTIME="$2"
      shift 2
      ;;
    --tauri-bundles)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --tauri-bundles" >&2
        exit 2
      fi
      TAURI_BUNDLES="$2"
      shift 2
      ;;
    --skip-avalonia)
      SKIP_AVALONIA=true
      shift
      ;;
    --skip-tauri)
      SKIP_TAURI=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

PLANTUML_JAR="$(resolve_path "${PLANTUML_JAR}")"
PUBLISH_ROOT="$(mkdir -p "${PUBLISH_ROOT}" && cd "${PUBLISH_ROOT}" && pwd)"

if [[ ! -f "${PLANTUML_JAR}" ]]; then
  echo "plantuml.jar was not found: ${PLANTUML_JAR}" >&2
  echo "Pass --plantuml-jar <path> or set PLANTUML_JAR_PATH." >&2
  exit 1
fi

if [[ "${SKIP_AVALONIA}" == false ]]; then
  command -v dotnet >/dev/null || { echo "dotnet is required." >&2; exit 1; }
fi

if [[ "${SKIP_TAURI}" == false ]]; then
  command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }
fi

if [[ "${SKIP_AVALONIA}" == false || "${SKIP_TAURI}" == false ]]; then
  command -v ditto >/dev/null || { echo "ditto is required on macOS." >&2; exit 1; }
fi

AVALONIA_PROJECT="${REPO_ROOT}/Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj"
AVALONIA_PUBLISH_ROOT="${PUBLISH_ROOT}/avalonia"
AVALONIA_PUBLISH_DIR="${AVALONIA_PUBLISH_ROOT}/raw"
AVALONIA_APP_NAME="MarkdownViewer.Avalonia.app"
AVALONIA_APP_DIR="${AVALONIA_PUBLISH_ROOT}/${AVALONIA_APP_NAME}"
TAURI_DIR="${REPO_ROOT}/markdown-viewer-tauri"
TAURI_APP_NAME="markdown-viewer-tauri.app"
TAURI_BUNDLE_APP="${TAURI_DIR}/src-tauri/target/release/bundle/macos/${TAURI_APP_NAME}"
TAURI_PUBLISH_DIR="${PUBLISH_ROOT}/tauri"
TAURI_PUBLISH_APP="${TAURI_PUBLISH_DIR}/${TAURI_APP_NAME}"

if [[ "${SKIP_AVALONIA}" == false ]]; then
  echo "Publishing Avalonia (${CONFIGURATION}, ${RUNTIME})..."
  dotnet publish "${AVALONIA_PROJECT}" \
    -c "${CONFIGURATION}" \
    -r "${RUNTIME}" \
    --self-contained true \
    -o "${AVALONIA_PUBLISH_DIR}"

  cp "${PLANTUML_JAR}" "${AVALONIA_PUBLISH_DIR}/plantuml.jar"
  echo "Copied plantuml.jar to ${AVALONIA_PUBLISH_DIR}/plantuml.jar"

  rm -rf "${AVALONIA_APP_DIR}"
  mkdir -p "${AVALONIA_APP_DIR}/Contents/MacOS" "${AVALONIA_APP_DIR}/Contents/Resources"
  ditto "${AVALONIA_PUBLISH_DIR}" "${AVALONIA_APP_DIR}/Contents/MacOS"
  cat > "${AVALONIA_APP_DIR}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>MarkdownViewer.Avalonia</string>
  <key>CFBundleIdentifier</key>
  <string>com.shin.markdown-viewer.avalonia</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>MarkdownViewer.Avalonia</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST
  echo "Created ${AVALONIA_APP_NAME} at ${AVALONIA_APP_DIR}"
fi

if [[ "${SKIP_TAURI}" == false ]]; then
  echo "Building Tauri bundle(s): ${TAURI_BUNDLES}..."
  (cd "${TAURI_DIR}" && npm run tauri -- build --bundles "${TAURI_BUNDLES}" --ci)

  if [[ ! -d "${TAURI_BUNDLE_APP}" ]]; then
    echo "Tauri app bundle was not found: ${TAURI_BUNDLE_APP}" >&2
    exit 1
  fi

  mkdir -p "${TAURI_PUBLISH_DIR}"
  rm -rf "${TAURI_PUBLISH_APP}"
  ditto "${TAURI_BUNDLE_APP}" "${TAURI_PUBLISH_APP}"
  cp "${PLANTUML_JAR}" "${TAURI_PUBLISH_APP}/Contents/MacOS/plantuml.jar"
  echo "Copied ${TAURI_APP_NAME} to ${TAURI_PUBLISH_APP}"
  echo "Copied plantuml.jar to ${TAURI_PUBLISH_APP}/Contents/MacOS/plantuml.jar"
fi

echo "Publish completed: ${PUBLISH_ROOT}"
