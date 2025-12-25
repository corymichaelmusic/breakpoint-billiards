#!/bin/bash
# Go to project root
cd "/Users/cm/Breakpoint Billiards"

echo "🛠️  Fixing Deployment..."

# 1. Ensure package-lock is gone locally (force regeneration on Vercel)
rm -f package-lock.json

# 2. Stage ALL changes (including the deleted lockfile and package.json updates)
git add .

# 3. Commit
git commit -m "Force fix dependencies (Nuke lockfile for Vercel)" || echo "Nothing to commit, proceeding to push..."

# 4. Push to origin
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo "✅ Done! Check your Vercel dashboard."
