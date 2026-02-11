@echo off
setlocal enabledelayedexpansion

REM ============================================================================
REM Employee Performance Tracker - Backend Setup & Run Script (Windows)
REM 
REM This script handles:
REM - Python environment setup (venv)
REM - Dependency installation
REM - Docker containers (PostgreSQL + Redis)
REM - Database initialization
REM - Auto-start backend server
REM
REM Usage: setup_and_run.bat
REM ============================================================================

REM Colors (simulated with echo)
set GREEN=[32m
set YELLOW=[33m
set BLUE=[34m
set RED=[31m
set NC=[0m

echo.
echo %BLUE%╔════════════════════════════════════════════════════════════════╗%NC%
echo %BLUE%║   Employee Performance Tracker - Backend Setup ^& Run           ║%NC%
echo %BLUE%╚════════════════════════════════════════════════════════════════╝%NC%
echo.

REM ==============================================================================
REM 1.5 CHECK BUILD TOOLS (Required for compiling packages like pandas)
REM ==============================================================================
echo.
echo %YELLOW%[1.5/8]%NC% Checking Visual C++ Build Tools...

REM Check if cl.exe (MSVC compiler) is available
where cl.exe >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%⚠ Visual C++ Build Tools not found%NC%
    echo.
    echo %RED%Building packages like pandas requires Visual C++ Build Tools%NC%
    echo %YELLOW%Install one of the following:%NC%
    echo   - Visual Studio Community (free) with C++ workload
    echo   - Visual Studio Build Tools
    echo   - Download from: https://visualstudio.microsoft.com/
    echo.
    echo %YELLOW%After installation, restart this script%NC%
    pause
    exit /b 1
) else (
    echo %GREEN%✓ Visual C++ Build Tools available%NC%
)
echo %YELLOW%[2/8]%NC% Checking Python installation...

python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo %RED%✗ Python 3 not found. Please install Python 3.9 or higher%NC%
    echo   Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo %GREEN%✓ Python %PYTHON_VERSION% found%NC%

REM ==============================================================================
REM 2. CREATE & ACTIVATE VIRTUAL ENVIRONMENT
REM ==============================================================================
echo.
echo %YELLOW%[3/8]%NC% Setting up Python virtual environment...

if not exist "venv" (
    echo   Creating new virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo %RED%✗ Failed to create virtual environment%NC%
        pause
        exit /b 1
    )
    echo %GREEN%✓ Virtual environment created%NC%
) else (
    echo %GREEN%✓ Virtual environment already exists%NC%
)

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo %GREEN%✓ Virtual environment activated%NC%
) else (
    echo %RED%✗ Could not activate virtual environment%NC%
    pause
    exit /b 1
)

REM ==============================================================================
REM 3. INSTALL PYTHON DEPENDENCIES
REM ==============================================================================
echo.
echo %YELLOW%[4/8]%NC% Installing Python dependencies...

REM Check Python version for compatibility
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
echo %YELLOW%  (%PYTHON_VER% detected)%NC%

REM Set environment variable for Python 3.14+ compatibility with PyO3
set PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo %RED%✗ Failed to install dependencies%NC%
    pause
    exit /b 1
)
echo %GREEN%✓ Dependencies installed successfully%NC%

REM ==============================================================================
REM 4. CHECK & START DOCKER CONTAINERS
REM ==============================================================================
echo.
echo %YELLOW%[5/8]%NC% Checking Docker and containers...

docker --version >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%⚠ Docker not found. Make sure PostgreSQL and Redis are running:%NC%
    echo %YELLOW%   - PostgreSQL: postgresql://ods_user:ods_password@localhost:5432/ods_db%NC%
    echo %YELLOW%   - Redis: redis://localhost:6379/0%NC%
) else (
    echo   Docker detected. Checking containers...
    
    if not exist "docker-compose.yml" (
        if exist "..\docker-compose.yml" (
            cd ..
            echo %GREEN%✓ Found docker-compose.yml in parent directory%NC%
        ) else (
            echo %YELLOW%⚠ docker-compose.yml not found. Skipping Docker setup%NC%
            goto :skip_docker
        )
    )
    
    echo   Starting Docker containers...
    docker-compose up -d postgres redis >nul 2>&1
    if not errorlevel 1 (
        echo %GREEN%✓ Docker containers started%NC%
        echo   Waiting for services to be ready...
        timeout /t 5 /nobreak >nul
    ) else (
        echo %YELLOW%⚠ Could not start Docker containers%NC%
    )
)

:skip_docker

REM ==============================================================================
REM 5. CREATE & CONFIGURE .env FILE
REM ==============================================================================
echo.
echo %YELLOW%[6/8]%NC% Setting up environment configuration...

if not exist ".env" (
    echo   Creating .env file with default configuration...
    (
        echo # Application Settings
        echo APP_NAME=ODS
        echo APP_VERSION=1.0.0
        echo DEBUG=True
        echo.
        echo # Database Configuration
        echo DATABASE_URL=postgresql://ods_user:ods_password@localhost:5432/ods_db
        echo DATABASE_POOL_SIZE=20
        echo DATABASE_MAX_OVERFLOW=10
        echo.
        echo # Redis Configuration
        echo REDIS_URL=redis://localhost:6379/0
        echo.
        echo # JWT Settings
        echo SECRET_KEY=your-secret-key-change-in-production
        echo ALGORITHM=HS256
        echo ACCESS_TOKEN_EXPIRE_MINUTES=60
        echo REFRESH_TOKEN_EXPIRE_DAYS=30
        echo.
        echo # Session Management
        echo MAX_LOGIN_ATTEMPTS=5
        echo LOGIN_BLOCK_DURATION_MINUTES=15
        echo MAX_REQUESTS_PER_MINUTE=60
        echo SESSION_CLEANUP_ENABLED=True
        echo AUTO_REFRESH_BEFORE_EXPIRY_MINUTES=5
        echo.
        echo # CORS Configuration
        echo CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
        echo ALLOWED_HOSTS=localhost,127.0.0.1
        echo.
        echo # File Upload
        echo MAX_UPLOAD_SIZE_MB=50
        echo UPLOAD_DIR=./uploads
        echo ALLOWED_EXTENSIONS=.xlsx,.xls
    ) > .env
    echo %GREEN%✓ .env file created%NC%
    echo %YELLOW%  ⚠ Remember to update SECRET_KEY in production!%NC%
) else (
    echo %GREEN%✓ .env file already exists%NC%
)

REM ==============================================================================
REM 6. INITIALIZE DATABASE
REM ==============================================================================
echo.
echo %YELLOW%[7/8]%NC% Initializing database...

python init_db.py >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%⚠ Database initialization had issues, but continuing...%NC%
) else (
    echo %GREEN%✓ Database initialized successfully%NC%
)

REM ==============================================================================
REM 7. START BACKEND SERVER
REM ==============================================================================
echo.
echo %YELLOW%[8/8]%NC% Starting backend server...
echo.
echo %GREEN%╔════════════════════════════════════════════════════════════════╗%NC%
echo %GREEN%║                    Backend Ready!                              ║%NC%
echo %GREEN%╚════════════════════════════════════════════════════════════════╝%NC%
echo.
echo %BLUE%API Documentation:%NC% http://localhost:8000/docs
echo %BLUE%ReDoc Documentation:%NC% http://localhost:8000/redoc
echo %BLUE%API Health Check:%NC% http://localhost:8000/health
echo.
echo %YELLOW%Press Ctrl+C to stop the server%NC%
echo.

REM Start the backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level info

pause
