title LocalPanelELP
color 0B

:: Verificar privilegios de administrador; si no los tiene, relanzar elevado
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [INFO] Se requieren permisos de administrador. Solicitando elevacion...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0' -Verb RunAs"
    exit /b
)

echo.
echo  ============================================
echo   LocalPanelELP - Panel de Gestion de Archivos
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
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Error al instalar dependencias.
        pause
        exit /b 1
    )
    echo.
)

if not exist "dist" (
    echo  [INFO] Construyendo interfaz...
    echo.
    call npm run build
    if %errorlevel% neq 0 (
        echo  [ERROR] Error al construir la interfaz.
        pause
        exit /b 1
    )
    echo.
)

echo  [INFO] Iniciando LocalPanelELP...
echo  [INFO] Abre tu navegador en: http://localhost:5173
echo  [INFO] Usuario: admin  |  Contrasena: admin
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.

node server/index.js

pause
