# Run Commands

## Quick Start (Easy Way)

### Backend
```bash
cd Backend
./start.sh
```

### Frontend
```bash
cd Frontend
./start.sh
```

---

## Prerequisites

### Required Software
- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 7+

### Windows Setup
```bash
# Install Redis (using Chocolatey or WSL)
choco install redis-64

# Or use Docker for Redis
docker run -d -p 6379:6379 redis:latest

# Add Node.js to PATH if needed
# Check: node --version
# If not found, reinstall Node.js or add to PATH
```

### Start Services (Windows)
```bash
# Start Redis (if installed via Chocolatey)
redis-server

# Or use Docker
docker start <redis-container-id>

# Start PostgreSQL service
net start postgresql-x64-14
```

## Backend

### Windows (Git Bash/PowerShell)
```bash
cd Backend
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip
pip install -r requirements.txt
python init_db.py
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Linux/Mac
```bash
cd Backend
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python init_db.py
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend

### Fix Node.js PATH Issue (Windows Git Bash)
```bash
# Exit venv first
deactivate

# Verify Node.js is available
where node
node --version

# If not found, add Node.js to PATH manually:
export PATH="/c/Program Files/nodejs:$PATH"

# Or use CMD/PowerShell instead of Git Bash
```

### Run Frontend
```bash
cd Frontend
npm install
npm run dev
```

## Docker (Both)

```bash
docker-compose up --build
```

## URLs

- Backend: http://localhost:8000
- Backend Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173

## Troubleshooting

### Backend: Redis Connection Error
```
Failed to connect to Redis: Error 10061
```
**Fix:** Start Redis server
```bash
# Windows (Chocolatey)
redis-server

# Docker
docker run -d -p 6379:6379 redis:latest

# WSL
sudo service redis-server start
```

### Frontend: Node not recognized
```
'"node"' is not recognized
```
**Fix:** Exit Python venv and ensure Node.js is in PATH
```bash
deactivate
where node
# If not found, add to PATH or use CMD/PowerShell
```

### Backend: Database Connection Error
**Fix:** Ensure PostgreSQL is running and update `.env` file
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ods_db
```
