import { generateSourceManifest } from './lib/source-manifest.mjs';

const { manifest, sumsEntries } = await generateSourceManifest('.');
console.log(`manifest.json oluşturuldu: ${manifest.fileCount} dosya`);
console.log(`SHA256SUMS.txt oluşturuldu: ${sumsEntries.length} giriş`);
