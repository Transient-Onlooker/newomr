@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo [Push] 내 코드를 GitHub에 올립니다...
echo.

:: 1. 변경 사항이 있는지 확인
git status --porcelain | findstr /v "^$" > nul
if %errorlevel% neq 0 (
    echo [알림] 새로 추가하거나 수정된 파일이 없습니다.
    echo 이미 커밋을 완료했다면 push만 진행합니다.
    goto push_stage
)

:: 2. Add 및 Commit
echo [1/2] 변경 사항 추가 및 커밋 중...
git add .
set /p msg="커밋 메시지 (입력 안 하면 'Auto Update'): "
if "!msg!"=="" set "msg=Auto Update %date% %time%"
git commit -m "!msg!"

:push_stage
:: 3. Push 실행
echo.
echo [2/2] GitHub에 업로드 중 (push)...
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [오류] 업로드에 실패했습니다! 
    echo 이유: 인터넷 연결 문제거나, GitHub에 새로운 커밋이 있어 pull이 먼저 필요할 수 있습니다.
) else (
    echo.
    echo [완료] GitHub에 성공적으로 올라갔습니다.
)

pause
