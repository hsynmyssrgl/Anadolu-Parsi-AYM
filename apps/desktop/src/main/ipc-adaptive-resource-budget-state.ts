import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

export type IpcAdaptivePersistedMode = 'baseline' | 'guarded' | 'restricted';
export type IpcAdaptivePersistedReason =
  | 'startup-baseline'
  | 'insufficient-samples'
  | 'healthy'
  | 'warning-pressure'
  | 'critical-pressure'
  | 'invalid-telemetry'
  | 'recovery-hold'
  | 'restored'
  | 'restore-rejected'
  | 'persistence-failure'
  | 'manual-reset';

export interface IpcAdaptiveResourceBudgetDurableState {
  readonly schemaVersion: 1;
  readonly mode: IpcAdaptivePersistedMode;
  readonly reason: IpcAdaptivePersistedReason;
  readonly generation: number;
  readonly evaluatedAtMs: number;
  readonly lastRefreshAtMs: number;
  readonly healthySinceMs?: number;
  readonly sampleCount: number;
}

export type IpcAdaptiveResourceBudgetJournalEvent =
  | 'startup'
  | 'evaluation'
  | 'restore'
  | 'restore-rejected'
  | 'manual-clear';

export interface IpcAdaptiveResourceBudgetRestoreResult {
  readonly status: 'MISSING' | 'RESTORED' | 'REJECTED';
  readonly reason: string;
  readonly state?: IpcAdaptiveResourceBudgetDurableState;
  readonly journalSequence?: number;
  readonly journalHeadHash?: string;
  readonly recoveredFromJournal?: boolean;
}

export interface IpcAdaptiveResourceBudgetStatePersistence {
  load(now?: number): IpcAdaptiveResourceBudgetRestoreResult;
  persist(state: IpcAdaptiveResourceBudgetDurableState, event: IpcAdaptiveResourceBudgetJournalEvent, now?: number): void;
}

export interface IpcAdaptiveBudgetQuarantineFileView {
  readonly name: string;
  readonly sizeBytes: number;
  readonly modifiedAt: string;
  readonly sha256: string;
}

export interface IpcAdaptiveBudgetQuarantineRetentionView {
  readonly prunedCount: number;
  readonly remainingCount: number;
  readonly maximumFiles: number;
  readonly maximumAgeMs: number;
}

export interface IpcAdaptiveBudgetDiagnosticBundleResult {
  readonly filePath: string;
  readonly checksumPath: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly generatedAt: string;
  readonly journalEntryCount: number;
  readonly quarantineFileCount: number;
}


interface PersistedStateEnvelope {
  readonly schemaVersion: 1;
  readonly applicationVersion: string;
  readonly policyFingerprint: string;
  readonly persistedAt: string;
  readonly journalSequence: number;
  readonly journalHeadHash: string;
  readonly stateSha256: string;
  readonly state: IpcAdaptiveResourceBudgetDurableState;
}

interface DecisionJournalEntry {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly event: IpcAdaptiveResourceBudgetJournalEvent;
  readonly applicationVersion: string;
  readonly policyFingerprint: string;
  readonly previousHash: string;
  readonly compactedThroughHash?: string;
  readonly stateSha256: string;
  readonly state: IpcAdaptiveResourceBudgetDurableState;
  readonly entryHash: string;
}

export interface IpcAdaptiveResourceBudgetStateStoreOptions {
  readonly directoryPath: string;
  readonly applicationVersion: string;
  readonly policyFingerprint: string;
  readonly maximumStateAgeMs?: number;
  readonly maximumJournalEntries?: number;
  readonly maximumJournalBytes?: number;
  readonly maximumQuarantineFiles?: number;
  readonly maximumQuarantineAgeMs?: number;
}

const ZERO_HASH = '0'.repeat(64);
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const DEFAULT_MAXIMUM_STATE_AGE_MS = 15 * 60_000;
const DEFAULT_MAXIMUM_JOURNAL_ENTRIES = 512;
const DEFAULT_MAXIMUM_JOURNAL_BYTES = 1_048_576;
const DEFAULT_MAXIMUM_QUARANTINE_FILES = 12;
const DEFAULT_MAXIMUM_QUARANTINE_AGE_MS = 30 * 24 * 60 * 60_000;
const VALID_MODES = new Set<IpcAdaptivePersistedMode>(['baseline', 'guarded', 'restricted']);
const VALID_REASONS = new Set<IpcAdaptivePersistedReason>([
  'startup-baseline',
  'insufficient-samples',
  'healthy',
  'warning-pressure',
  'critical-pressure',
  'invalid-telemetry',
  'recovery-hold',
  'restored',
  'restore-rejected',
  'persistence-failure',
  'manual-reset'
]);
const VALID_EVENTS = new Set<IpcAdaptiveResourceBudgetJournalEvent>([
  'startup',
  'evaluation',
  'restore',
  'restore-rejected',
  'manual-clear'
]);

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
};

const sha256 = (value: unknown): string => createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
const finiteInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;

const validDurableState = (value: unknown): value is IpcAdaptiveResourceBudgetDurableState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<IpcAdaptiveResourceBudgetDurableState>;
  if (state.schemaVersion !== 1 || !VALID_MODES.has(state.mode as IpcAdaptivePersistedMode) || !VALID_REASONS.has(state.reason as IpcAdaptivePersistedReason)) return false;
  if (!finiteInteger(state.generation, 0, 1_000_000)) return false;
  if (!Number.isFinite(state.evaluatedAtMs) || Number(state.evaluatedAtMs) < 0) return false;
  if (!Number.isFinite(state.lastRefreshAtMs)) return false;
  if (state.healthySinceMs !== undefined && (!Number.isFinite(state.healthySinceMs) || Number(state.healthySinceMs) < 0)) return false;
  if (!finiteInteger(state.sampleCount, 0, 1_000_000)) return false;
  return true;
};

const journalPayload = (entry: Omit<DecisionJournalEntry, 'entryHash'>): Omit<DecisionJournalEntry, 'entryHash'> => entry;
const computeEntryHash = (entry: Omit<DecisionJournalEntry, 'entryHash'>): string => sha256(journalPayload(entry));

const writeAtomicJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL üst katmandadır. */ }
    renameSync(temporaryPath, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL üst katmandadır. */ }
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* en iyi çaba */ }
    }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const appendDurableLine = (path: string, line: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
  const descriptor = openSync(path, 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
  try { chmodSync(path, 0o600); } catch { /* Windows ACL üst katmandadır. */ }
};

const writeDurableText = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(temporaryPath, text, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    const descriptor = openSync(temporaryPath, 'r');
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    renameSync(temporaryPath, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL üst katmandadır. */ }
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

export class IpcAdaptiveResourceBudgetStateStore implements IpcAdaptiveResourceBudgetStatePersistence {
  readonly #statePath: string;
  readonly #journalPath: string;
  readonly #quarantineDirectoryPath: string;
  readonly #applicationVersion: string;
  readonly #policyFingerprint: string;
  readonly #maximumStateAgeMs: number;
  readonly #maximumJournalEntries: number;
  readonly #maximumJournalBytes: number;
  readonly #maximumQuarantineFiles: number;
  readonly #maximumQuarantineAgeMs: number;

  public constructor(options: IpcAdaptiveResourceBudgetStateStoreOptions) {
    if (!options.directoryPath || !options.applicationVersion || !HASH_PATTERN.test(options.policyFingerprint)) {
      throw new Error('Adaptif bütçe durum deposu seçenekleri geçersiz.');
    }
    this.#statePath = join(options.directoryPath, 'ipc-adaptive-budget-state.json');
    this.#journalPath = join(options.directoryPath, 'ipc-adaptive-budget-decisions.jsonl');
    this.#quarantineDirectoryPath = join(options.directoryPath, 'quarantine');
    this.#applicationVersion = options.applicationVersion;
    this.#policyFingerprint = options.policyFingerprint;
    this.#maximumStateAgeMs = Math.max(60_000, Math.min(options.maximumStateAgeMs ?? DEFAULT_MAXIMUM_STATE_AGE_MS, 24 * 60 * 60_000));
    this.#maximumJournalEntries = Math.max(16, Math.min(options.maximumJournalEntries ?? DEFAULT_MAXIMUM_JOURNAL_ENTRIES, 4_096));
    this.#maximumJournalBytes = Math.max(65_536, Math.min(options.maximumJournalBytes ?? DEFAULT_MAXIMUM_JOURNAL_BYTES, 16_777_216));
    this.#maximumQuarantineFiles = Math.max(2, Math.min(options.maximumQuarantineFiles ?? DEFAULT_MAXIMUM_QUARANTINE_FILES, 128));
    this.#maximumQuarantineAgeMs = Math.max(24 * 60 * 60_000, Math.min(options.maximumQuarantineAgeMs ?? DEFAULT_MAXIMUM_QUARANTINE_AGE_MS, 365 * 24 * 60 * 60_000));
    this.pruneQuarantine();
  }

  public load(now = Date.now()): IpcAdaptiveResourceBudgetRestoreResult {
    const normalizedNow = Number.isFinite(now) ? Math.max(0, Number(now)) : Date.now();
    if (!existsSync(this.#statePath) && !existsSync(this.#journalPath)) {
      return Object.freeze({ status: 'MISSING', reason: 'STATE_AND_JOURNAL_MISSING' });
    }
    try {
      if (!existsSync(this.#journalPath)) throw new Error('JOURNAL_MISSING');
      const entries = this.#readAndVerifyJournal();
      if (entries.length === 0) throw new Error('JOURNAL_EMPTY');
      const latest = entries.at(-1)!;
      this.#validateCurrentBinding(latest.applicationVersion, latest.policyFingerprint);
      this.#validateFreshness(latest.occurredAt, normalizedNow);

      let recoveredFromJournal = false;
      if (existsSync(this.#statePath)) {
        try {
          const envelope = this.#readStateEnvelope();
          this.#validateCurrentBinding(envelope.applicationVersion, envelope.policyFingerprint);
          this.#validateFreshness(envelope.persistedAt, normalizedNow);
          if (envelope.journalSequence !== latest.sequence || envelope.journalHeadHash !== latest.entryHash) throw new Error('STATE_JOURNAL_HEAD_MISMATCH');
          if (envelope.stateSha256 !== latest.stateSha256 || sha256(envelope.state) !== envelope.stateSha256) throw new Error('STATE_HASH_MISMATCH');
        } catch {
          recoveredFromJournal = true;
          this.#writeStateEnvelope(latest, normalizedNow);
        }
      } else {
        recoveredFromJournal = true;
        this.#writeStateEnvelope(latest, normalizedNow);
      }

      return Object.freeze({
        status: 'RESTORED',
        reason: recoveredFromJournal ? 'JOURNAL_RECOVERY' : 'STATE_AND_JOURNAL_VERIFIED',
        state: latest.state,
        journalSequence: latest.sequence,
        journalHeadHash: latest.entryHash,
        recoveredFromJournal
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'UNKNOWN_RESTORE_ERROR';
      this.#quarantineInvalidFiles(normalizedNow);
      return Object.freeze({ status: 'REJECTED', reason });
    }
  }

  public persist(state: IpcAdaptiveResourceBudgetDurableState, event: IpcAdaptiveResourceBudgetJournalEvent, now = Date.now()): void {
    if (!validDurableState(state) || !VALID_EVENTS.has(event)) throw new Error('Adaptif bütçe kalıcı durum girdisi geçersiz.');
    const normalizedNow = Number.isFinite(now) ? Math.max(0, Number(now)) : Date.now();
    const existing = existsSync(this.#journalPath) ? this.#readAndVerifyJournal() : [];
    const latest = existing.at(-1);
    const shouldCompact = existing.length >= this.#maximumJournalEntries
      || (existsSync(this.#journalPath) && statSync(this.#journalPath).size >= this.#maximumJournalBytes);
    const sequence = (latest?.sequence ?? 0) + 1;
    const previousHash = shouldCompact ? ZERO_HASH : (latest?.entryHash ?? ZERO_HASH);
    const stateSha256 = sha256(state);
    const entryWithoutHash: Omit<DecisionJournalEntry, 'entryHash'> = {
      schemaVersion: 1,
      sequence,
      occurredAt: new Date(normalizedNow).toISOString(),
      event,
      applicationVersion: this.#applicationVersion,
      policyFingerprint: this.#policyFingerprint,
      previousHash,
      ...(shouldCompact && latest ? { compactedThroughHash: latest.entryHash } : {}),
      stateSha256,
      state
    };
    const entry: DecisionJournalEntry = Object.freeze({ ...entryWithoutHash, entryHash: computeEntryHash(entryWithoutHash) });
    if (shouldCompact) writeDurableText(this.#journalPath, `${JSON.stringify(entry)}\n`);
    else appendDurableLine(this.#journalPath, JSON.stringify(entry));
    this.#writeStateEnvelope(entry, normalizedNow);
  }


  public pruneQuarantine(now = Date.now()): IpcAdaptiveBudgetQuarantineRetentionView {
    const normalizedNow = Number.isFinite(now) ? Math.max(0, Number(now)) : Date.now();
    mkdirSync(this.#quarantineDirectoryPath, { recursive: true });
    const candidates = [...this.#listQuarantineFiles()].sort((left, right) => left.modifiedAtMs - right.modifiedAtMs || left.name.localeCompare(right.name));
    const expired = new Set(candidates.filter((item) => normalizedNow - item.modifiedAtMs > this.#maximumQuarantineAgeMs).map((item) => item.path));
    const survivors = candidates.filter((item) => !expired.has(item.path));
    const overflowCount = Math.max(0, survivors.length - this.#maximumQuarantineFiles);
    for (const item of survivors.slice(0, overflowCount)) expired.add(item.path);
    let prunedCount = 0;
    for (const path of expired) {
      try { rmSync(path, { force: true }); prunedCount += 1; } catch { /* Fail-closed retention is retried later. */ }
    }
    return Object.freeze({
      prunedCount,
      remainingCount: this.#listQuarantineFiles().length,
      maximumFiles: this.#maximumQuarantineFiles,
      maximumAgeMs: this.#maximumQuarantineAgeMs
    });
  }

  public exportDiagnosticBundle(destinationPath: string, adaptiveBudget: unknown, now = Date.now()): IpcAdaptiveBudgetDiagnosticBundleResult {
    if (!destinationPath || typeof destinationPath !== 'string') throw new Error('Tanı paketi hedef yolu geçersiz.');
    const normalizedNow = Number.isFinite(now) ? Math.max(0, Number(now)) : Date.now();
    const retention = this.pruneQuarantine(normalizedNow);
    const journalInspection = this.#inspectJournal();
    const stateInspection = this.#inspectState();
    const quarantine = [...this.#listQuarantineFiles()]
      .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs || left.name.localeCompare(right.name))
      .map((item): IpcAdaptiveBudgetQuarantineFileView => Object.freeze({
        name: item.name,
        sizeBytes: item.sizeBytes,
        modifiedAt: new Date(item.modifiedAtMs).toISOString(),
        sha256: item.sha256
      }));
    const generatedAt = new Date(normalizedNow).toISOString();
    const payload = Object.freeze({
      schemaVersion: 1,
      product: 'ParsYuva AYM',
      applicationVersion: this.#applicationVersion,
      policyFingerprint: this.#policyFingerprint,
      generatedAt,
      privacy: Object.freeze({
        containsUserIdentity: false,
        containsSessionOrRequestIdentifiers: false,
        containsIpcArgumentsOrPayloads: false,
        containsAbsoluteRuntimePaths: false
      }),
      adaptiveBudget,
      persistence: Object.freeze({ state: stateInspection, journal: journalInspection }),
      quarantine: Object.freeze({ retention, files: Object.freeze(quarantine) })
    });
    writeAtomicJson(destinationPath, payload);
    const bytes = readFileSync(destinationPath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const checksumPath = `${destinationPath}.sha256`;
    writeDurableText(checksumPath, `${digest}  ${basename(destinationPath)}
`);
    return Object.freeze({
      filePath: destinationPath,
      checksumPath,
      sha256: digest,
      sizeBytes: bytes.length,
      generatedAt,
      journalEntryCount: journalInspection.entryCount,
      quarantineFileCount: quarantine.length
    });
  }

  #inspectState(): Readonly<Record<string, unknown>> {
    if (!existsSync(this.#statePath)) return Object.freeze({ exists: false, valid: false, reason: 'STATE_MISSING' });
    const bytes = readFileSync(this.#statePath);
    try {
      const envelope = this.#readStateEnvelope();
      this.#validateCurrentBinding(envelope.applicationVersion, envelope.policyFingerprint);
      return Object.freeze({
        exists: true,
        valid: true,
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        persistedAt: envelope.persistedAt,
        journalSequence: envelope.journalSequence,
        journalHeadHash: envelope.journalHeadHash,
        mode: envelope.state.mode,
        generation: envelope.state.generation
      });
    } catch (error) {
      return Object.freeze({ exists: true, valid: false, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), reason: error instanceof Error ? error.message : 'STATE_INSPECTION_FAILED' });
    }
  }

  #inspectJournal(): Readonly<{ exists: boolean; valid: boolean; reason?: string; sizeBytes?: number; sha256?: string; entryCount: number; headHash?: string; latestEvent?: string; latestOccurredAt?: string }> {
    if (!existsSync(this.#journalPath)) return Object.freeze({ exists: false, valid: false, reason: 'JOURNAL_MISSING', entryCount: 0 });
    const bytes = readFileSync(this.#journalPath);
    try {
      const entries = this.#readAndVerifyJournal();
      const latest = entries.at(-1);
      return Object.freeze({
        exists: true,
        valid: entries.length > 0,
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        entryCount: entries.length,
        ...(latest ? { headHash: latest.entryHash, latestEvent: latest.event, latestOccurredAt: latest.occurredAt } : { reason: 'JOURNAL_EMPTY' })
      });
    } catch (error) {
      return Object.freeze({ exists: true, valid: false, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), entryCount: 0, reason: error instanceof Error ? error.message : 'JOURNAL_INSPECTION_FAILED' });
    }
  }

  #listQuarantineFiles(): readonly { name: string; path: string; sizeBytes: number; modifiedAtMs: number; sha256: string }[] {
    if (!existsSync(this.#quarantineDirectoryPath)) return [];
    const output: { name: string; path: string; sizeBytes: number; modifiedAtMs: number; sha256: string }[] = [];
    for (const name of readdirSync(this.#quarantineDirectoryPath)) {
      if (!name.startsWith('ipc-adaptive-budget-')) continue;
      const path = join(this.#quarantineDirectoryPath, name);
      try {
        const stats = statSync(path);
        if (!stats.isFile()) continue;
        const bytes = readFileSync(path);
        output.push({ name, path, sizeBytes: stats.size, modifiedAtMs: stats.mtimeMs, sha256: createHash('sha256').update(bytes).digest('hex') });
      } catch { /* Concurrent cleanup is harmless. */ }
    }
    return output;
  }

  #readAndVerifyJournal(): readonly DecisionJournalEntry[] {
    if (statSync(this.#journalPath).size > this.#maximumJournalBytes * 2) throw new Error('JOURNAL_SIZE_EXCEEDED');
    const lines = readFileSync(this.#journalPath, 'utf8').split(/\r?\n/u).filter((line) => line.trim().length > 0);
    if (lines.length > this.#maximumJournalEntries + 1) throw new Error('JOURNAL_ENTRY_LIMIT_EXCEEDED');
    const entries: DecisionJournalEntry[] = [];
    let previousHash = ZERO_HASH;
    let previousSequence = -1;
    for (let index = 0; index < lines.length; index += 1) {
      let parsed: unknown;
      try { parsed = JSON.parse(lines[index]!); } catch { throw new Error('JOURNAL_JSON_INVALID'); }
      if (!parsed || typeof parsed !== 'object') throw new Error('JOURNAL_ENTRY_INVALID');
      const entry = parsed as Partial<DecisionJournalEntry>;
      if (entry.schemaVersion !== 1 || !finiteInteger(entry.sequence, 1, Number.MAX_SAFE_INTEGER)) throw new Error('JOURNAL_SCHEMA_INVALID');
      if (index > 0 && entry.sequence !== previousSequence + 1) throw new Error('JOURNAL_SEQUENCE_INVALID');
      if (typeof entry.occurredAt !== 'string' || !Number.isFinite(Date.parse(entry.occurredAt))) throw new Error('JOURNAL_TIME_INVALID');
      if (!VALID_EVENTS.has(entry.event as IpcAdaptiveResourceBudgetJournalEvent)) throw new Error('JOURNAL_EVENT_INVALID');
      if (typeof entry.applicationVersion !== 'string' || typeof entry.policyFingerprint !== 'string') throw new Error('JOURNAL_BINDING_INVALID');
      if (entry.previousHash !== previousHash) throw new Error('JOURNAL_CHAIN_INVALID');
      if (index === 0 && entry.compactedThroughHash !== undefined && !HASH_PATTERN.test(entry.compactedThroughHash)) throw new Error('JOURNAL_COMPACTION_HASH_INVALID');
      if (index > 0 && entry.compactedThroughHash !== undefined) throw new Error('JOURNAL_COMPACTION_POSITION_INVALID');
      if (!HASH_PATTERN.test(entry.stateSha256 ?? '') || !validDurableState(entry.state)) throw new Error('JOURNAL_STATE_INVALID');
      if (sha256(entry.state) !== entry.stateSha256) throw new Error('JOURNAL_STATE_HASH_INVALID');
      if (!HASH_PATTERN.test(entry.entryHash ?? '')) throw new Error('JOURNAL_ENTRY_HASH_INVALID');
      const { entryHash: ignored, ...withoutHash } = entry as DecisionJournalEntry;
      void ignored;
      if (computeEntryHash(withoutHash) !== entry.entryHash) throw new Error('JOURNAL_ENTRY_HASH_MISMATCH');
      entries.push(entry as DecisionJournalEntry);
      previousHash = entry.entryHash;
      previousSequence = entry.sequence;
    }
    return entries;
  }

  #readStateEnvelope(): PersistedStateEnvelope {
    let parsed: unknown;
    try { parsed = JSON.parse(readFileSync(this.#statePath, 'utf8')); } catch { throw new Error('STATE_JSON_INVALID'); }
    if (!parsed || typeof parsed !== 'object') throw new Error('STATE_ENVELOPE_INVALID');
    const envelope = parsed as Partial<PersistedStateEnvelope>;
    if (envelope.schemaVersion !== 1 || typeof envelope.applicationVersion !== 'string' || typeof envelope.policyFingerprint !== 'string') throw new Error('STATE_SCHEMA_INVALID');
    if (typeof envelope.persistedAt !== 'string' || !Number.isFinite(Date.parse(envelope.persistedAt))) throw new Error('STATE_TIME_INVALID');
    if (!finiteInteger(envelope.journalSequence, 1, Number.MAX_SAFE_INTEGER) || !HASH_PATTERN.test(envelope.journalHeadHash ?? '')) throw new Error('STATE_JOURNAL_BINDING_INVALID');
    if (!HASH_PATTERN.test(envelope.stateSha256 ?? '') || !validDurableState(envelope.state)) throw new Error('STATE_PAYLOAD_INVALID');
    return envelope as PersistedStateEnvelope;
  }

  #writeStateEnvelope(entry: DecisionJournalEntry, now: number): void {
    const envelope: PersistedStateEnvelope = {
      schemaVersion: 1,
      applicationVersion: this.#applicationVersion,
      policyFingerprint: this.#policyFingerprint,
      persistedAt: new Date(now).toISOString(),
      journalSequence: entry.sequence,
      journalHeadHash: entry.entryHash,
      stateSha256: entry.stateSha256,
      state: entry.state
    };
    writeAtomicJson(this.#statePath, envelope);
  }

  #validateCurrentBinding(applicationVersion: string, policyFingerprint: string): void {
    if (applicationVersion !== this.#applicationVersion) throw new Error('APPLICATION_VERSION_MISMATCH');
    if (policyFingerprint !== this.#policyFingerprint) throw new Error('POLICY_FINGERPRINT_MISMATCH');
  }

  #validateFreshness(isoDate: string, now: number): void {
    const value = Date.parse(isoDate);
    if (!Number.isFinite(value) || value > now + 60_000) throw new Error('STATE_TIME_INVALID');
    if (now - value > this.#maximumStateAgeMs) throw new Error('STATE_STALE');
  }

  #quarantineInvalidFiles(now: number): void {
    mkdirSync(this.#quarantineDirectoryPath, { recursive: true });
    const timestamp = new Date(now).toISOString().replace(/[:.]/gu, '-');
    for (const path of [this.#statePath, this.#journalPath]) {
      if (!existsSync(path)) continue;
      const destination = join(this.#quarantineDirectoryPath, `${basename(path)}.rejected-${timestamp}-${randomBytes(4).toString('hex')}`);
      try { renameSync(path, destination); } catch { rmSync(path, { force: true }); }
    }
    this.pruneQuarantine(now);
  }
}
