@echo off
setlocal

:: Input and output folders
set "INPUT_DIR=%~dp0"
set "OUTPUT_DIR=%INPUT_DIR%compressed"

:: JPEG quality (2 = high quality, 31 = low quality)
set "QUALITY=5"

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

for %%F in ("%INPUT_DIR%*.jpg" "%INPUT_DIR%*.jpeg") do (
    if exist "%%~fF" (
        echo Compressing: %%~nxF

        ffmpeg -y -i "%%~fF" ^
            -q:v %QUALITY% ^
            -frames:v 1 ^
            "%OUTPUT_DIR%\%%~nF.jpg" ^
            -loglevel error
    )
)

echo.
echo Done! Compressed files saved to:
echo %OUTPUT_DIR%

pause