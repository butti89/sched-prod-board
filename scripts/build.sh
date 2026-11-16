#!/bin/sh
# Copies app/ to _site/ and stamps the build's git sha into the page (meta name="build" and the footer).
# Usage: scripts/build.sh [sha]   (default: the checked-out commit)
set -eu
cd "$(dirname "$0")/.."
SHA="${1:-$(git rev-parse HEAD)}"
rm -rf _site
cp -R app _site
sed -i.bak "s/__BUILD_SHA__/$SHA/g" _site/index.html && rm _site/index.html.bak
echo "built _site/ at $SHA"
