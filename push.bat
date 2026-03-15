@echo off
echo Pulling latest changes from remote...
git pull origin main

echo.
echo Pushing changes to remote...
git push origin main

echo.
echo Done!
pause
