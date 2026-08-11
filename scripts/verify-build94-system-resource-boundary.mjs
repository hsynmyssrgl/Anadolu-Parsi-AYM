import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const useCases = read('packages/application/src/system-resource-snapshot-use-cases.ts');
const adapter = read('apps/desktop/src/main/system-resource-snapshot-application-adapter.ts');
const appIndex = read('packages/application/src/index.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const method = (signature) => {
  const start = dataStore.indexOf(signature);
  if (start < 0) return '';
  const nextPublic = dataStore.indexOf('\n  public ', start + signature.length);
  const nextPrivate = dataStore.indexOf('\n  #', start + signature.length);
  const candidates = [nextPublic, nextPrivate].filter((value) => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : dataStore.length;
  return dataStore.slice(start, end);
};

const systemHealth = method('  public getSystemHealth(');
const adaptive = method('  public getAdaptiveResourceState(');
const performance = method('  public capturePerformanceSample(');
const forbiddenTelemetry = ['totalmem(', 'freemem(', 'loadavg(', 'cpus(', 'statSync(', 'readdirSync(', 'existsSync('];

const checks = [
  [
    'system resource application port and view exist',
    useCases.includes('export interface SystemResourceSnapshotView')
      && useCases.includes('export interface SystemResourceSnapshotPort')
      && useCases.includes('inspect(')
  ],
  [
    'system resource use case exists and is exported',
    useCases.includes('export class InspectSystemResourceSnapshotUseCase')
      && appIndex.includes("export * from './system-resource-snapshot-use-cases.js';")
  ],
  [
    'node adapter owns host and storage measurements',
    adapter.includes('export class NodeSystemResourceSnapshotPort')
      && adapter.includes("from 'node:os'")
      && adapter.includes("from 'node:fs'")
      && adapter.includes('loadavg()[0]')
      && adapter.includes('totalmem()')
      && adapter.includes('freemem()')
      && adapter.includes('statSync(input.databasePath).size')
      && adapter.includes('readdirSync(input.archivePath)')
  ],
  [
    'datastore constructs and centralizes resource snapshot delegation',
    dataStore.includes('new InspectSystemResourceSnapshotUseCase(new NodeSystemResourceSnapshotPort())')
      && dataStore.includes('#systemResourceSnapshot(prefix: string)')
      && dataStore.includes('#inspectSystemResourceSnapshotUseCase.execute')
  ],
  [
    'system health delegates measurements while preserving warning policy',
    systemHealth.includes("#systemResourceSnapshot('system-health-resources')")
      && systemHealth.includes('memoryUsagePercent>=90')
      && systemHealth.includes('databaseBytes>2_000_000_000')
      && systemHealth.includes('#inspectDatabaseRuntimeHealthUseCase.execute')
      && forbiddenTelemetry.every((token) => !systemHealth.includes(token))
  ],
  [
    'adaptive resource state delegates measurements and preserves scheduling policy',
    adaptive.includes("#systemResourceSnapshot('adaptive-resource-state')")
      && adaptive.includes('memoryUsagePercent>=85')
      && adaptive.includes('cpuLoadPercent>=85')
      && adaptive.includes("maxConcurrentJobs:pressured?1:profile==='high'?4")
      && forbiddenTelemetry.every((token) => !adaptive.includes(token))
  ],
  [
    'performance sampling delegates measurements and preserves persisted fields',
    performance.includes("#systemResourceSnapshot('performance-sample-resources')")
      && performance.includes('cpuLoadPercent:resources.cpuLoadPercent')
      && performance.includes('memoryUsagePercent:resources.memoryUsagePercent')
      && performance.includes('databaseBytes:resources.databaseBytes')
      && performance.includes('archiveBytes:resources.archiveBytes')
      && performance.includes('#recordPerformanceSampleUseCase.execute')
      && forbiddenTelemetry.every((token) => !performance.includes(token))
  ],
  [
    'datastore no longer imports filesystem telemetry APIs',
    dataStore.includes("import { copyFileSync } from 'node:fs';")
      && !dataStore.includes('statSync')
      && !dataStore.includes('readdirSync')
      && !dataStore.includes('existsSync')
      && !dataStore.includes('totalmem')
      && !dataStore.includes('freemem')
      && !dataStore.includes('loadavg')
      && !dataStore.includes('cpus')
  ],
  [
    'build94 version metadata is aligned',
    metadata.versionSequence === 94
      && metadata.revision === 'BUILD-94'
      && metadata.packageVersion === '24.7.2026-94'
      && appMeta.includes("version: '24.07.2026.94'")
      && appMeta.includes('Build 94')
  ],
  [
    'build94 remains active development',
    existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD94.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD94.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD94.md').includes('Code Freeze: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD94.md').includes('Silver: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
