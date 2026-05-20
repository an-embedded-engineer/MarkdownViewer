# Agent Sync Guide

## 概要

Agent 向けの instruction 生成物は手編集せず、`instructions/agent_common_master.md` を正として同期スクリプトで再生成する。

## 同期元

- 共通 instruction: `instructions/agent_common_master.md`

## 生成先

- Copilot
  - `.github/copilot-instructions.md`
- Claude
  - `CLAUDE.md`
- Codex
  - `AGENTS.md`

## 実行方法

macOS / Linux:

```bash
./scripts/sync_agent_instructions.sh
./scripts/sync_agent_instructions.sh --all
./scripts/sync_agent_instructions.sh --copilot
./scripts/sync_agent_instructions.sh --claude --codex
```

Windows PowerShell:

```powershell
.\scripts\sync_agent_instructions.ps1
.\scripts\sync_agent_instructions.ps1 -All
.\scripts\sync_agent_instructions.ps1 -Copilot
.\scripts\sync_agent_instructions.ps1 -Claude -Codex
```

Windows Command Prompt:

```bat
scripts\sync_agent_instructions.bat
scripts\sync_agent_instructions.bat --all
scripts\sync_agent_instructions.bat --copilot
scripts\sync_agent_instructions.bat --claude --codex
```

## オプション

- `--copilot`: `.github/copilot-instructions.md` を再生成する
- `--claude`: `CLAUDE.md` を再生成する
- `--codex`: `AGENTS.md` を再生成する
- `--all` / `-All`: 全ターゲットを再生成する
- オプション未指定時は全ターゲットを再生成する

## 運用ルール

- `AGENTS.md` / `CLAUDE.md` / `.github/copilot-instructions.md` は手編集せず、`instructions/agent_common_master.md` を更新して再同期する
- sync 実行時は生成物 3 種を上書きするため、手編集した差分は保持されない
- 同期スクリプトは project-level instruction 生成物 3 種だけを扱う
- user-level workflow skill の配布は別途 user-level install で行い、このスクリプトでは扱わない