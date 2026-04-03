@echo off
REM Always serves this repo folder (avoids 404 when the path is mistyped, e.g. AIGameTest vs AIGameTest1)
cd /d "%~dp0"
npx --yes serve . -l 3000
