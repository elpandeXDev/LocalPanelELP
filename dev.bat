@echo off
title LocalPanelELP - Modo Desarrollo
color 0B

echo.
echo  ============================================
echo   LocalPanelELP - Modo Desarrollo
echo  ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo  [INFO] Instalando dependencias...
    call npm install
)

echo.
echo  [INFO] Iniciando en modo desarrollo...
echo  [INFO] Frontend: http://localhost:5174
echo  [INFO] Backend:  http://localhost:5173
echo.

npm run dev

pause
