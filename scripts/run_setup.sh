#!/bin/bash
# Load environment to ensure node is found
if [ -f ~/.zshrc ]; then
    source ~/.zshrc
elif [ -f ~/.bash_profile ]; then
    source ~/.bash_profile
fi

echo "Running Avatar Database Setup..."
node scripts/setup_avatars_sql.js
