#!/bin/bash
# Absolute path to the mobile project
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/mobile"

# Check if directory exists
if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Project directory not found at $PROJECT_DIR"
  exit 1
fi

# Navigate to directory
cd "$PROJECT_DIR" || exit 1

# Load environment to ensure npm is found
if [ -f ~/.zshrc ]; then
    source ~/.zshrc
elif [ -f ~/.bash_profile ]; then
    source ~/.bash_profile
fi

echo "Starting Breakpoint Billiards Mobile App..."
echo "Directory: $(pwd)"

# Start Expo
npx expo start --go --tunnel
