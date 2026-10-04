#!/bin/sh
# Builds the zip that testers download: npm run package
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
