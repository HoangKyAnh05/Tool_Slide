@echo off
echo ===================================================
echo             CREATE DESKTOP SHORTCUT
echo ===================================================
echo.

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\VocabAI.lnk'); $Shortcut.TargetPath = 'd:\code_tino_19_4\Code_Tool_Python\Tool_Slide\node_modules\electron\dist\electron.exe'; $Shortcut.Arguments = '.'; $Shortcut.WorkingDirectory = 'd:\code_tino_19_4\Code_Tool_Python\Tool_Slide'; $Shortcut.Description = 'Launch VocabAI App'; $Shortcut.Save()"

echo.
echo Shortcut created on Desktop successfully with Electron Atom Icon!
echo Press any key to exit.
pause
