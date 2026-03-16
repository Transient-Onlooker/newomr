@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ============================================
echo [GitHub Pull: 최신 소스 가져오기]
echo ============================================
echo.

set /p choice="원격 저장소의 최신 소스를 가져오시겠습니까? (y/n): "
if /i "%choice%" neq "y" (
    echo [중단] 작업을 취소했습니다.
    pause
    exit /b
)

echo.
echo [1/1] git pull 실행 중...
git pull origin main

if %errorlevel% neq 0 (
    echo.
    echo [오류] 소스를 가져오는 중 문제가 발생했습니다.
    echo 로컬 변경 사항이 있어 충돌이 났을 수 있습니다.
    pause
    exit /b
)

echo.
echo [완료] 최신 소스 업데이트 완료!
pause
