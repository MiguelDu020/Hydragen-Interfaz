#!/bin/bash
# HydraGen Backend Launcher
# Run this from any directory; it always starts from the backend/ folder.
cd "$(dirname "$0")"
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt -q
echo "🚀 Starting HydraGen backend on http://0.0.0.0:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
