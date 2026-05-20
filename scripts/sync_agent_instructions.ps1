#!/usr/bin/env pwsh
# Agent 向け instruction 同期スクリプト
# instructions/ 配下の同期元を AGENTS.md / CLAUDE.md / .github/copilot-instructions.md へコピーする

param(
    [switch]$Copilot,
    [switch]$Claude,
    [switch]$Codex,
    [switch]$All,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Show-Usage {
    Write-Output "Usage:"
    Write-Output "  .\scripts\sync_agent_instructions.ps1 [-Copilot] [-Claude] [-Codex]"
    Write-Output "  .\scripts\sync_agent_instructions.ps1 -All"
    Write-Output ""
    Write-Output "Options:"
    Write-Output "  -Copilot  Sync .github/copilot-instructions.md"
    Write-Output "  -Claude   Sync CLAUDE.md"
    Write-Output "  -Codex    Sync AGENTS.md"
    Write-Output "  -All      Sync every supported target (default when no option is given)"
    Write-Output "  -Help     Show this help"
}

if ($Help) {
    Show-Usage
    exit 0
}

if ($All -or (-not $Copilot -and -not $Claude -and -not $Codex)) {
    $Copilot = $true
    $Claude = $true
    $Codex = $true
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$commonInstructions = Join-Path $projectRoot "instructions/agent_common_master.md"

function Copy-InstructionFile {
    param(
        [string]$TargetFile,
        [string]$Label
    )

    $targetDir = Split-Path -Parent $TargetFile
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    if (Test-Path -LiteralPath $TargetFile) {
        Remove-Item -LiteralPath $TargetFile -Force
    }

    Copy-Item -LiteralPath $commonInstructions -Destination $TargetFile -Force
    Write-Output "  ${Label}: instruction copied"
}

function Sync-Copilot {
    Write-Output "--- copilot ---"
    Copy-InstructionFile -TargetFile (Join-Path $projectRoot ".github/copilot-instructions.md") -Label ".github"
}

function Sync-Claude {
    Write-Output "--- claude ---"
    Copy-InstructionFile -TargetFile (Join-Path $projectRoot "CLAUDE.md") -Label "CLAUDE.md"
}

function Sync-Codex {
    Write-Output "--- codex ---"
    Copy-InstructionFile -TargetFile (Join-Path $projectRoot "AGENTS.md") -Label "AGENTS.md"
}

Write-Output "=== Agent Sync Start ==="
Write-Output "Project root: $projectRoot"
Write-Output "Instruction:   $commonInstructions"

if ($Copilot) {
    Sync-Copilot
}

if ($Claude) {
    Sync-Claude
}

if ($Codex) {
    Sync-Codex
}

Write-Output "=== Agent Sync Complete ==="