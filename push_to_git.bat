@echo off
echo ===================================================
echo             PUSH TO GITHUB SYSTEM
echo ===================================================
echo.

if not exist .git (
    echo [1/4] Initializing Git Repository...
    git init
) else (
    echo [1/4] Git already initialized.
)

echo [2/4] Setting remote origin...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/HoangKyAnh05/Tool_Slide.git

echo [3/4] Adding files...
git add .

echo [4/4] Creating commit...
git commit -m "feat: native google doc sync and background progress"
git branch -M main

echo.
echo ===================================================
echo             PUSHING TO GITHUB...
echo ===================================================
echo.
git push -u origin main --force

echo.
echo All done! Press any key to exit.
pause
