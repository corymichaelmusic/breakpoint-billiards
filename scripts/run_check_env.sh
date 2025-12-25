#!/bin/bash
source ~/.zshrc 2>/dev/null || source ~/.bash_profile 2>/dev/null || source ~/.bashrc 2>/dev/null
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin
node scripts/check_env.js
