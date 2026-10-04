#!/bin/sh
# Builds the zip that testers download: npm run package
# The zip holds one folder, micro.breaks, ready for "Load unpacked".
set -e
# Start from an empty build folder: chunks left over from earlier builds would end up in the zip
rm -rf .output/chrome-mv3
npx wxt build
rm -rf .output/package && mkdir -p .output/package
cp -R .output/chrome-mv3 .output/package/micro.breaks
(cd .output/package && zip -qr ../micro.breaks.zip micro.breaks)
rm -rf .output/package
echo "✔ .output/micro.breaks.zip"
