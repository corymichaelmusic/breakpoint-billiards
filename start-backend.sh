#!/bin/bash
# Load environment to ensure npm is found
if [ -f ~/.zshrc ]; then
    source ~/.zshrc
elif [ -f ~/.bash_profile ]; then
    source ~/.bash_profile
fi

echo "Starting Backend Server (0.0.0.0)..."
npm run dev -- -H 0.0.0.0
