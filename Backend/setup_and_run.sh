#!/bin/bash

################################################################################
# Employee Performance Tracker - Backend Setup & Run Script
# 
# This script handles:
# - Python environment setup (venv)
# - Dependency installation
# - Docker containers (PostgreSQL + Redis)
# - Database initialization
# - Auto-start backend server
#
# Usage: ./setup_and_run.sh
################################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Employee Performance Tracker - Backend Setup & Run           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ==============================================================================
# 1. CHECK PYTHON INSTALLATION
# ==============================================================================
echo -e "${YELLOW}[1/7]${NC} Checking Python installation..."

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 not found. Please install Python 3.9 or higher${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✓ Python ${PYTHON_VERSION} found${NC}"

# Check for Python 3.14+ compatibility issue
PYTHON_MAJOR_MINOR=$(python3 -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")')
if [ "$(python3 -c 'import sys; print(1 if sys.version_info >= (3, 14) else 0)')" = "1" ]; then
    echo ""
    echo -e "${YELLOW}⚠ WARNING: Python 3.14+ detected${NC}"
    echo -e "${YELLOW}Python 3.14 has compatibility issues with pydantic-core and some dependencies.${NC}"
    echo ""
    echo -e "${YELLOW}Recommended: Use Python 3.13 or earlier${NC}"
    echo ""
    echo -e "${BLUE}To fix:${NC}"
    echo -e "${BLUE}  1. Install Python 3.13: sudo dnf install python3.13${NC}"
    echo -e "${BLUE}  2. Remove old venv: rm -rf venv/${NC}"
    echo -e "${BLUE}  3. Create new venv: python3.13 -m venv venv${NC}"
    echo -e "${BLUE}  4. Activate: source venv/bin/activate${NC}"
    echo -e "${BLUE}  5. Re-run: ./setup_and_run.sh${NC}"
    echo ""
    echo -e "${YELLOW}See PYTHON_314_ISSUE.md for details.${NC}"
    echo ""
    read -p "Continue with Python 3.14 (not recommended)? [y/N]: " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# ==============================================================================
# 1.5 CHECK BUILD TOOLS (Required for compiling packages like pandas)
# ==============================================================================
echo ""
echo -e "${YELLOW}[1.5/8]${NC} Checking build tools..."

if ! command -v gcc &> /dev/null || ! command -v g++ &> /dev/null; then
    echo -e "${RED}⚠ ERROR: Build tools (gcc/g++) not found${NC}"
    echo -e "${YELLOW}Build tools are required to compile packages like pandas${NC}"
    echo ""
    
    if command -v dnf &> /dev/null; then
        # Fedora/RHEL
        echo -e "${YELLOW}Detected: Fedora/RHEL${NC}"
        echo -e "${YELLOW}Run this command to install build tools:${NC}"
        echo ""
        echo -e "${BLUE}  sudo dnf install -y gcc-c++ python3-devel${NC}"
        echo ""
    elif command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        echo -e "${YELLOW}Detected: Ubuntu/Debian${NC}"
        echo -e "${YELLOW}Run this command to install build tools:${NC}"
        echo ""
        echo -e "${BLUE}  sudo apt-get update && sudo apt-get install -y build-essential python3-dev${NC}"
        echo ""
    elif command -v brew &> /dev/null; then
        # macOS
        echo -e "${YELLOW}Detected: macOS${NC}"
        echo -e "${YELLOW}Run this command to install Xcode Command Line Tools:${NC}"
        echo ""
        echo -e "${BLUE}  xcode-select --install${NC}"
        echo ""
    else
        echo -e "${YELLOW}Please install build tools for your system:${NC}"
        echo ""
        echo -e "${BLUE}  Fedora/RHEL:   sudo dnf install -y gcc-c++ python3-devel${NC}"
        echo -e "${BLUE}  Ubuntu/Debian: sudo apt-get install -y build-essential python3-dev${NC}"
        echo -e "${BLUE}  macOS:         xcode-select --install${NC}"
        echo -e "${BLUE}  Windows:       Install Visual Studio Build Tools${NC}"
        echo ""
    fi
    
    echo -e "${YELLOW}After installation, run this script again:${NC}"
    echo -e "${BLUE}  ./setup_and_run.sh${NC}"
    echo ""
    exit 1
else
    echo -e "${GREEN}✓ Build tools available${NC}"
fi

# ==============================================================================
# 2. CREATE & ACTIVATE VIRTUAL ENVIRONMENT
# ==============================================================================
echo ""
echo -e "${YELLOW}[2/8]${NC} Setting up Python virtual environment..."

if [ ! -d "venv" ]; then
    echo "  Creating new virtual environment..."
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo -e "${GREEN}✓ Virtual environment activated${NC}"
elif [ -f "venv/Scripts/activate" ]; then
    # Windows Git Bash
    source venv/Scripts/activate
    echo -e "${GREEN}✓ Virtual environment activated (Windows)${NC}"
else
    echo -e "${RED}✗ Could not activate virtual environment${NC}"
    exit 1
fi

# ==============================================================================
# 3. INSTALL PYTHON DEPENDENCIES
# ==============================================================================
echo ""
echo -e "${YELLOW}[3/8]${NC} Installing Python dependencies..."

# Handle Python 3.14+ compatibility with PyO3/pydantic-core
# PyO3 0.22.x doesn't officially support Python 3.14, but using stable ABI works
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info[0]}{sys.version_info[1]}")')
if [ "$PYTHON_VERSION" -gt 313 ]; then
    echo "  (Python 3.14+ detected - enabling stable ABI for compatibility...)"
    export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
fi

if pip install -r requirements.txt --quiet; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

# ==============================================================================
# 4. CHECK & START DOCKER CONTAINERS
# ==============================================================================
echo ""
echo -e "${YELLOW}[4/8]${NC} Checking Docker and containers..."

if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "  Docker detected. Checking containers..."
    
    # Check if docker-compose file exists
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${YELLOW}  ⚠ docker-compose.yml not found in current directory${NC}"
        echo -e "${YELLOW}  Looking in parent directory...${NC}"
        if [ -f "../docker-compose.yml" ]; then
            cd ..
            echo -e "${GREEN}✓ Found docker-compose.yml in parent directory${NC}"
        else
            echo -e "${YELLOW}  ⚠ docker-compose.yml not found. Skipping Docker setup${NC}"
            SKIP_DOCKER=true
        fi
    fi
    
    if [ "$SKIP_DOCKER" != "true" ]; then
        echo "  Starting Docker containers (PostgreSQL + Redis)..."
        
        # Start containers in background
        docker-compose up -d postgres redis > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Docker containers started${NC}"
            
            # Wait for PostgreSQL to be ready
            echo "  Waiting for PostgreSQL to be ready..."
            max_attempts=30
            attempt=0
            while [ $attempt -lt $max_attempts ]; do
                if docker-compose exec -T postgres pg_isready -U ods_user -d ods_db > /dev/null 2>&1; then
                    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
                    break
                fi
                sleep 1
                attempt=$((attempt + 1))
            done
            
            if [ $attempt -eq $max_attempts ]; then
                echo -e "${YELLOW}⚠ PostgreSQL took longer to start, but continuing...${NC}"
            fi
            
            # Wait for Redis to be ready
            echo "  Waiting for Redis to be ready..."
            if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Redis is ready${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ Could not start Docker containers. Continuing with manual setup...${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠ Docker/docker-compose not found. Make sure PostgreSQL and Redis are running manually:${NC}"
    echo -e "${YELLOW}   - PostgreSQL: postgresql://ods_user:ods_password@localhost:5432/ods_db${NC}"
    echo -e "${YELLOW}   - Redis: redis://localhost:6379/0${NC}"
fi

# ==============================================================================
# 5. CREATE & CONFIGURE .env FILE
# ==============================================================================
echo ""
echo -e "${YELLOW}[5/8]${NC} Setting up environment configuration..."

cd "$SCRIPT_DIR"

if [ ! -f ".env" ]; then
    echo "  Creating .env file with default configuration..."
    cat > .env << 'EOF'
# Application Settings
APP_NAME=ODS
APP_VERSION=1.0.0
DEBUG=True

# Database Configuration
DATABASE_URL=postgresql://ods_user:ods_password@localhost:5432/ods_db
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# JWT Settings
SECRET_KEY=your-secret-key-change-in-production-$(openssl rand -hex 32)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# Session Management
MAX_LOGIN_ATTEMPTS=5
LOGIN_BLOCK_DURATION_MINUTES=15
MAX_REQUESTS_PER_MINUTE=60
SESSION_CLEANUP_ENABLED=True
AUTO_REFRESH_BEFORE_EXPIRY_MINUTES=5

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
ALLOWED_HOSTS=localhost,127.0.0.1

# File Upload
MAX_UPLOAD_SIZE_MB=50
UPLOAD_DIR=./uploads
ALLOWED_EXTENSIONS=.xlsx,.xls
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}  ⚠ Remember to update SECRET_KEY in production!${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# ==============================================================================
# 6. INITIALIZE DATABASE
# ==============================================================================
echo ""
echo -e "${YELLOW}[6/8]${NC} Initializing database..."

if python init_db.py > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database initialized successfully${NC}"
else
    echo -e "${YELLOW}⚠ Database initialization had issues, but continuing...${NC}"
    echo -e "${YELLOW}  (Database may already exist or require manual setup)${NC}"
fi

# ==============================================================================
# 7. START BACKEND SERVER
# ==============================================================================
echo ""
echo -e "${YELLOW}[7/8]${NC} Starting backend server..."
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Backend Ready!                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}API Documentation:${NC} http://localhost:8000/docs"
echo -e "${BLUE}ReDoc Documentation: http://localhost:8000/redoc"
echo -e "${BLUE}API Health Check:   http://localhost:8000/health"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start the backend server with auto-reload for development
python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level info
