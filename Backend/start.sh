#!/bin/bash
# Backend Startup Script

# Navigate to Backend directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/Scripts/activate

# Start backend server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
