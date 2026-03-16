@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ============================================
echo [GitHub Push: 소스 올리기]
echo ============================================
echo.

set /p choice="변경 사항을 GitHub에 업로드하시겠습니까? (y/n): "
if /i "%choice%" neq "y" (
    echo [중단] 작업을 취소했습니다.
    pause
    exit /b
)

echo.
echo [1/3] 변경된 파일 추가 (git add)
git add .

echo.
echo [2/3] 커밋 메시지 작성 (git commit)
set /p commit_msg="커밋 메시지를 입력하세요 (기본: Auto Update): "
if "!commit_msg!"=="" set commit_msg=Auto Update: %date% %time%

git commit -m "!commit_msg!"

if %errorlevel% neq 0 (
    echo.
    echo [알림] 커밋할 변경 사항이 없거나 커밋에 실패했습니다.
    pause
    exit /b
)

echo.
echo [3/3] GitHub에 업로드 (git push)
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [오류] GitHub 업로드에 실패했습니다. (네트워크 혹은 권한 문제)
    pause
    exit /b
)

echo.
echo [완료] GitHub에 성공적으로 업로드되었습니다!
pause
