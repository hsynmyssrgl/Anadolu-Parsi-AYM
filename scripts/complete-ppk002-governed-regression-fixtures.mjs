import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const replace = (relativePath, before, after, label) => {
  const path = resolve(root, relativePath);
  const source = readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${relativePath}: missing ${label}`);
  writeFileSync(path, source.replace(before, after), 'utf8');
};

replace(
  'apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts',
  `    database.prepare(\`
      INSERT INTO medication_plans(
        id,family_id,owner_person_id,name,dosage,schedule,provider,
        starts_at,ends_at,privacy,notes,created_at
      ) VALUES('plan-due','family-main',?,'Yönetişimli ilaç kaynağı','1 doz','daily',NULL,
        '2026-08-09T03:00:00.000Z',NULL,'private',NULL,?)
    \`).run(account.person_id, NOW);
    database.prepare(\``,
  `    // The due-source seam is controlled below; no receiptless protected row is seeded.
    database.prepare(\``,
  'receiptless medication seed removal'
);

replace(
  'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  "  policyAuthorization: { receiptRecord: { receipt: { fixture: 'location-cross-surface' } } } as never",
  `  policyAuthorization: {
    subject: { accountId: ACCOUNT_ID, roles: ['adult_member'], personId: PERSON_ID },
    receiptRecord: { receipt: { fixture: 'location-cross-surface' } }
  } as never`,
  'fake policy subject'
);

console.log('PPK-002 governed regression fixtures completed');
