import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import type {
  PolicyJournalCheckpointContractPayload,
  PolicyJournalCheckpointContractResult
} from '@ppt/core-service-contracts';

const GENESIS_HASH = '0'.repeat(64);
const SHA256 = /^[0-9a-f]{64}$/u;
const DOMAIN = 'ppt.core-service.policy-journal-monotonic-authority.v1\0';

interface StoredCheckpoint extends PolicyJournalCheckpointContractResult {
  readonly previousCheckpointHash: string;
  readonly mac: string;
}

export interface CoreServicePolicyJournalMonotonicAuthorityOptions {
  readonly filePath: string;
  readonly authorityKey: Uint8Array;
  readonly clock?: () => string;
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('POLICY_JOURNAL_AUTHORITY_VALUE_INVALID');
  return serialized;
};

const checkpointPayload = (value: Omit<StoredCheckpoint, 'mac'>): Omit<StoredCheckpoint, 'mac'> => ({
  schemaVersion: value.schemaVersion,
  authorityEpoch: value.authorityEpoch,
  journalSequence: value.journalSequence,
  journalHeadHash: value.journalHeadHash,
  journalSizeBytes: value.journalSizeBytes,
  previousCheckpointHash: value.previousCheckpointHash,
  checkpointHash: value.checkpointHash,
  acceptedAt: value.acceptedAt
});

const checkpointHash = (value: Omit<StoredCheckpoint, 'checkpointHash' | 'mac'>): string =>
  createHash('sha256').update(`${DOMAIN}checkpoint\0${canonical(value)}`, 'utf8').digest('hex');

const checkpointMac = (key: Buffer, value: Omit<StoredCheckpoint, 'mac'>): string =>
  createHmac('sha256', key).update(`${DOMAIN}mac\0${canonical(value)}`, 'utf8').digest('hex');

const equalHex = (left: string, right: string): boolean =>
  SHA256.test(left) && SHA256.test(right) && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));

const syncDirectory = (path: string): void => {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, 'r');
    fsyncSync(descriptor);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (!(process.platform === 'win32' && ['EINVAL', 'EPERM', 'EBADF'].includes(code))) throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
};

const atomicWrite = (path: string, text: string): void => {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    writeFileSync(descriptor, text, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try { chmodSync(temporary, 0o600); } catch { /* Windows ACL is authoritative. */ }
    renameSync(temporary, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL is authoritative. */ }
    syncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* best effort */ }
    }
    rmSync(temporary, { force: true });
    throw error;
  }
};

export class CoreServicePolicyJournalMonotonicAuthority {
  readonly #filePath: string;
  readonly #key: Buffer;
  readonly #clock: () => string;

  public constructor(options: CoreServicePolicyJournalMonotonicAuthorityOptions) {
    if (!options || typeof options.filePath !== 'string' || !isAbsolute(options.filePath)) {
      throw new Error('POLICY_JOURNAL_AUTHORITY_PATH_INVALID');
    }
    const key = Buffer.from(options.authorityKey);
    if (key.byteLength < 32) throw new Error('POLICY_JOURNAL_AUTHORITY_KEY_INVALID');
    this.#filePath = options.filePath;
    this.#key = createHmac('sha256', key).update(DOMAIN, 'utf8').digest();
    key.fill(0);
    this.#clock = options.clock ?? (() => new Date().toISOString());
  }

  public checkpoint(input: PolicyJournalCheckpointContractPayload): PolicyJournalCheckpointContractResult {
    this.#assertInput(input);
    const current = this.#read();
    if (current) {
      if (input.journalSequence < current.journalSequence) {
        throw new Error('POLICY_JOURNAL_ROLLBACK_DETECTED');
      }
      if (input.journalSequence === current.journalSequence) {
        if (input.journalHeadHash !== current.journalHeadHash || input.journalSizeBytes !== current.journalSizeBytes) {
          throw new Error('POLICY_JOURNAL_EQUIVOCATION_DETECTED');
        }
        return Object.freeze({
          schemaVersion: current.schemaVersion,
          authorityEpoch: current.authorityEpoch,
          journalSequence: current.journalSequence,
          journalHeadHash: current.journalHeadHash,
          journalSizeBytes: current.journalSizeBytes,
          checkpointHash: current.checkpointHash,
          acceptedAt: current.acceptedAt
        });
      }
      if (input.journalSizeBytes <= current.journalSizeBytes) {
        throw new Error('POLICY_JOURNAL_SIZE_REGRESSION_DETECTED');
      }
    } else if (input.journalSequence !== 0 || input.journalHeadHash !== GENESIS_HASH || input.journalSizeBytes !== 0) {
      // A new authority may adopt an already verified journal head exactly once.
    }

    const acceptedAt = this.#clock();
    if (!Number.isFinite(Date.parse(acceptedAt))) throw new Error('POLICY_JOURNAL_AUTHORITY_CLOCK_INVALID');
    const base = Object.freeze({
      schemaVersion: 1 as const,
      authorityEpoch: (current?.authorityEpoch ?? 0) + 1,
      journalSequence: input.journalSequence,
      journalHeadHash: input.journalHeadHash,
      journalSizeBytes: input.journalSizeBytes,
      previousCheckpointHash: current?.checkpointHash ?? GENESIS_HASH,
      acceptedAt
    });
    const hash = checkpointHash(base);
    const unsigned: Omit<StoredCheckpoint, 'mac'> = Object.freeze({ ...base, checkpointHash: hash });
    const stored: StoredCheckpoint = Object.freeze({ ...unsigned, mac: checkpointMac(this.#key, unsigned) });
    atomicWrite(this.#filePath, `${JSON.stringify(stored, null, 2)}\n`);
    const readback = this.#read();
    if (!readback || readback.checkpointHash !== stored.checkpointHash || readback.mac !== stored.mac) {
      throw new Error('POLICY_JOURNAL_AUTHORITY_READBACK_FAILED');
    }
    return Object.freeze({
      schemaVersion: stored.schemaVersion,
      authorityEpoch: stored.authorityEpoch,
      journalSequence: stored.journalSequence,
      journalHeadHash: stored.journalHeadHash,
      journalSizeBytes: stored.journalSizeBytes,
      checkpointHash: stored.checkpointHash,
      acceptedAt: stored.acceptedAt
    });
  }

  public dispose(): void {
    this.#key.fill(0);
  }

  #assertInput(input: PolicyJournalCheckpointContractPayload): void {
    if (
      !input || typeof input !== 'object'
      || !Number.isSafeInteger(input.journalSequence) || input.journalSequence < 0
      || !SHA256.test(input.journalHeadHash)
      || !Number.isSafeInteger(input.journalSizeBytes) || input.journalSizeBytes < 0
      || (input.journalSequence === 0) !== (input.journalHeadHash === GENESIS_HASH)
      || (input.journalSequence === 0) !== (input.journalSizeBytes === 0)
    ) throw new Error('POLICY_JOURNAL_CHECKPOINT_INVALID');
  }

  #read(): StoredCheckpoint | undefined {
    if (!existsSync(this.#filePath)) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.#filePath, 'utf8'));
    } catch (error) {
      throw new Error('POLICY_JOURNAL_AUTHORITY_STATE_INVALID', { cause: error });
    }
    const value = parsed as Partial<StoredCheckpoint> & Record<string, unknown>;
    const exactKeys = [
      'schemaVersion', 'authorityEpoch', 'journalSequence', 'journalHeadHash', 'journalSizeBytes',
      'previousCheckpointHash', 'checkpointHash', 'acceptedAt', 'mac'
    ].sort();
    if (
      !value || typeof value !== 'object'
      || Object.keys(value).sort().some((key, index) => key !== exactKeys[index])
      || Object.keys(value).length !== exactKeys.length
      || value.schemaVersion !== 1
      || !Number.isSafeInteger(value.authorityEpoch) || Number(value.authorityEpoch) < 1
      || !Number.isSafeInteger(value.journalSequence) || Number(value.journalSequence) < 0
      || typeof value.journalHeadHash !== 'string' || !SHA256.test(value.journalHeadHash)
      || !Number.isSafeInteger(value.journalSizeBytes) || Number(value.journalSizeBytes) < 0
      || typeof value.previousCheckpointHash !== 'string' || !SHA256.test(value.previousCheckpointHash)
      || typeof value.checkpointHash !== 'string' || !SHA256.test(value.checkpointHash)
      || typeof value.acceptedAt !== 'string' || !Number.isFinite(Date.parse(value.acceptedAt))
      || typeof value.mac !== 'string' || !SHA256.test(value.mac)
    ) throw new Error('POLICY_JOURNAL_AUTHORITY_STATE_INVALID');
    const stored = value as unknown as StoredCheckpoint;
    const unsigned = checkpointPayload(stored);
    const expectedHash = checkpointHash({
      schemaVersion: stored.schemaVersion,
      authorityEpoch: stored.authorityEpoch,
      journalSequence: stored.journalSequence,
      journalHeadHash: stored.journalHeadHash,
      journalSizeBytes: stored.journalSizeBytes,
      previousCheckpointHash: stored.previousCheckpointHash,
      acceptedAt: stored.acceptedAt
    });
    if (!equalHex(expectedHash, stored.checkpointHash) || !equalHex(checkpointMac(this.#key, unsigned), stored.mac)) {
      throw new Error('POLICY_JOURNAL_AUTHORITY_STATE_TAMPERED');
    }
    return Object.freeze(stored);
  }
}
