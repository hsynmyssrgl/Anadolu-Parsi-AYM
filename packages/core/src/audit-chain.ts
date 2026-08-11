import { createHash } from 'node:crypto';

export interface AuditChainEntry {
  readonly id: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly previousHash: string;
  readonly entryHash: string;
  readonly sequenceNo: number;
  readonly hashVersion: 1 | 2;
  readonly correlationId?: string;
}

export interface AuditChainVerification {
  readonly valid: boolean;
  readonly checkedEntries: number;
  readonly firstInvalidEntryId?: string;
  readonly headHash: string;
  readonly expectedSequenceNo: number;
}

export const computeAuditEntryHashV1 = (entry: Omit<AuditChainEntry, 'entryHash' | 'sequenceNo' | 'hashVersion' | 'correlationId'>): string =>
  createHash('sha256')
    .update(JSON.stringify([
      entry.id,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.occurredAt,
      entry.actorId,
      entry.previousHash
    ]))
    .digest('hex');

export const computeAuditEntryHashV2 = (entry: Omit<AuditChainEntry, 'entryHash' | 'hashVersion'>): string =>
  createHash('sha256')
    .update(JSON.stringify({
      version: 2,
      sequenceNo: entry.sequenceNo,
      id: entry.id,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      occurredAt: entry.occurredAt,
      actorId: entry.actorId,
      correlationId: entry.correlationId ?? '',
      previousHash: entry.previousHash
    }))
    .digest('hex');

export const computeAuditEntryHash = (entry: Omit<AuditChainEntry, 'entryHash'>): string =>
  entry.hashVersion === 1
    ? computeAuditEntryHashV1(entry)
    : computeAuditEntryHashV2(entry);

export const verifyAuditChain = (entries: readonly AuditChainEntry[]): AuditChainVerification => {
  let previousHash = 'GENESIS';
  let expectedSequenceNo = 1;
  for (const entry of entries) {
    if (entry.sequenceNo !== expectedSequenceNo || entry.previousHash !== previousHash) {
      return {
        valid: false,
        checkedEntries: expectedSequenceNo - 1,
        firstInvalidEntryId: entry.id,
        headHash: previousHash,
        expectedSequenceNo
      };
    }
    const expectedHash = computeAuditEntryHash(entry);
    if (entry.entryHash !== expectedHash) {
      return {
        valid: false,
        checkedEntries: expectedSequenceNo - 1,
        firstInvalidEntryId: entry.id,
        headHash: previousHash,
        expectedSequenceNo
      };
    }
    previousHash = entry.entryHash;
    expectedSequenceNo += 1;
  }
  return {
    valid: true,
    checkedEntries: entries.length,
    headHash: previousHash,
    expectedSequenceNo
  };
};
