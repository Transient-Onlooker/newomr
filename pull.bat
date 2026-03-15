@echo off
echo Pulling from GitHub (discarding local changes)...
cd /d "%~dp0"

echo Fetching latest changes...
git fetch origin main

echo Resetting local changes to match GitHub...
git reset --hard origin/main

echo Pull complete!
pause
