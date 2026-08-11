import { describe, expect, it } from 'vitest';
import {
  SyntheticSingleWriterProofHarness,
  type SyntheticSingleWriterTransfer
} from '../src/synthetic-single-writer-proof-harness.js';

const digest = (value: string): string => value.repeat(64);

const coreTransfer = (
  overrides: Partial<SyntheticSingleWriterTransfer> = {}
): SyntheticSingleWriterTransfer => ({
  expectedEpoch: 0,
  from: 'desktop',
  to: 'core-service',
  desktopWritable: false,
  coreServiceWritable: true,
  previousProofDigest: digest('0'),
  proofDigest: digest('1'),
  ...overrides
});

describe('31-N prepared synthetic single-writer proof harness', () => {
  it('starts from an immutable Desktop-only synthetic state with no real authority', () => {
    const snapshot = new SyntheticSingleWriterProofHarness().snapshot();

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      evidenceClass: 'synthetic-single-writer-non-authoritative',
      epoch: 0,
      owner: 'desktop',
      desktopWritable: true,
      coreServiceWritable: false,
      syntheticOnly: true,
      realGateSatisfied: false,
      cutoverAuthorityAttached: false,
      realDataAccessed: false
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('accepts an exact chained transfer while preserving single-writer state', () => {
    const harness = new SyntheticSingleWriterProofHarness();
    const core = harness.transfer(coreTransfer());
    const desktop = harness.transfer({
      expectedEpoch: 1,
      from: 'core-service',
      to: 'desktop',
      desktopWritable: true,
      coreServiceWritable: false,
      previousProofDigest: digest('1'),
      proofDigest: digest('2')
    });

    expect(core).toMatchObject({ epoch: 1, owner: 'core-service', desktopWritable: false, coreServiceWritable: true });
    expect(desktop).toMatchObject({ epoch: 2, owner: 'desktop', desktopWritable: true, coreServiceWritable: false });
    expect(desktop.realGateSatisfied).toBe(false);
  });

  it('rejects stale epochs and stale proof-chain heads without changing state', () => {
    const harness = new SyntheticSingleWriterProofHarness();
    const before = harness.snapshot();

    expect(() => harness.transfer(coreTransfer({ expectedEpoch: 1 })))
      .toThrowError(expect.objectContaining({ code: 'STALE_EPOCH' }));
    expect(() => harness.transfer(coreTransfer({ previousProofDigest: digest('9') })))
      .toThrowError(expect.objectContaining({ code: 'STALE_PROOF' }));
    expect(harness.snapshot()).toBe(before);
  });

  it('rejects both dual-writer and zero-writer proposals without changing state', () => {
    const harness = new SyntheticSingleWriterProofHarness();
    const before = harness.snapshot();

    expect(() => harness.transfer(coreTransfer({ desktopWritable: true, coreServiceWritable: true })))
      .toThrowError(expect.objectContaining({ code: 'DUAL_WRITER' }));
    expect(() => harness.transfer(coreTransfer({ desktopWritable: false, coreServiceWritable: false })))
      .toThrowError(expect.objectContaining({ code: 'DUAL_WRITER' }));
    expect(harness.snapshot()).toBe(before);
  });

  it('rejects owner/flag mismatches, invalid digests, and proof reuse', () => {
    const harness = new SyntheticSingleWriterProofHarness();

    expect(() => harness.transfer(coreTransfer({ desktopWritable: true, coreServiceWritable: false })))
      .toThrowError(expect.objectContaining({ code: 'OWNER_MISMATCH' }));
    expect(() => harness.transfer(coreTransfer({ proofDigest: 'invalid' })))
      .toThrowError(expect.objectContaining({ code: 'PROOF_INVALID' }));
    expect(() => harness.transfer(coreTransfer({ proofDigest: digest('0') })))
      .toThrowError(expect.objectContaining({ code: 'PROOF_INVALID' }));
  });

  it('rejects unknown or extra transfer fields and never partially mutates', () => {
    const harness = new SyntheticSingleWriterProofHarness();
    const before = harness.snapshot();
    const extra = { ...coreTransfer(), unexpected: true };
    const unknownOwner = { ...coreTransfer(), to: 'unknown' };

    expect(() => harness.transfer(extra as SyntheticSingleWriterTransfer))
      .toThrowError(expect.objectContaining({ code: 'MALFORMED_TRANSFER' }));
    expect(() => harness.transfer(unknownOwner as SyntheticSingleWriterTransfer))
      .toThrowError(expect.objectContaining({ code: 'OWNER_MISMATCH' }));
    expect(harness.snapshot()).toBe(before);
  });
});
