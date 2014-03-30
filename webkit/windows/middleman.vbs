Set WshShell = CreateObject("WScript.Shell")
cmd = WshShell.RUN("webkit.bat", 0, True)
Set WshShell = Nothing
