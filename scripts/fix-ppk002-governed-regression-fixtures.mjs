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

update('apps/desktop/tests/data-store.test.ts', [{
  label: 'finite personal-event grant',
  before: "store.upsertPermission({ subjectAccountId: account.id, resourceType: 'event', resourceId: eventId, actions: ['read'], effect: 'allow' });",
  after: "store.upsertPermission({ subjectAccountId: account.id, resourceType: 'event', resourceId: eventId, actions: ['read'], effect: 'allow', endsAt: '2026-12-31T23:59:59.000Z' });"
}]);

update('apps/desktop/tests/finance-policy-enforcement-runtime.test.ts', [{
  label: 'timeline read capability in finance production fixture',
  before: "'windows-desktop': ['finance.read', 'finance.write', 'location.read', 'archive.write']",
  after: "'windows-desktop': ['family.read', 'finance.read', 'finance.write', 'location.read', 'archive.write']"
}]);

update('apps/desktop/tests/life-policy-enforcement-runtime.test.ts', [{
  label: 'exact LIFE create drift point',
  before: `        authorizations += 1;
        // createLifeRecord first performs one governed visibility read. Drift
        // only after the subsequent create receipt has been issued.
        if (authorizations === 2) {`,
  after: `        authorizations += 1;
        // Timeline/location reads may precede LIFE. Drift only after the exact
        // LIFE create receipt has been issued, independent of read count.
        if (input.request.resource.type === 'life_record' && input.request.action === 'create') {`
}]);

for (const path of [
  'apps/desktop/tests/health-cross-projection-privacy-runtime.test.ts',
  'apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts'
]) {
  update(path, [{
    label: 'governed timeline projection fixture',
    before: '  CREATE TABLE events(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,title TEXT NOT NULL,start_at TEXT NOT NULL);',
    after: `  CREATE TABLE events(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,title TEXT NOT NULL,start_at TEXT NOT NULL);
  CREATE VIEW governed_timeline_events AS SELECT * FROM events;`
  }]);
}

update('apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts', [{
  label: 'non-event governed automation source',
  before: `    database.prepare(\`
      INSERT INTO events(
        id,family_id,kind,title,start_at,visibility,participant_person_ids,
        attachment_count,ai_processing_allowed,recurrence,reminder_days,created_at
      ) VALUES('event-due','family-main','important_day','Yönetişimli kaynak',
        '2026-08-09T03:00:00.000Z','family','[]',0,0,'none','[7,1]',?)
    \`).run(NOW);
    database.prepare(\`
      INSERT INTO automation_rules(id,title,source_type,days_before,enabled,created_at)
      VALUES('rule-due','Otomatik görev','important_day',30,1,?)
    \`).run(NOW);`,
  after: `    database.prepare(\`
      INSERT INTO medication_plans(
        id,family_id,owner_person_id,name,dosage,schedule,provider,
        starts_at,ends_at,privacy,notes,created_at
      ) VALUES('plan-due','family-main',?,'Yönetişimli ilaç kaynağı','1 doz','daily',NULL,
        '2026-08-09T03:00:00.000Z',NULL,'private',NULL,?)
    \`).run(account.person_id, NOW);
    database.prepare(\`
      INSERT INTO automation_rules(id,title,source_type,days_before,enabled,created_at)
      VALUES('rule-due','Otomatik görev','medication_plan',30,1,?)
    \`).run(NOW);`
}]);

update('apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts', [
  {
    label: 'timeline runner imports',
    before: `  RepositoryBackedTimelineApplicationUnitOfWork,
  RepositoryBackedTimelineQueryPort,
  type RepositoryBackedTimelineApplicationDependencies`,
    after: `  RepositoryBackedTimelineApplicationUnitOfWork,
  RepositoryBackedTimelinePolicyTransactionRunner,
  RepositoryBackedTimelineQueryPort,
  type RepositoryBackedTimelineApplicationDependencies`
  },
  {
    label: 'serializable fake receipt',
    before: '  policyAuthorization: {} as never',
    after: "  policyAuthorization: { receiptRecord: { receipt: { fixture: 'location-cross-surface' } } } as never"
  },
  {
    label: 'governed timeline runner fixture',
    before: `} as unknown as RepositoryBackedLocationPolicyTransactionRunner);

describe('30-Z location cross-surface privacy', () => {`,
    after: `} as unknown as RepositoryBackedLocationPolicyTransactionRunner);

const fakeTimelineRunner = (transaction: unknown): RepositoryBackedTimelinePolicyTransactionRunner => ({
  execute: async <T>(_context: unknown, _intent: unknown, operation: (scope: {
    readonly repository: PolicyAuthorizedRepositoryExecutionContext;
    readonly occurredAt: typeof NOW;
    readonly authorization: never;
  }) => Result<T, AppError>): Promise<Result<T, AppError>> => {
    const repository = fakeGovernedContext(transaction);
    return operation({ repository, occurredAt: NOW, authorization: repository.policyAuthorization as never });
  }
} as unknown as RepositoryBackedTimelinePolicyTransactionRunner);

describe('30-Z location cross-surface privacy', () => {`
  },
  {
    label: 'timeline runner instance',
    before: '    const runner = fakeRunner(transaction, state);',
    after: `    const runner = fakeRunner(transaction, state);
    const timelineRunner = fakeTimelineRunner(transaction);`
  },
  {
    label: 'governed timeline query fixture',
    before: '    const query = new RepositoryBackedTimelineQueryPort(dependencies);',
    after: '    const query = new RepositoryBackedTimelineQueryPort(dependencies, timelineRunner);'
  },
  {
    label: 'governed timeline write fixture',
    before: '    const create = new CreateImportantDayUseCase(new RepositoryBackedTimelineApplicationUnitOfWork(dependencies));',
    after: '    const create = new CreateImportantDayUseCase(new RepositoryBackedTimelineApplicationUnitOfWork(dependencies, timelineRunner));'
  },
  {
    label: 'policy context expectation',
    before: "    expect(eventWriteContexts.at(-1)).not.toHaveProperty('policyAuthorization');",
    after: "    expect(eventWriteContexts.at(-1)).toHaveProperty('policyAuthorization');"
  }
]);

console.log('PPK-002 governed regression fixtures updated');
