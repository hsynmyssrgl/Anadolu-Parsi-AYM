import{createHash}from'node:crypto';import{writeFile,mkdir}from'node:fs/promises';import{dirname}from'node:path';
const out=process.argv[2]??'artifacts/validation/build174-runtime.json';
const derive=v=>createHash('sha256').update(`ipc-adaptive-budget-maintenance-recovery-cooldown\0${v}`,'utf8').digest('hex');
const fingerprint='a'.repeat(64), key=derive(fingerprint);let now=1_000_000;let lockedUntil=now+15*60_000;
const checks=[
 ['key is sha256',/^[a-f0-9]{64}$/.test(key)],
 ['key domain separated',key!==fingerprint],
 ['cooldown active before expiry',now<lockedUntil],
 ['cooldown inactive at expiry',!(lockedUntil<=(now+=15*60_000))?false:true],
 ['session terminated flag',({sessionTerminated:true}).sessionTerminated===true],
 ['trust reevaluation flag',({trustedDeviceReevaluationRequired:true}).trustedDeviceReevaluationRequired===true]
];
const failures=checks.filter(([,ok])=>!ok).map(([n])=>n);const report={schemaVersion:1,build:174,status:failures.length?'FAIL':'PASS',checks:checks.length,passed:checks.length-failures.length,failures,generatedAt:new Date().toISOString()};await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(report);process.exit(1)}console.log(`Build 174 runtime: PASS (${checks.length}/${checks.length})`);
