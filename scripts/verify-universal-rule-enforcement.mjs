import { mkdir, stat, writeFile } from 'node:fs/promises';
import { readJson } from './lib/governance-utils.mjs';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
const registry=await readJson('config/canonical-rule-registry.json');
const enforcement=await readJson('config/rule-enforcement-registry.json');
const active=registry.rules.filter(r=>r.state==='ACTIVE');
check(enforcement.release===registry.effectiveRelease,'enforcement release mismatch');
check(enforcement.canonicalRulesSha256===registry.rulesSha256,'enforcement rule SHA mismatch');
check(enforcement.activeRuleCount===active.length,'active rule count mismatch');
check(enforcement.defaultPolicy==='FAIL_CLOSED_NO_WAIVER','default policy must be FAIL_CLOSED_NO_WAIVER');
const map=new Map();
for(const e of enforcement.entries??[]){
  check(/^PR-\d{3}$/.test(e.ruleId),`invalid enforcement rule id ${e.ruleId}`);
  check(!map.has(e.ruleId),`duplicate enforcement ${e.ruleId}`);map.set(e.ruleId,e);
  check(e.failClosed===true,`${e.ruleId} failClosed must be true`);
  check(e.waiverAllowed===false,`${e.ruleId} waiverAllowed must be false`);
  check(e.skipAllowed===false,`${e.ruleId} skipAllowed must be false`);
  check(e.evidencePolicy==='MISSING_EVIDENCE_NEVER_PASS',`${e.ruleId} evidence policy mismatch`);
  check(e.violationEffect==='BLOCK_CURRENT_REQUIRED_STAGE',`${e.ruleId} violation effect mismatch`);
  check(Array.isArray(e.gateScripts)&&e.gateScripts.length>0,`${e.ruleId} must map to at least one gate`);
  for(const s of e.gateScripts??[]){try{await stat(s);check(true,`${e.ruleId} gate ${s}`)}catch{check(false,`${e.ruleId} missing gate ${s}`)}}
}
for(const r of active)check(map.has(r.id),`${r.id} missing enforcement record`);
for(const id of map.keys())check(active.some(r=>r.id===id),`${id} enforcement exists but rule is not ACTIVE`);
for(const id of ['PR-171','PR-201','PR-202','PR-203','PR-204','PR-205','PR-206','PR-207','PR-208']){
  const e=map.get(id); check(Boolean(e),`${id} hard-lock enforcement missing`);
  if(e)check(e.gateScripts.includes('scripts/verify-universal-rule-enforcement.mjs')||e.gateScripts.includes('scripts/verify-step-checkpoint-gate.mjs'),`${id} must use universal/checkpoint gate`);
}
const pkg=await readJson('package.json');
for(const hook of ['prebuild','pretest','prepack','prepublishOnly'])check(Boolean(pkg.scripts?.[hook]),`${hook} hook missing`);
check(pkg.scripts?.['governance:preflight']==='node scripts/run-governed-preflight.mjs','governance:preflight script mismatch');
check(pkg.scripts?.['governance:postflight']==='node scripts/run-governed-postflight.mjs','governance:postflight script mismatch');
const report={schemaVersion:1,release:registry.effectiveRelease,rulesSha256:registry.rulesSha256,checks,activeRules:active.length,enforcementEntries:map.size,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/universal-rule-enforcement-gate.json',JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`Universal Rule Enforcement: PASS (${checks} checks / ${active.length} ACTIVE rules / no waiver).`);
