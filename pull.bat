@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo [Pull] GitHub에서 최신 코드를 가져옵니다...
echo.

:: 1. 작업 중인 내용이 있는지 확인
git status --porcelain | findstr /v "^$" > nul
if %errorlevel% equ 0 (
    echo [정보] 수정 중인 파일이 발견되었습니다. 안전하게 임시 보관(stash)합니다.
    git stash
    set "STASHED=true"
)

:: 2. Pull 실행
echo [진행] git pull origin main...
git pull origin main

:: 3. 임시 보관했던 내용 복구
if "!STASHED!"=="true" (
    echo.
    echo [정보] 임시 보관했던 내 작업 내용을 다시 적용합니다.
    git stash pop
)

echo.
echo [완료] 작업이 끝났습니다.
pause
