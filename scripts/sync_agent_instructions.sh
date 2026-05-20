#!/usr/bin/env bash
# Agent 向け instruction 同期スクリプト
# instructions/ 配下の同期元を AGENTS.md / CLAUDE.md / .github/copilot-instructions.md へコピーする
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMMON_INSTRUCTIONS="${PROJECT_ROOT}/instructions/agent_common_master.md"

SYNC_COPILOT=0
SYNC_CLAUDE=0
SYNC_CODEX=0

usage() {
    cat <<'EOF'
Usage:
  ./scripts/sync_agent_instructions.sh [--copilot] [--claude] [--codex]
  ./scripts/sync_agent_instructions.sh --all

Options:
  --copilot  Sync .github/copilot-instructions.md
  --claude   Sync CLAUDE.md
  --codex    Sync AGENTS.md
  --all      Sync every supported target (default when no option is given)
  -h, --help Show this help
EOF
}

parse_args() {
    if [ "$#" -eq 0 ]; then
        SYNC_COPILOT=1
        SYNC_CLAUDE=1
        SYNC_CODEX=1
        return
    fi

    for arg in "$@"; do
        case "${arg}" in
            --copilot)
                SYNC_COPILOT=1
                ;;
            --claude)
                SYNC_CLAUDE=1
                ;;
            --codex)
                SYNC_CODEX=1
                ;;
            --all)
                SYNC_COPILOT=1
                SYNC_CLAUDE=1
                SYNC_CODEX=1
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo "[ERROR] Unknown option: ${arg}" >&2
                usage >&2
                exit 1
                ;;
        esac
    done
}

copy_instruction_file() {
    local target_file="$1"
    local label="$2"

    mkdir -p "$(dirname "${target_file}")"
    rm -f "${target_file}"
    cp "${COMMON_INSTRUCTIONS}" "${target_file}"
    echo "  ${label}: instruction copied"
}

sync_copilot() {
    echo "--- copilot ---"
    copy_instruction_file "${PROJECT_ROOT}/.github/copilot-instructions.md" ".github"
}

sync_claude() {
    echo "--- claude ---"
    copy_instruction_file "${PROJECT_ROOT}/CLAUDE.md" "CLAUDE.md"
}

sync_codex() {
    echo "--- codex ---"
    copy_instruction_file "${PROJECT_ROOT}/AGENTS.md" "AGENTS.md"
}

parse_args "$@"

echo "=== Agent Sync Start ==="
echo "Project root: ${PROJECT_ROOT}"
echo "Instruction:   ${COMMON_INSTRUCTIONS}"

if [ "${SYNC_COPILOT}" -eq 1 ]; then
    sync_copilot
fi

if [ "${SYNC_CLAUDE}" -eq 1 ]; then
    sync_claude
fi

if [ "${SYNC_CODEX}" -eq 1 ]; then
    sync_codex
fi

echo "=== Agent Sync Complete ==="