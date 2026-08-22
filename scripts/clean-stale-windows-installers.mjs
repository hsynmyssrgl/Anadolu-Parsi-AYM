import { resolve } from 'node:path';
import { removeWindowsPackagingArtifacts } from './lib/windows-installer-artifacts.mjs';

const releaseRoot = resolve(import.meta.dirname, '../apps/desktop/release');
const result = await removeWindowsPackagingArtifacts(releaseRoot);

console.log(
  `Eski Windows paketleme artefaktı temizliği: PASS (${result.removedCount} giriş / ${result.removedBytes} bayt silindi).`,
);
for (const artifact of result.removed) console.log(`- ${artifact.name}`);
