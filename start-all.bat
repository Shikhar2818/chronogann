@echo off
setlocal
cd /d "%~dp0"

title ChronoGann Launcher

echo ========================================
echo   ChronoGann - Starting All Services
echo ========================================
echo.

if not exist "backend\venv\Scripts\python.exe" (
    echo [ERROR] Backend venv not found.
    echo Run: cd backend ^&^& python -m venv venv ^&^& venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo [1/2] Starting backend API on http://localhost:8000 ...
start "ChronoGann Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Waiting for backend, then starting frontend...
timeout /t 4 /nobreak >nul

start "ChronoGann Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================
echo   ChronoGann is starting
echo ========================================
echo   API:      http://localhost:8000
echo   Docs:     http://localhost:8000/docs
echo   App:      http://localhost:3000
echo   Analyzer: http://localhost:3000/analyzer
echo ========================================
echo.
echo Two terminal windows were opened (Backend + Frontend).
echo Close those windows to stop the services.
echo.
pause
