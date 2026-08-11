import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, 'verify-30-z-location-policy-enforcement-contract.mjs');
let source = readFileSync(path, 'utf8');

const replace = (before, after, label) => {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Missing 30-Z contract anchor: ${label}`);
  source = source.replace(before, after);
};

replace(
  "  'new RepositoryBackedTimelineQueryPort(timelineApplicationDependencies)',",
  `  'const timelinePolicyTransactionRunner = new RepositoryBackedTimelinePolicyTransactionRunner(',
  'new RepositoryBackedTimelineQueryPort(',
  'timelinePolicyTransactionRunner'`,
  'shared timeline and location runner composition'
);

replace(
  "  'options?: { readonly governedLocationReadId: string }',",
  "  'governedLocationReadId?: string',",
  'optional governed location read identifier'
);

replace(
  `  'governedLocationContext: PolicyAuthorizedRepositoryExecutionContext | undefined',
  'this.dependencies.locationRepository.findById(this.governedLocationContext, this.familyId, locationId)',`,
  `  'private readonly locationProof: TimelineLocationProof | undefined',
  'this.dependencies.locationRepository.findById(',
  'options.governedLocationReadId!',
  'receiptHash: computePlatformPolicyReceiptHash(authorization.receiptRecord.receipt)',
  'sourceLocationReceiptHash'`,
  'same-transaction exact location proof binding'
);

writeFileSync(path, source, 'utf8');
console.log('PPK-002-aware 30-Z static contract anchors updated');
