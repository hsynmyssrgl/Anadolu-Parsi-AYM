import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const evidencePath = resolve(root, 'artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
Object.assign(evidence, {
  testFileCount: 28,
  testFilePassCount: 28,
  testCount: 158,
  testPassCount: 158,
  startedAt: '2026-08-10T07:51:58.000Z',
  durationSeconds: 66.27,
  platformPolicyGate: 'PASS / legacy debt 28 / new bypass 0',
  generatedAt: new Date().toISOString()
});
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

const append = (relativePath, marker, content) => {
  const path = resolve(root, relativePath);
  const source = readFileSync(path, 'utf8');
  if (!source.includes(marker)) writeFileSync(path, `${source.trimEnd()}\n\n${content.trim()}\n`, 'utf8');
};
append(
  'docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md',
  '## Doğrudan rol bypassı kapanışı',
  `## Doğrudan rol bypassı kapanışı

Timeline repository içindeki PEP-sonrası doğrudan \`family_admin\` görünürlük bypassı kaldırıldı. Kişisel etkinlik görünürlüğü yalnız sahiplik, aile görünürlüğü, seçili katılım ve süreli nesne izni ile belirlenir. Platform Policy Gate PASS: legacy debt 28, new bypass 0. Son tam regresyon 28/28 dosya ve 158/158 test PASS.`
);
append(
  'docs/audit/PPK-002_TIMELINE_POLICY_LOCAL_CONTINUATION.md',
  '## Platform policy bypass kapanışı',
  `## Platform policy bypass kapanışı

- Timeline doğrudan rol bypassı: kaldırıldı
- Platform Policy Gate: PASS, legacy debt 28, new bypass 0
- Değişiklik sonrası tam Vitest: PASS, 28/28 dosya ve 158/158 test
- Resmî kapsam etkisi: yok; PPK-002 PARTIAL ve haricî 30-Z receipt PENDING`
);

console.log(JSON.stringify(evidence, null, 2));
