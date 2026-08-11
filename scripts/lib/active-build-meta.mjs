import { readFileSync } from 'node:fs';

const metadata = JSON.parse(
  readFileSync(new URL('../../repository-metadata.json', import.meta.url), 'utf8')
);
const milestones = Array.isArray(metadata.milestones)
  ? metadata.milestones.filter((value) => typeof value === 'string')
  : [];

export const ACTIVE_BUILD_META = Object.freeze({
  applicationVersion: String(metadata.applicationVersion),
  packageVersion: String(metadata.packageVersion),
  build: Number(metadata.versionSequence),
  milestone: milestones.at(-1) ?? `Bronze RC2 Build ${metadata.versionSequence}`
});
