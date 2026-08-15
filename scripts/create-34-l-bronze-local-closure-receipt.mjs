import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidencePaths = [
  'artifacts/validation/34-L-bronze-final-local-closure-boundary.json',
  'artifacts/validation/34-L-bronze-final-local-closure-contract.json',
  'artifacts/validation/34-L-bronze-final-local-closure-runtime.json',
  ...['34-G', '34-H', '34-I', '34-J', '34-K'].flatMap((step) => {
    const slugs = {
      '34-G': 'e2ee-file-sharing-remaining-communication-ux',
      '34-H': 'communication-audit-archive-integrity',
      '34-I': 'distributed-core-consensus-tenancy',
      '34-J': 'distributed-clients-operations-disaster-recovery',
      '34-K': 'windows-resilience-universal-ux'
    };
    return ['boundary', 'contract', 'runtime'].map((mode) => `artifacts/validation/${step}-${slugs[step]}-${mode}.json`);
  })
];
const evidence = [];
for (const path of evidencePaths) {
  const bytes = await readFile(resolve(root, path));
  const parsed = JSON.parse(bytes.toString('utf8'));
  if (parsed.status !== 'PASS') throw new Error(`Evidence is not PASS: ${path}`);
  evidence.push({ path, bytes: bytes.length, sha256: sha256(bytes), status: parsed.status,
    countsAsRequirementPass: parsed.countsAsRequirementPass === true });
}
if (evidence.some((item) => item.countsAsRequirementPass)) throw new Error('Local evidence must not grant requirement acceptance.');
const head = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (head.status !== 0) throw new Error(`Cannot resolve source base HEAD: ${head.stderr}`);
const scope = JSON.parse(await readFile(resolve(root, 'config/34-l-bronze-final-drift-deterministic-delivery-closure-scope.json'), 'utf8'));
const receipt = {
  schemaVersion: 1,
  id: `34-L-BRONZE-LOCAL-CLOSURE-${sha256(Buffer.from(JSON.stringify(evidence))).slice(0, 24)}`,
  step: '34-L',
  decision: 'DEC-249',
  status: 'PASS_LOCAL_ONLY',
  sourceBaseHead: head.stdout.trim(),
  finalCommitBinding: 'THIS_RECEIPT_IS_TRACKED_BY_THE_FINAL_DELIVERY_COMMIT',
  evidence,
  evidenceSetSha256: sha256(Buffer.from(JSON.stringify(evidence))),
  localAutomatedEvidenceComplete: true,
  requirementsClosed: false,
  countsAsRequirementPass: false,
  manualEvidence: scope.manualEvidence,
  openRequirements: [
    '33-P independent signed identity evidence and governed acceptance',
    'real OCR and AI/provider integrations',
    'production communication transport, relay and media providers',
    'real multi-node Raft, mTLS, failover and disaster-recovery drills',
    'real Apple clients and remote collaboration',
    'real Windows installer lifecycle and 168-hour soak',
    'independent review and certification evidence'
  ],
  externalClaimsMade: false,
  generatedAt: new Date().toISOString()
};
const target = resolve(root, 'artifacts/validation/34-L-bronze-local-closure-receipt.json');
await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
const bytes = await readFile(target);
await writeFile(`${target}.sha256`, `${sha256(bytes)}  ${basename(target)}\n`, 'ascii');
console.log(JSON.stringify({ status: receipt.status, path: 'artifacts/validation/34-L-bronze-local-closure-receipt.json', sha256: sha256(bytes), requirementsClosed: false }));
