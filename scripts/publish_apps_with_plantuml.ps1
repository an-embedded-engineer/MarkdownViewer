#!/usr/bin/env pwsh

<#
.SYNOPSIS
Publishes the Avalonia and Tauri applications for Windows with plantuml.jar.

.DESCRIPTION
Creates a self-contained Avalonia publish and Tauri Windows bundles. The
PlantUML jar is copied next to each executable and embedded in Tauri installers.

.PARAMETER PlantUmlJar
Path to plantuml.jar. Defaults to PLANTUML_JAR_PATH or plantuml.jar in the
repository root.

.PARAMETER PublishRoot
Output root. Defaults to PUBLISH_ROOT or publish in the repository root.

.PARAMETER Configuration
.NET configuration. Defaults to CONFIGURATION or Release.

.PARAMETER Runtime
.NET runtime identifier. Defaults to RUNTIME or win-x64.

.PARAMETER TauriBundles
Comma-separated Tauri bundle list. Defaults to TAURI_BUNDLES or nsis.

.PARAMETER SkipAvalonia
Skips the Avalonia publish.

.PARAMETER SkipTauri
Skips the Tauri build and bundle creation.
#>

[CmdletBinding()]
param(
    [string]$PlantUmlJar,
    [string]$PublishRoot,
    [string]$Configuration,
    [string]$Runtime,
    [string]$TauriBundles,
    [switch]$SkipAvalonia,
    [switch]$SkipTauri
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-Setting {
    param(
        [AllowEmptyString()]
        [string]$ParameterValue,
        [string]$EnvironmentName,
        [string]$DefaultValue
    )

    if (-not [string]::IsNullOrWhiteSpace($ParameterValue)) {
        return $ParameterValue
    }

    $environmentValue = [Environment]::GetEnvironmentVariable($EnvironmentName)
    if (-not [string]::IsNullOrWhiteSpace($environmentValue)) {
        return $environmentValue
    }

    return $DefaultValue
}

function Invoke-NativeCommand {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
}

function Remove-PublishDirectory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    try {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    catch {
        throw "Could not replace publish directory: $Path. Close any application running from this directory and retry. $($_.Exception.Message)"
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

$PlantUmlJar = Get-Setting -ParameterValue $PlantUmlJar -EnvironmentName "PLANTUML_JAR_PATH" -DefaultValue (Join-Path $repoRoot "plantuml.jar")
$PublishRoot = Get-Setting -ParameterValue $PublishRoot -EnvironmentName "PUBLISH_ROOT" -DefaultValue (Join-Path $repoRoot "publish")
$Configuration = Get-Setting -ParameterValue $Configuration -EnvironmentName "CONFIGURATION" -DefaultValue "Release"
$Runtime = Get-Setting -ParameterValue $Runtime -EnvironmentName "RUNTIME" -DefaultValue "win-x64"
$TauriBundles = Get-Setting -ParameterValue $TauriBundles -EnvironmentName "TAURI_BUNDLES" -DefaultValue "nsis"
$tauriBundleNames = @($TauriBundles -split "[,\s]+" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

if ($tauriBundleNames.Count -eq 0) {
    throw "TauriBundles must contain at least one bundle name."
}

if (-not (Test-Path -LiteralPath $PlantUmlJar -PathType Leaf)) {
    throw "plantuml.jar was not found: $PlantUmlJar. Pass -PlantUmlJar <path> or set PLANTUML_JAR_PATH."
}

$PlantUmlJar = (Resolve-Path -LiteralPath $PlantUmlJar).Path
New-Item -ItemType Directory -Path $PublishRoot -Force | Out-Null
$PublishRoot = (Resolve-Path -LiteralPath $PublishRoot).Path

if (-not $SkipAvalonia -and -not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet is required."
}

if (-not $SkipTauri -and -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is required."
}

$avaloniaProject = Join-Path $repoRoot "Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj"
$avaloniaPublishDir = Join-Path $PublishRoot "avalonia/$Runtime"
$tauriDir = Join-Path $repoRoot "markdown-viewer-tauri"
$tauriSourceDir = Join-Path $tauriDir "src-tauri"
$tauriReleaseDir = Join-Path $tauriSourceDir "target/release"
$tauriExecutable = Join-Path $tauriReleaseDir "markdown-viewer-tauri.exe"
$tauriBundleSourceDir = Join-Path $tauriReleaseDir "bundle"
$tauriPublishDir = Join-Path $PublishRoot "tauri"
$tauriRawPublishDir = Join-Path $tauriPublishDir "raw"
$tauriBundlePublishDir = Join-Path $tauriPublishDir "bundle"
$tauriResourceStageDir = Join-Path $tauriSourceDir "target/publish-resources"
$tauriResourceStageJar = Join-Path $tauriResourceStageDir "plantuml.jar"

if (-not $SkipAvalonia) {
    Write-Output "Publishing Avalonia ($Configuration, $Runtime)..."
    Invoke-NativeCommand -Command "dotnet" -Arguments @(
        "publish",
        $avaloniaProject,
        "-c", $Configuration,
        "-r", $Runtime,
        "--self-contained", "true",
        "-o", $avaloniaPublishDir
    )

    Copy-Item -LiteralPath $PlantUmlJar -Destination (Join-Path $avaloniaPublishDir "plantuml.jar") -Force
    Write-Output "Copied plantuml.jar to $avaloniaPublishDir"
}

if (-not $SkipTauri) {
    New-Item -ItemType Directory -Path $tauriResourceStageDir -Force | Out-Null
    Copy-Item -LiteralPath $PlantUmlJar -Destination $tauriResourceStageJar -Force

    # Windows resources are installed next to the Tauri executable.
    $resourceMap = @{}
    $resourceMap["target/publish-resources/plantuml.jar"] = "plantuml.jar"
    $tauriConfig = @{
        bundle = @{
            resources = $resourceMap
        }
    } | ConvertTo-Json -Depth 4 -Compress

    try {
        Write-Output "Building Tauri bundle(s): $TauriBundles..."
        Push-Location $tauriDir
        try {
            Invoke-NativeCommand -Command "npm" -Arguments @(
                "run", "tauri", "--",
                "build",
                "--bundles", $TauriBundles,
                "--config", $tauriConfig,
                "--ci"
            )
        }
        finally {
            Pop-Location
        }

        if (-not (Test-Path -LiteralPath $tauriExecutable -PathType Leaf)) {
            throw "Tauri executable was not found: $tauriExecutable"
        }
        foreach ($bundleName in $tauriBundleNames) {
            $bundleSource = Join-Path $tauriBundleSourceDir $bundleName
            if (-not (Test-Path -LiteralPath $bundleSource -PathType Container)) {
                throw "Tauri $bundleName bundle output was not found: $bundleSource"
            }
        }

        Remove-PublishDirectory -Path $tauriRawPublishDir
        Remove-PublishDirectory -Path $tauriBundlePublishDir

        New-Item -ItemType Directory -Path $tauriRawPublishDir -Force | Out-Null
        New-Item -ItemType Directory -Path $tauriBundlePublishDir -Force | Out-Null
        Copy-Item -LiteralPath $tauriExecutable -Destination $tauriRawPublishDir -Force
        Copy-Item -LiteralPath $PlantUmlJar -Destination (Join-Path $tauriRawPublishDir "plantuml.jar") -Force
        foreach ($bundleName in $tauriBundleNames) {
            $bundleSource = Join-Path $tauriBundleSourceDir $bundleName
            $bundleDestination = Join-Path $tauriBundlePublishDir $bundleName
            Copy-Item -LiteralPath $bundleSource -Destination $bundleDestination -Recurse -Force
        }

        Write-Output "Copied Tauri executable and plantuml.jar to $tauriRawPublishDir"
        Write-Output "Copied Tauri bundle(s) to $tauriBundlePublishDir"
    }
    finally {
        if (Test-Path -LiteralPath $tauriResourceStageJar) {
            Remove-Item -LiteralPath $tauriResourceStageJar -Force
        }
    }
}

Write-Output "Publish completed: $PublishRoot"
