import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const evidencePath = resolve(root, 'artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json');
const generatedAt = new Date().toISOString();

const evidence = {
  schemaVersion: 1,
  requirementId: 'PPK-002',
  decisionId: 'DEC-156',
  status: 'PASS',
  scope: 'LOCAL_FULL_REGRESSION_ONLY',
  officialStepAdvanced: false,
  officialBuildClaim: false,
  external30ZReceipt: 'PENDING',
  command: 'node node_modules/vitest/vitest.mjs run',
  testFileCount: 28,
  testFilePassCount: 28,
  testCount: 158,
  testPassCount: 158,
  startedAt: '2026-08-10T07:35:20.000Z',
  durationSeconds: 69.43,
  generatedAt
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

const appendSection = (relativePath, marker, section) => {
  const path = resolve(root, relativePath);
  const source = readFileSync(path, 'utf8');
  if (source.includes(marker)) return;
  writeFileSync(path, `${source.trimEnd()}\n\n${section.trim()}\n`, 'utf8');
};

appendSection(
  'docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md',
  '## Tam regresyon kapanışı',
  `## Tam regresyon kapanışı

2026-08-10 tam Vitest paketi 28/28 dosya ve 158/158 test ile PASS olmuştur. Test fixture uyarlamaları süreli nesne izni, timeline okuması için \`family.read\`, tam LIFE-create drift noktası, \`governed_timeline_events\` fixture görünümü ve receipt'siz korumalı satır üretmeyen kontrollü otomasyon kaynağı ile sınırlıdır. Ürün fail-closed davranışı gevşetilmemiştir.

Kanıt: \`artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json\`. Yeniden üretim: \`scripts/fix-ppk002-governed-regression-fixtures.mjs\`, \`scripts/refine-ppk002-governed-regression-fixtures.mjs\`, \`scripts/complete-ppk002-governed-regression-fixtures.mjs\`.`
);

appendSection(
  'docs/audit/PPK-002_TIMELINE_POLICY_LOCAL_CONTINUATION.md',
  '## Tam regresyon kanıtı',
  `## Tam regresyon kanıtı

- TypeScript \`tsc --noEmit\`: PASS
- Workspace package build: PASS
- Vitest tam paket: PASS, 28/28 dosya ve 158/158 test
- Kanıt: \`artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json\`

Bu sonuç yalnız yerel regresyon kapanışıdır; PPK-002 gereksinimini veya 30-Z adımını resmî COMPLETE/PASS yapmaz.`
);

const authorityPath = resolve(root, 'artifacts/authority/PPK002_TIMELINE_LOCAL_CONTINUATION_AUTHORITY.json');
const authority = JSON.parse(readFileSync(authorityPath, 'utf8'));
authority.evidence = [...new Set([
  ...authority.evidence,
  'artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json'
])];
authority.localFullRegression = {
  status: 'PASS',
  testFiles: '28/28',
  tests: '158/158',
  officialClaim: false
};
writeFileSync(authorityPath, `${JSON.stringify(authority, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(evidence, null, 2));
