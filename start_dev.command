#!/bin/bash
echo "Starting Breakpoint Billiards Dev Server..."
# Ensure we are in the correct directory
cd "/Users/cm/breakpoint-billiards"

# Add node to PATH (using the specific version found earlier)
export PATH="/Users/cm/.nvm/versions/node/v24.11.1/bin:$PATH"

# Run the dev server
npm run dev
