@echo off
setlocal EnableDelayedExpansion
title LocalPanelELP
color 0B

:: Verificar privilegios de administrador (fsutil requiere admin, no depende
:: del servicio "Server" como net session, que puede fallar en algunos sistemas)
if "%~1"=="ELEVATED" goto :afterElevation

fsutil dirty query %systemdrive% >nul 2>&1
if %errorLevel% equ 0 goto :afterElevation

cls
echo.
echo   [!] Se requieren permisos de administrador.
echo       Solicitando elevacion de Windows (UAC)...
echo.
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList 'ELEVATED' -WorkingDirectory '%~dp0' -Verb RunAs"
if %errorLevel% neq 0 (
    echo.
    echo   [X] No se pudo obtener permisos de administrador.
    echo       Ejecuta start.bat manualmente con clic derecho
    echo       -^> "Ejecutar como administrador".
    echo.
    pause
)
exit /b

:afterElevation
cls
echo.
echo   ==================================================================
echo.
echo                        L O C A L P A N E L E L P
echo.
echo             Panel de Gestion de Servidores y Bots de Discord
echo.
echo   ==================================================================
echo.
echo    [OK] Ejecutandose con privilegios de Administrador
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [X] Node.js no esta instalado en este sistema.
    echo       Descargalo desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo    [*] Instalando dependencias del proyecto...
    echo    ------------------------------------------------------------------
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo    [X] Error al instalar dependencias.
        pause
        exit /b 1
    )
    echo    ------------------------------------------------------------------
    echo    [OK] Dependencias instaladas correctamente.
    echo.
)

if not exist "dist" (
    echo    [*] Construyendo interfaz web...
    echo    ------------------------------------------------------------------
    call npm run build
    if %errorlevel% neq 0 (
        echo.
        echo    [X] Error al construir la interfaz.
        pause
        exit /b 1
    )
    echo    ------------------------------------------------------------------
    echo    [OK] Interfaz construida correctamente.
    echo.
)

echo   ==================================================================
echo.
echo    [-^>] Iniciando LocalPanelELP...
echo.
echo         URL del panel  :  http://localhost:5173
echo         Usuario        :  admin
echo         Contrasena     :  admin
echo.
echo   ==================================================================
echo.
echo    Presiona Ctrl+C para detener el servidor.
echo.

node server/index.js

echo.
pause
