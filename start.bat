@echo off
cd /d "%~dp0"

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)

if not defined PY (
  echo Python 3 was not found.
  echo Please install Python 3 and try again.
  pause
  exit /b 1
)

%PY% tools\import_notes.py
if errorlevel 1 (
  echo Import failed.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:8765"
%PY% -m http.server 8765 --bind 127.0.0.1
