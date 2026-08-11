import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 mutation-read repair must run from ${expectedRoot}; received ${root}`);
}
const replaceOnce = (relativePath, before, after) => {
  const path = resolve(root, relativePath);
  const source = readFileSync(path, 'utf8');
  if (source.includes(after)) return false;
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error(`${relativePath}: mutation-read anchor is missing or ambiguous`);
  }
  writeFileSync(path, source.replace(before, after), 'utf8');
  return true;
};

const changed = [];
if (replaceOnce(
  'packages/repository-contracts/src/timeline-repository.ts',
  `  findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null>;`,
  `  findForMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null>;
  findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null>;`
)) changed.push('packages/repository-contracts/src/timeline-repository.ts');

if (replaceOnce(
  'packages/repositories/src/timeline-repository.ts',
  `  public findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null> {`,
  `  public findForMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null> {
    const familyId = asFamilyId(context.policyAuthorization.resourceFamilyId);
    assertPolicyAuthorizedRepositoryContext(context, {
      resourceType: 'event', resourceId: eventId, action: 'update', capability: 'family.write',
      correlationId: context.correlationId, resourceFamilyId: familyId
    });
    assertTimelineSubject(context, familyId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(
        \`SELECT \${eventColumns} FROM governed_timeline_events WHERE id=? AND family_id=?\`
      ).get(eventId, familyId) as Record<string, unknown> | undefined;
      return row ? mapEvent(row) : null;
    });
  }

  public findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    eventId: EventId
  ): RepositoryResult<TimelineEventRecord | null> {`
)) changed.push('packages/repositories/src/timeline-repository.ts');

if (replaceOnce(
  'apps/desktop/src/main/timeline-application-adapter.ts',
  '    return this.dependencies.timelineRepository.findById(this.repository, eventId);',
  '    return this.dependencies.timelineRepository.findForMutation(this.repository, eventId);'
)) changed.push('apps/desktop/src/main/timeline-application-adapter.ts');

console.log(`PPK-002 exact update-authorized mutation read applied (${changed.length} files changed).`);
