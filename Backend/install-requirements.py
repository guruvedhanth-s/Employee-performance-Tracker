#!/usr/bin/env python3
"""
Install dependencies with PyO3 Python 3.14+ compatibility support.

This script runs pip install with PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
to support Python 3.14+ with pydantic-core and other Rust-based packages.
"""

import os
import subprocess
import sys

def main():
    # Set environment variable for PyO3 compatibility with Python 3.14+
    os.environ['PYO3_USE_ABI3_FORWARD_COMPATIBILITY'] = '1'
    
    print("Installing dependencies with PyO3 stable ABI compatibility...")
    print(f"Python version: {sys.version}")
    print()
    
    # Run pip install
    result = subprocess.run(
        [sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'],
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    
    sys.exit(result.returncode)

if __name__ == '__main__':
    main()
