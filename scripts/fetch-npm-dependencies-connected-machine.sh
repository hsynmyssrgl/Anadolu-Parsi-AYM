#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
node scripts/create-npm-dependency-acquisition-plan.mjs
node scripts/fetch-npm-dependency-acquisition-bundle.mjs "$@"
node scripts/verify-npm-cache-transfer-bundle.mjs --archive artifacts/validation/npm-cache-transfer-bundle.zip
