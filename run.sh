#!/bin/bash

# Kill any existing processes on ports 5001 or 5173 (optional but safe)
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "Starting Print Server..."
cd print-server
source venv/bin/activate
python app.py &
SERVER_PID=$!

echo "Starting Frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "App running. Server PID: $SERVER_PID, Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."

trap "kill $SERVER_PID $FRONTEND_PID; exit" SIGINT

wait
