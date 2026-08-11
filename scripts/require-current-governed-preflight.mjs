import { computeGovernedSourceFingerprint, readJson } from './lib/governance-utils.mjs';
const registry=await readJson('config/canonical-rule-registry.json');
const acknowledgement=await readJson('config/rule-acknowledgement.json');
const preflight=await readJson('artifacts/validation/governed-preflight.json');
if(acknowledgement.rulesSha256!==registry.rulesSha256||acknowledgement.release!==registry.effectiveRelease)throw new Error('Build blocked: canonical rule acknowledgement is stale');
if(preflight.status!=='PASS'||preflight.rulesSha256!==registry.rulesSha256)throw new Error('Build blocked: GOVERNED_PREFLIGHT is missing, failed or stale');
const current=await computeGovernedSourceFingerprint();
if(preflight.sourceFingerprint?.sha256!==current.sha256||preflight.sourceFingerprint?.fileCount!==current.fileCount)throw new Error('Build blocked: governed source changed after preflight; run governance:preflight again');
console.log(`Governed preflight freshness: PASS (${current.fileCount} files / ${current.sha256}).`);
