#!/bin/sh
# Prepara triangle-riso-scan.zip: solo quello che serve a Figma per importare il plugin.
set -e
cd "$(dirname "$0")/.."
rm -rf build && mkdir -p build/triangle-riso-scan/dist
cp manifest.json code.js README.md build/triangle-riso-scan/
cp dist/ui.html build/triangle-riso-scan/dist/
(cd build && rm -f ../triangle-riso-scan.zip && zip -qr ../triangle-riso-scan.zip triangle-riso-scan)
rm -rf build
ls -lh triangle-riso-scan.zip
