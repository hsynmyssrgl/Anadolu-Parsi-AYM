import { describe, expect, it } from 'vitest';
import { END_TO_END_SECURITY_CONTROLS, EndToEndSecurityEvidenceAggregator, type EndToEndSecurityControlId } from '../src/end-to-end-security-evidence-aggregator.js';
const digest = (index: number): string => index.toString(16).padStart(64, '0');
const fill = (aggregator: EndToEndSecurityEvidenceAggregator, order: readonly EndToEndSecurityControlId[] = END_TO_END_SECURITY_CONTROLS): void => {
  for (const controlId of order) { const index = END_TO_END_SECURITY_CONTROLS.indexOf(controlId) + 1; aggregator.record({ controlId, outcome: 'pass', evidenceDigest: digest(index), verifierBound: true }); }
};
describe('31-Q end-to-end security evidence aggregator', () => {
  it('starts immutable, pending, synthetic, and without activation authority', () => {
    const status = new EndToEndSecurityEvidenceAggregator().status();
    expect(status).toMatchObject({ schemaVersion: 1, evidenceClass: 'synthetic-end-to-end-security-aggregation-non-authoritative', observationCount: 0, complete: false, allControlsPass: false, syntheticOnly: true, realSecurityExercisesPerformed: false, independentProcessEvidenceVerified: false, realDataAccessed: false, automaticActivationAllowed: false, productionGateSatisfied: false, productionSubmissionAllowed: false, cutoverAuthorityAttached: false });
    expect(status.controls).toHaveLength(7); expect(status.controls.every((control) => control.status === 'pending' && !control.verifierBound)).toBe(true); expect(Object.isFrozen(status)).toBe(true); expect(Object.isFrozen(status.controls)).toBe(true);
  });
  it('accepts every exact verifier-bound PASS and emits only a non-submittable modeled candidate', () => {
    const aggregator = new EndToEndSecurityEvidenceAggregator(); fill(aggregator); expect(aggregator.status()).toMatchObject({ observationCount: 7, complete: true, allControlsPass: true });
    const candidate = aggregator.evidenceCandidate();
    expect(candidate).toMatchObject({ modeledGate: 'END_TO_END_SECURITY_VALIDATION', controlCount: 7, syntheticOnly: true, realSecurityExercisesPerformed: false, independentProcessEvidenceVerified: false, realDataAccessed: false, automaticActivationAllowed: false, productionGateSatisfied: false, productionSubmissionAllowed: false, cutoverAuthorityAttached: false });
    expect('gateId' in candidate).toBe(false); expect(Object.isFrozen(candidate)).toBe(true);
  });
  it('locks a failed observation and rejects replacement without mutation', () => {
    const aggregator = new EndToEndSecurityEvidenceAggregator(); const failed = aggregator.record({ controlId: 'REPLAY_REJECTION', outcome: 'fail', evidenceDigest: digest(1), verifierBound: true });
    expect(() => aggregator.record({ controlId: 'REPLAY_REJECTION', outcome: 'pass', evidenceDigest: digest(2), verifierBound: true })).toThrowError(expect.objectContaining({ code: 'OBSERVATION_DUPLICATE' }));
    expect(aggregator.status()).toEqual(failed); expect(() => aggregator.evidenceCandidate()).toThrowError(expect.objectContaining({ code: 'AGGREGATION_INCOMPLETE' }));
  });
  it('rejects unknown controls, invalid outcomes, and extra fields without mutation', () => {
    const aggregator = new EndToEndSecurityEvidenceAggregator(); const before = aggregator.status();
    expect(() => aggregator.record({ controlId: 'UNKNOWN', outcome: 'pass', evidenceDigest: digest(1), verifierBound: true })).toThrowError(expect.objectContaining({ code: 'CONTROL_INVALID' }));
    expect(() => aggregator.record({ controlId: 'SECRET_REDACTION', outcome: 'unknown', evidenceDigest: digest(1), verifierBound: true })).toThrowError(expect.objectContaining({ code: 'EVIDENCE_INVALID' }));
    expect(() => aggregator.record({ controlId: 'SECRET_REDACTION', outcome: 'pass', evidenceDigest: digest(1), verifierBound: true, extra: true })).toThrowError(expect.objectContaining({ code: 'OBSERVATION_MALFORMED' }));
    expect(aggregator.status()).toEqual(before);
  });
  it('rejects unbound observations before mutation', () => {
    const aggregator = new EndToEndSecurityEvidenceAggregator(); expect(() => aggregator.record({ controlId: 'LOCAL_ADMIN_AUTHENTICATION', outcome: 'pass', evidenceDigest: digest(1), verifierBound: false })).toThrowError(expect.objectContaining({ code: 'EVIDENCE_UNBOUND' })); expect(aggregator.status().observationCount).toBe(0);
  });
  it('rejects malformed and genesis evidence digests before mutation', () => {
    const aggregator = new EndToEndSecurityEvidenceAggregator();
    expect(() => aggregator.record({ controlId: 'LOCAL_ADMIN_AUTHENTICATION', outcome: 'pass', evidenceDigest: 'invalid', verifierBound: true })).toThrowError(expect.objectContaining({ code: 'EVIDENCE_INVALID' }));
    expect(() => aggregator.record({ controlId: 'LOCAL_ADMIN_AUTHENTICATION', outcome: 'pass', evidenceDigest: '0'.repeat(64), verifierBound: true })).toThrowError(expect.objectContaining({ code: 'EVIDENCE_INVALID' })); expect(aggregator.status().observationCount).toBe(0);
  });
  it('rejects evidence digest reuse across distinct controls', () => {
    const aggregator = new EndToEndSecurityEvidenceAggregator(); aggregator.record({ controlId: 'LOCAL_ADMIN_AUTHENTICATION', outcome: 'pass', evidenceDigest: digest(1), verifierBound: true });
    expect(() => aggregator.record({ controlId: 'PROTOCOL_DEFAULT_DENY', outcome: 'pass', evidenceDigest: digest(1), verifierBound: true })).toThrowError(expect.objectContaining({ code: 'EVIDENCE_REUSED' })); expect(aggregator.status().observationCount).toBe(1);
  });
  it('uses canonical control order so candidate digest is insertion-order independent', () => {
    const forward = new EndToEndSecurityEvidenceAggregator(); const reverse = new EndToEndSecurityEvidenceAggregator(); fill(forward); fill(reverse, [...END_TO_END_SECURITY_CONTROLS].reverse()); expect(reverse.evidenceCandidate().evidenceDigest).toBe(forward.evidenceCandidate().evidenceDigest);
  });
});
