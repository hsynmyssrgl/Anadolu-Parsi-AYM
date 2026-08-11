import type { AppendAuditInput, AuditRepositoryPort } from '@ppt/repository-contracts';
import { computeAuditEntryHash, computeAuditEntryHashV1, verifyAuditChain, type AuditChainEntry, type AuditChainVerification } from '@ppt/core';
import type { IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';

const mapAuditEntry = (row: Record<string, unknown>): AuditChainEntry => ({
  id: String(row.id),
  action: String(row.action),
  resourceType: String(row.resource_type),
  resourceId: String(row.resource_id),
  occurredAt: String(row.occurred_at),
  actorId: row.actor_id ? String(row.actor_id) : '',
  previousHash: String(row.prev_hash ?? ''),
  entryHash: String(row.entry_hash ?? ''),
  sequenceNo: Number(row.sequence_no ?? 0),
  hashVersion: Number(row.hash_version ?? 1) === 2 ? 2 : 1,
  ...(row.correlation_id ? { correlationId: String(row.correlation_id) } : {})
});

export class SqliteAuditRepository extends SqliteRepository implements AuditRepositoryPort {
  public append(context: RepositoryExecutionContext, input: AppendAuditInput): RepositoryResult<string> {
    const policy = platformPolicyPersistenceBinding(context, input.resourceType, input.resourceId);
    return this.execute(context, () => {
      const previous = this.database(context).prepare(`
        SELECT sequence_no,entry_hash FROM audit_log ORDER BY sequence_no DESC,rowid DESC LIMIT 1
      `).get() as { readonly sequence_no?: unknown; readonly entry_hash?: unknown } | undefined;
      const sequenceNo = Number(previous?.sequence_no ?? 0) + 1;
      const previousHash = previous?.entry_hash ? String(previous.entry_hash) : 'GENESIS';
      const hashVersion = 2 as const;
      const entryHash = computeAuditEntryHash({
        id: input.id,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        occurredAt: input.occurredAt,
        actorId: input.actorId,
        previousHash,
        sequenceNo,
        hashVersion,
        correlationId: context.correlationId
      });
      this.database(context).prepare(`
        INSERT INTO audit_log(
          id,action,resource_type,resource_id,occurred_at,actor_id,prev_hash,entry_hash,sequence_no,hash_version,correlation_id,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        input.id,
        input.action,
        input.resourceType,
        input.resourceId,
        input.occurredAt,
        input.actorId,
        previousHash,
        entryHash,
        sequenceNo,
        hashVersion,
        context.correlationId,
        policy?.receiptHash ?? null,
        policy?.receiptVersion ?? null,
        policy?.nonce ?? null,
        policy?.resourceType ?? null,
        policy?.resourceId ?? null,
        policy?.action ?? null,
        policy?.capability ?? null
      );
      return entryHash;
    });
  }

  public backfillMissingChain(context: RepositoryExecutionContext): RepositoryResult<number> {
    return this.execute(context, () => {
      const rows = this.database(context).prepare(`
        SELECT rowid,id,action,resource_type,resource_id,occurred_at,actor_id,prev_hash,entry_hash,sequence_no,hash_version
        FROM audit_log ORDER BY rowid ASC
      `).all() as Array<Record<string, unknown>>;
      if (!rows.length || rows.some((row) => Boolean(row.entry_hash))) return 0;
      let previousHash = 'GENESIS';
      let updated = 0;
      const update = this.database(context).prepare(`
        UPDATE audit_log SET actor_id=?,prev_hash=?,entry_hash=?,sequence_no=?,hash_version=1 WHERE rowid=?
      `);
      for (const row of rows) {
        const actorId = row.actor_id ? String(row.actor_id) : '';
        const sequenceNo = Number(row.sequence_no ?? row.rowid);
        const entryHash = computeAuditEntryHashV1({
          id: String(row.id),
          action: String(row.action),
          resourceType: String(row.resource_type),
          resourceId: String(row.resource_id),
          occurredAt: String(row.occurred_at),
          actorId,
          previousHash
        });
        update.run(actorId || null, previousHash, entryHash, sequenceNo, Number(row.rowid));
        previousHash = entryHash;
        updated += 1;
      }
      return updated;
    });
  }

  public latestOccurredAt(context: RepositoryExecutionContext): RepositoryResult<IsoDateTime | undefined> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(
        'SELECT occurred_at FROM audit_log ORDER BY occurred_at DESC LIMIT 1'
      ).get() as { readonly occurred_at?: unknown } | undefined;
      return row?.occurred_at ? String(row.occurred_at) as IsoDateTime : undefined;
    });
  }

  public listEntries(context: RepositoryExecutionContext, limit = 5000): RepositoryResult<readonly AuditChainEntry[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT id,action,resource_type,resource_id,occurred_at,actor_id,prev_hash,entry_hash,sequence_no,hash_version,correlation_id
      FROM audit_log ORDER BY sequence_no ASC,rowid ASC LIMIT ?
    `).all(Math.max(1, Math.min(limit, 100_000))) as Array<Record<string, unknown>>).map(mapAuditEntry));
  }

  public listEntriesDescending(context: RepositoryExecutionContext, limit = 500): RepositoryResult<readonly AuditChainEntry[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT id,action,resource_type,resource_id,occurred_at,actor_id,prev_hash,entry_hash,sequence_no,hash_version,correlation_id
      FROM audit_log ORDER BY sequence_no DESC,rowid DESC LIMIT ?
    `).all(Math.max(1, Math.min(limit, 500))) as Array<Record<string, unknown>>).map(mapAuditEntry));
  }

  public verify(context: RepositoryExecutionContext): RepositoryResult<AuditChainVerification> {
    const entries = this.listEntries(context, 100_000);
    return entries.ok ? { ok: true, value: verifyAuditChain(entries.value) } : entries;
  }
}
