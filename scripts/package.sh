#!/bin/sh
# Builds the zip that testers download, then the one for the Chrome Web Store: npm run package
# The zip holds one folder, micro.breaks, ready for "Load unpacked".
set -e
npx wxt build
# zip adds to an existing archive: remove the last one, or its files stay in the new zip
rm -rf .output/package .output/micro.breaks.zip
mkdir -p .output/package
cp -R .output/chrome-mv3 .output/package/micro.breaks
(cd .output/package && zip -qr ../micro.breaks.zip micro.breaks)
rm -rf .output/package
echo "✔ .output/micro.breaks.zip"

# The Chrome Web Store build: no fixed ID, and manifest.json at the root of the zip, as the store expects
MB_STORE=1 npx wxt build
rm -f .output/micro.breaks-store.zip
(cd .output/chrome-mv3 && zip -qr ../micro.breaks-store.zip .)
echo "✔ .output/micro.breaks-store.zip"
