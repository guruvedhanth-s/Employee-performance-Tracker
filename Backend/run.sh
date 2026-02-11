#!/bin/bash

# Employee Performance Tracker Backend Runner
echo "Starting Employee Performance Tracker Backend..."

# Set Python path
export PYTHONPATH="${PYTHONPATH}:/home/buddy/Work/Employee-performance-Tracker/Backend"

# Change to backend directory
cd /home/buddy/Work/Employee-performance-Tracker/Backend

# Start the server
python app/main.py