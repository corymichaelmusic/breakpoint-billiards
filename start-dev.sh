#!/bin/bash

# Function to kill all child processes on exit
cleanup() {
    echo "Stopping all servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set trap to catch exit signals
trap cleanup SIGINT SIGTERM EXIT

# Get the script functionality directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "----------------------------------------------------------------"
echo "Starting Breakpoint Billiards Development Environment"
echo "----------------------------------------------------------------"

# Start Backend Server
echo "🚀 Starting Backend Server..."
"$DIR/start-backend.sh" &
BACKEND_PID=$!

# Wait for backend to be ready (rudimentary check)
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Start Mobile App
echo "📱 Starting Mobile App..."
"$DIR/start-mobile.sh"

# Wait for background processes
wait $BACKEND_PID
