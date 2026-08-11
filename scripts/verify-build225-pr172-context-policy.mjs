import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { calculateRuleSetHash } from './lib/master-build-ledger.mjs';

const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [ledger, policy, constitution, updater, versioner, validator, decision, adr] = await Promise.all([
  json('config/master-build-ledger.json'),
  json('config/master-build-ledger-policy.json'),
  json('docs/18_PROJECT_CONSTITUTION_V6.json'),
  readFile('scripts/update-master-build-ledger.mjs', 'utf8'),
  readFile('scripts/set-workspace-version.mjs', 'utf8'),
  readFile('scripts/lib/master-build-ledger.mjs', 'utf8'),
  readFile('docs/decisions/DEC-117-pr172-platform-actual-context-hard-stop.md', 'utf8'),
  readFile('docs/adr/ADR-100-platform-actual-conversation-capacity-gate.md', 'utf8')
]);
const rules = ledger.projectRules.versions.at(-1);
const historical = ledger.builds.filter((entry) => entry.build <= 224);
const historicalDigest = createHash('sha256').update(JSON.stringify(historical)).digest('hex');
const results=[];const check=(id,c)=>results.push({id,status:c?'PASS':'FAIL'});
check('v6-rule-version',rules.version==='PROJECT-RULES-2026-08-02-V6');
check('v6-effective-build',rules.effectiveBuild===225);
check('pr172-present-once',rules.rules.filter((r)=>r.id==='PR-172').length===1);
check('rule-count-172',rules.rules.length===172);
check('rule-hash-valid',rules.sha256===calculateRuleSetHash(rules));
check('constitution-v6-bound',constitution.ruleSha256===rules.sha256&&constitution.ruleCount===172&&constitution.effectiveBuild===225);
check('policy-v6-bound',ledger.policyId==='PPT-BUILD-LEDGER-CONTINUITY-V6'&&policy.policyId==='PPT-BUILD-LEDGER-CONTINUITY-V6');
check('platform-actual-policy',policy.rules.conversationCapacityAssessmentMethod==='platform_actual_or_unavailable');
check('estimate-cannot-hard-stop',policy.rules.assistantEstimateCannotTriggerHardStop===true);
check('below-threshold-no-handoff',policy.rules.handoffForbiddenBelowActualHardStop===true);
check('updater-rejects-build225-estimate',updater.includes('Build225+ cannot classify an assistant estimate'));
check('unavailable-is-unmeasured',updater.includes("method: 'platform_actual_unavailable'")&&updater.includes("level: 'UNMEASURED'"));
check('handoff-only-hard-stop',updater.includes("if (level === 'HARD_STOP')"));
check('same-response-handoff-output',updater.includes('console.log(`\\n${prompt}\\n`)'));
check('handoff-file-created',updater.includes('NEW_CHAT_HANDOFF_BUILD${build}.md'));
check('version-start-gates-only-actual',versioner.includes("assessment.method === 'platform_actual'")&&versioner.includes('assessment.actualUsedPercent >= hardStop'));
check('ledger-validates-new-methods',validator.includes("['platform_actual', 'platform_actual_unavailable']"));
check('historical-assistant-estimates-preserved',historical.filter((entry)=>entry.status==='COMPLETED'&&entry.build>=207).every((entry)=>entry.conversationCapacityAssessment?.method==='assistant_estimate'));
check('decision-and-adr-present',decision.includes('DEC-117')&&adr.includes('ADR-100'));
const failures=results.filter(x=>x.status==='FAIL');const report={schemaVersion:1,build:225,status:failures.length?'FAIL':'PASS',checks:results.length,passed:results.length-failures.length,failed:failures.length,ruleSet:{version:rules.version,count:rules.rules.length,sha256:rules.sha256},historicalBuildsThrough224Sha256:historicalDigest,results,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/build225-pr172-context-policy.json',`${JSON.stringify(report,null,2)}\n`);console.log(`Build225 PR-172 actual-context policy: ${report.status} (${report.passed}/${report.checks}).`);if(failures.length)process.exitCode=1;
