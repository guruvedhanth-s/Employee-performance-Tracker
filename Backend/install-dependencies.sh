#!/bin/bash

# Install dependencies with PyO3 Python 3.14+ support

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/venv/bin/python3"
VENV_PIP="$SCRIPT_DIR/venv/bin/pip"

echo "Installing backend dependencies..."
echo "Python: $($VENV_PYTHON --version)"
echo ""

# Set PyO3 compatibility
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

# Upgrade pip
echo "Upgrading pip, setuptools, wheel..."
$VENV_PIP install --upgrade pip setuptools wheel -q

# Install requirements
echo "Installing requirements from requirements.txt..."
$VENV_PIP install -r "$SCRIPT_DIR/requirements.txt"

echo ""
echo "✓ Dependencies installed successfully!"
