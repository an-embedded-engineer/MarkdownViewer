@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
set "COMMON_INSTRUCTIONS=%PROJECT_ROOT%\instructions\agent_common_master.md"
set "SYNC_COPILOT=0"
set "SYNC_CLAUDE=0"
set "SYNC_CODEX=0"

if "%~1"=="" goto no_args
:parse_args
if "%~1"=="" goto after_parse
if /I "%~1"=="--copilot" (
    set "SYNC_COPILOT=1"
    shift
    goto parse_args
)
if /I "%~1"=="--claude" (
    set "SYNC_CLAUDE=1"
    shift
    goto parse_args
)
if /I "%~1"=="--codex" (
    set "SYNC_CODEX=1"
    shift
    goto parse_args
)
if /I "%~1"=="--all" (
    set "SYNC_COPILOT=1"
    set "SYNC_CLAUDE=1"
    set "SYNC_CODEX=1"
    shift
    goto parse_args
)
if /I "%~1"=="-h" goto usage
if /I "%~1"=="--help" goto usage
echo [ERROR] Unknown option: %~1>&2
goto usage_error

:no_args
set "SYNC_COPILOT=1"
set "SYNC_CLAUDE=1"
set "SYNC_CODEX=1"

:after_parse
echo === Agent Sync Start ===
echo Project root: %PROJECT_ROOT%
echo Instruction:   %COMMON_INSTRUCTIONS%

if "%SYNC_COPILOT%"=="1" call :sync_copilot
if errorlevel 1 exit /b 1
if "%SYNC_CLAUDE%"=="1" call :sync_claude
if errorlevel 1 exit /b 1
if "%SYNC_CODEX%"=="1" call :sync_codex
if errorlevel 1 exit /b 1

echo === Agent Sync Complete ===
exit /b 0

:usage
echo Usage:
echo   scripts\sync_agent_instructions.bat [--copilot] [--claude] [--codex]
echo   scripts\sync_agent_instructions.bat --all
echo.
echo Options:
echo   --copilot  Sync .github\copilot-instructions.md
echo   --claude   Sync CLAUDE.md
echo   --codex    Sync AGENTS.md
echo   --all      Sync every supported target ^(default when no option is given^)
echo   -h, --help Show this help
exit /b 0

:usage_error
echo Usage:
echo   scripts\sync_agent_instructions.bat [--copilot] [--claude] [--codex]
echo   scripts\sync_agent_instructions.bat --all
exit /b 1

:sync_copilot
echo --- copilot ---
call :copy_instruction "%PROJECT_ROOT%\.github\copilot-instructions.md" ".github"
exit /b %errorlevel%

:sync_claude
echo --- claude ---
call :copy_instruction "%PROJECT_ROOT%\CLAUDE.md" "CLAUDE.md"
exit /b %errorlevel%

:sync_codex
echo --- codex ---
call :copy_instruction "%PROJECT_ROOT%\AGENTS.md" "AGENTS.md"
exit /b %errorlevel%

:copy_instruction
set "TARGET_FILE=%~1"
set "LABEL=%~2"
for %%I in ("%TARGET_FILE%") do set "TARGET_DIR=%%~dpI"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if exist "%TARGET_FILE%" del /f /q "%TARGET_FILE%"
copy /y "%COMMON_INSTRUCTIONS%" "%TARGET_FILE%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy instruction: %TARGET_FILE%
    exit /b 1
)
echo   %LABEL%: instruction copied
exit /b 0