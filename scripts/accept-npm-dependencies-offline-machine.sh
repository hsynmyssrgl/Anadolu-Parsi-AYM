#!/usr/bin/env sh
set -eu
ARCHIVE="${1:-artifacts/validation/npm-cache-transfer-bundle.zip}"
CHECKSUM="${2:-${ARCHIVE}.sha256}"
node scripts/accept-npm-cache-transfer-bundle.mjs --archive "$ARCHIVE" --checksum "$CHECKSUM"
