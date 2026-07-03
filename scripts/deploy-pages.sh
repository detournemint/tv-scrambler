#!/usr/bin/env bash
# Deploy dist/ to the gh-pages branch (GitHub Pages source).
# Used instead of a GitHub Actions workflow because the local gh token
# lacks the `workflow` scope; see docs/github-pages-workflow.yml.
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
npm run build
SHA=$(git rev-parse --short HEAD)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="Gregg Horton" -c user.email="greggahorton@gmail.com" commit -q -m "deploy ${SHA}"
git push -f "$(git -C .. remote get-url origin)" gh-pages
cd ..
rm -rf dist/.git
echo "deployed ${SHA} to gh-pages"
