import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const update = (relativePath, mutations) => {
  const path = resolve(root, relativePath);
  let source = readFileSync(path, 'utf8');
  for (const { before, after, label } of mutations) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`${relativePath}: missing ${label}`);
    source = source.replace(before, after);
  }
  writeFileSync(path, source, 'utf8');
};

update('apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts', [
  {
    label: 'remove receiptless health source seed',
    before: `    database.prepare(\`
      INSERT INTO medication_plans(
        id,family_id,owner_person_id,name,dosage,schedule,provider,
        starts_at,ends_at,privacy,notes,created_at
      ) VALUES('plan-due','family-main',?,'Yönetişimli ilaç kaynağı','1 doz','daily',NULL,
        '2026-08-09T03:00:00.000Z',NULL,'private',NULL,?)
    \`).run(account.person_id, NOW);
`,
    after: ''
  },
  {
    label: 'controlled governed due-source seam',
    before: '    const automationRepository = new SqliteAutomationRepository();',
    after: `    const automationRepository = new Proxy(new SqliteAutomationRepository(), {
      get(target, property, receiver) {
        if (property === 'listNonLifeDueSources') {
          return () => ok([{
            id: 'source-due',
            title: 'Yönetişimli otomasyon kaynağı',
            dueAt: asIsoDateTime('2026-08-09T03:00:00.000Z')
          }]);
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });`
  }
]);

update('apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts', [
  {
    label: 'timeline read context capture',
    before: `    const eventWriteContexts: RepositoryExecutionContext[] = [];
    const locationReadContexts: PolicyAuthorizedRepositoryExecutionContext[] = [];
    const permissionReadContexts: RepositoryExecutionContext[] = [];`,
    after: `    const eventWriteContexts: RepositoryExecutionContext[] = [];
    const timelineReadContexts: PolicyAuthorizedRepositoryExecutionContext[] = [];
    const locationReadContexts: PolicyAuthorizedRepositoryExecutionContext[] = [];
    const permissionReadContexts: RepositoryExecutionContext[] = [];`
  },
  {
    label: 'governed timeline repository read capture',
    before: `    const timelineRepository = {
      listByFamily: () => ok([linkedEvent]),
      listArchivedByFamily: () => ok([linkedEvent]),
      findById: () => ok(linkedEvent),`,
    after: `    const timelineRepository = {
      listByFamily: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        timelineReadContexts.push(context);
        return ok([linkedEvent]);
      },
      listArchivedByFamily: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        timelineReadContexts.push(context);
        return ok([linkedEvent]);
      },
      findById: (context: PolicyAuthorizedRepositoryExecutionContext) => {
        timelineReadContexts.push(context);
        return ok(linkedEvent);
      },`
  },
  {
    label: 'governed timeline read assertion',
    before: `    expect(genericTransactionCalls).toBe(0);
    expect(permissionReadContexts.at(-1)?.transaction).toBe(transaction);`,
    after: `    expect(genericTransactionCalls).toBe(0);
    expect(timelineReadContexts.at(-1)?.transaction).toBe(transaction);
    expect(timelineReadContexts.at(-1)).toHaveProperty('policyAuthorization');
    expect(permissionReadContexts).toEqual([]);`
  }
]);

console.log('PPK-002 governed regression fixtures refined');
