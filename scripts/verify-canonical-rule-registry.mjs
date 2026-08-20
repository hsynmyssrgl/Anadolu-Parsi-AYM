import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readJson } from './lib/governance-utils.mjs';

const failures=[]; let checks=0;
const check=(condition,message)=>{checks+=1;if(!condition)failures.push(message)};
const registry=await readJson('config/canonical-rule-registry.json');
const constitution=await readJson('config/project-constitution.json');
const rules=registry.rules ?? [];
const ids=new Set();
for (const rule of rules) {
  check(/^PR-\d{3}$/.test(rule.id),`invalid rule id ${rule.id}`);
  check(!ids.has(rule.id),`duplicate rule ${rule.id}`); ids.add(rule.id);
  check(['ACTIVE','SUPERSEDED'].includes(rule.state),`${rule.id} invalid state ${rule.state}`);
  check(Boolean(rule.text?.trim()),`${rule.id} missing text`);
  if (rule.state==='SUPERSEDED') check(ids.has(rule.replacedBy) || rules.some(x=>x.id===rule.replacedBy),`${rule.id} replacement missing ${rule.replacedBy}`);
}
const core={...registry}; delete core.rulesSha256;
const canonical=JSON.stringify(core,Object.keys(core).sort());
// Use the exact producer algorithm: recursively stable serialization.
const stable=(v)=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`:JSON.stringify(v);
const calculated=createHash('sha256').update(stable(core)).digest('hex');
check(registry.ruleCount===rules.length,`ruleCount ${registry.ruleCount}/${rules.length}`);
check(registry.activeRuleCount===rules.filter(x=>x.state==='ACTIVE').length,'activeRuleCount mismatch');
check(registry.supersededRuleCount===rules.filter(x=>x.state==='SUPERSEDED').length,'supersededRuleCount mismatch');
check(registry.rulesSha256===calculated,`rules hash mismatch ${registry.rulesSha256}/${calculated}`);
check(constitution.canonicalRulesSha256===registry.rulesSha256,'constitution canonical hash mismatch');
check(constitution.canonicalRuleRegistry==='config/canonical-rule-registry.json','constitution registry path mismatch');
for (let n=173;n<=228;n+=1) {
  if (n === 180) check(rules.some(x=>x.id==='PR-180'&&x.state==='SUPERSEDED'&&x.replacedBy==='PR-212'),'PR-180 must be superseded by PR-212');
  else if (n === 220) check(rules.some(x=>x.id==='PR-220'&&x.state==='SUPERSEDED'&&x.replacedBy==='PR-228'),'PR-220 must be superseded by PR-228');
  else check(rules.some(x=>x.id===`PR-${n}`&&x.state==='ACTIVE'),`PR-${n} must be ACTIVE`);
}
check(!('productOwner' in constitution),'active constitution must not contain natural-person owner metadata');
const report={schemaVersion:1,release:registry.effectiveRelease,checks,ruleCount:rules.length,activeRuleCount:rules.filter(x=>x.state==='ACTIVE').length,supersededRuleCount:rules.filter(x=>x.state==='SUPERSEDED').length,rulesSha256:registry.rulesSha256,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir('artifacts/validation',{recursive:true}); await writeFile('artifacts/validation/canonical-rule-registry-gate.json',JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Canonical Rule Registry: PASS (${checks} checks / ${rules.length} rules / ${registry.rulesSha256}).`);
