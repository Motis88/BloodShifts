# סקריפט PowerShell לעדכון כל הפקודות ב-tasks.json
# שנה את כל המופעים של 'cd c:\bloodshift-new;' ל-'cd c:\BloodShift;'

(Get-Content .vscode\tasks.json) -replace 'cd c:\\bloodshift-new;', 'cd c:\\BloodShift;' | Set-Content .vscode\tasks.json
Write-Host 'העדכון הושלם! כל הפקודות ירוצו כעת מהתיקיה הנכונה.' -ForegroundColor Green
