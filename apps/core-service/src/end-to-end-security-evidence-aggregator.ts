import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GENESIS_HASH = '0'.repeat(64);
const OBSERVATION_KEYS = Object.freeze(['controlId', 'evidenceDigest', 'outcome', 'verifierBound'] as const);

export const END_TO_END_SECURITY_CONTROLS = Object.freeze([
  'LOCAL_ADMIN_AUTHENTICATION', 'PROTOCOL_DEFAULT_DENY', 'REPLAY_REJECTION', 'JOURNAL_TAMPER_REJECTION',
  'SECRET_REDACTION', 'PERSISTENT_PATH_REDACTION', 'SHUTDOWN_SEALING'
] as const);
export type EndToEndSecurityControlId = typeof END_TO_END_SECURITY_CONTROLS[number];
export interface EndToEndSecurityObservation { readonly controlId: EndToEndSecurityControlId; readonly outcome: 'pass' | 'fail'; readonly evidenceDigest: string; readonly verifierBound: true; }
export interface EndToEndSecurityControlStatus { readonly id: EndToEndSecurityControlId; readonly status: 'pending' | 'pass' | 'fail'; readonly verifierBound: boolean; }
export interface EndToEndSecurityAggregationStatus {
  readonly schemaVersion: 1; readonly evidenceClass: 'synthetic-end-to-end-security-aggregation-non-authoritative';
  readonly observationCount: number; readonly complete: boolean; readonly allControlsPass: boolean; readonly syntheticOnly: true;
  readonly realSecurityExercisesPerformed: false; readonly independentProcessEvidenceVerified: false; readonly realDataAccessed: false;
  readonly automaticActivationAllowed: false; readonly productionGateSatisfied: false; readonly productionSubmissionAllowed: false;
  readonly cutoverAuthorityAttached: false; readonly controls: readonly EndToEndSecurityControlStatus[];
}
export interface EndToEndSecurityEvidenceCandidate {
  readonly schemaVersion: 1; readonly evidenceClass: 'synthetic-end-to-end-security-aggregation-non-authoritative';
  readonly modeledGate: 'END_TO_END_SECURITY_VALIDATION'; readonly evidenceDigest: string; readonly controlCount: 7; readonly syntheticOnly: true;
  readonly realSecurityExercisesPerformed: false; readonly independentProcessEvidenceVerified: false; readonly realDataAccessed: false;
  readonly automaticActivationAllowed: false; readonly productionGateSatisfied: false; readonly productionSubmissionAllowed: false; readonly cutoverAuthorityAttached: false;
}
export type EndToEndSecurityAggregationErrorCode = 'OBSERVATION_MALFORMED' | 'CONTROL_INVALID' | 'OBSERVATION_DUPLICATE' | 'EVIDENCE_INVALID' | 'EVIDENCE_REUSED' | 'EVIDENCE_UNBOUND' | 'AGGREGATION_INCOMPLETE';
export class EndToEndSecurityAggregationError extends Error {
  public readonly code: EndToEndSecurityAggregationErrorCode;
  public constructor(code: EndToEndSecurityAggregationErrorCode, message: string) { super(message); this.name = 'EndToEndSecurityAggregationError'; this.code = code; }
}
const hasExactKeys = (candidate: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(candidate).sort(); const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
};
export class EndToEndSecurityEvidenceAggregator {
  readonly #observations = new Map<EndToEndSecurityControlId, EndToEndSecurityObservation>();
  readonly #seenEvidenceDigests = new Set<string>();
  public record(observation: unknown): EndToEndSecurityAggregationStatus {
    if (!observation || typeof observation !== 'object' || Array.isArray(observation) || !hasExactKeys(observation, OBSERVATION_KEYS)) throw new EndToEndSecurityAggregationError('OBSERVATION_MALFORMED', 'End-to-end security observation shape is invalid');
    const value = observation as Record<string, unknown>;
    if (typeof value.controlId !== 'string' || !END_TO_END_SECURITY_CONTROLS.includes(value.controlId as EndToEndSecurityControlId)) throw new EndToEndSecurityAggregationError('CONTROL_INVALID', 'End-to-end security control is not recognized');
    const controlId = value.controlId as EndToEndSecurityControlId;
    if (this.#observations.has(controlId)) throw new EndToEndSecurityAggregationError('OBSERVATION_DUPLICATE', 'End-to-end security observation cannot be replaced');
    if (value.outcome !== 'pass' && value.outcome !== 'fail') throw new EndToEndSecurityAggregationError('EVIDENCE_INVALID', 'End-to-end security outcome is invalid');
    if (value.verifierBound !== true) throw new EndToEndSecurityAggregationError('EVIDENCE_UNBOUND', 'End-to-end security observation is not verifier-bound');
    if (typeof value.evidenceDigest !== 'string' || !SHA256_PATTERN.test(value.evidenceDigest) || value.evidenceDigest === GENESIS_HASH) throw new EndToEndSecurityAggregationError('EVIDENCE_INVALID', 'End-to-end security evidence digest is invalid');
    if (this.#seenEvidenceDigests.has(value.evidenceDigest)) throw new EndToEndSecurityAggregationError('EVIDENCE_REUSED', 'End-to-end security evidence digest was already used');
    const accepted = Object.freeze({ controlId, outcome: value.outcome, evidenceDigest: value.evidenceDigest, verifierBound: true as const });
    this.#observations.set(controlId, accepted); this.#seenEvidenceDigests.add(accepted.evidenceDigest); return this.status();
  }
  public status(): EndToEndSecurityAggregationStatus {
    const controls = Object.freeze(END_TO_END_SECURITY_CONTROLS.map((id) => { const observation = this.#observations.get(id); return Object.freeze({ id, status: observation?.outcome ?? 'pending', verifierBound: observation?.verifierBound ?? false }); }));
    const complete = controls.every((control) => control.status !== 'pending');
    const allControlsPass = complete && controls.every((control) => control.status === 'pass' && control.verifierBound);
    return Object.freeze({ schemaVersion: 1, evidenceClass: 'synthetic-end-to-end-security-aggregation-non-authoritative', observationCount: this.#observations.size, complete, allControlsPass, syntheticOnly: true, realSecurityExercisesPerformed: false, independentProcessEvidenceVerified: false, realDataAccessed: false, automaticActivationAllowed: false, productionGateSatisfied: false, productionSubmissionAllowed: false, cutoverAuthorityAttached: false, controls });
  }
  public evidenceCandidate(): EndToEndSecurityEvidenceCandidate {
    if (!this.status().allControlsPass) throw new EndToEndSecurityAggregationError('AGGREGATION_INCOMPLETE', 'End-to-end security evidence is incomplete or failed');
    const canonical = END_TO_END_SECURITY_CONTROLS.map((id) => { const observation = this.#observations.get(id); if (!observation) throw new EndToEndSecurityAggregationError('AGGREGATION_INCOMPLETE', 'End-to-end security observation is missing'); return [id, observation.outcome, observation.evidenceDigest, observation.verifierBound] as const; });
    return Object.freeze({ schemaVersion: 1, evidenceClass: 'synthetic-end-to-end-security-aggregation-non-authoritative', modeledGate: 'END_TO_END_SECURITY_VALIDATION', evidenceDigest: createHash('sha256').update(JSON.stringify(['PPT-SYNTHETIC-E2E-SECURITY-AGGREGATION-V1', canonical]), 'utf8').digest('hex'), controlCount: 7, syntheticOnly: true, realSecurityExercisesPerformed: false, independentProcessEvidenceVerified: false, realDataAccessed: false, automaticActivationAllowed: false, productionGateSatisfied: false, productionSubmissionAllowed: false, cutoverAuthorityAttached: false });
  }
}
