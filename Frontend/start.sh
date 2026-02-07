#!/bin/bash
# Frontend Startup Script for Git Bash

# Add Node.js to PATH
export PATH="/c/Program Files/nodejs:$PATH"

# Navigate to Frontend directory
cd "$(dirname "$0")"

# Kill any existing node processes on port 3000 (optional - uncomment if needed)
# taskkill //F //IM node.exe 2>/dev/null || true

# Run development server
npm run dev
