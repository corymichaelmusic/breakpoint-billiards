#!/bin/bash
# Load environment to ensure npm is found
if [ -f ~/.zshrc ]; then
    source ~/.zshrc
elif [ -f ~/.bash_profile ]; then
    source ~/.bash_profile
fi

echo "Installing Avatar Dependencies..."
npm install expo-image-picker expo-image-manipulator
