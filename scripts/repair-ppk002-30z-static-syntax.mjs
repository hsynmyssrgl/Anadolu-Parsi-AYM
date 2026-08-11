import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, 'verify-30-z-location-policy-enforcement-contract.mjs');
let source = readFileSync(path, 'utf8');
source = source
  .replace("  'timelinePolicyTransactionRunner'\n  'new RepositoryBackedDashboardQueryPort({',", "  'timelinePolicyTransactionRunner',\n  'new RepositoryBackedDashboardQueryPort({',")
  .replace("  'sourceLocationReceiptHash'\n  'const { locationId: _locationId, locationLabel: _locationLabel, ...redacted } = event',", "  'sourceLocationReceiptHash',\n  'const { locationId: _locationId, locationLabel: _locationLabel, ...redacted } = event',");
writeFileSync(path, source, 'utf8');
console.log('30-Z static contract syntax repaired');
