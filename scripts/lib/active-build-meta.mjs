import { readFileSync } from 'node:fs';

const metadata = JSON.parse(
  readFileSync(new URL('../../repository-metadata.json', import.meta.url), 'utf8')
);
const milestones = Array.isArray(metadata.milestones)
  ? metadata.milestones.filter((value) => typeof value === 'string')
  : [];
const activeSequence = Number(metadata.monthlySequence ?? metadata.versionSequence);
if (!Number.isInteger(activeSequence) || activeSequence <= 0) {
  throw new Error('Active release metadata does not contain a valid monthly sequence.');
}
const fallbackMilestone = typeof metadata.visibleRelease === 'string' && metadata.visibleRelease.trim().length > 0
  ? metadata.visibleRelease.trim()
  : `${String(metadata.edition ?? 'Bronze')} ${String(metadata.applicationVersion)}`;

export const ACTIVE_BUILD_META = Object.freeze({
  applicationVersion: String(metadata.applicationVersion),
  packageVersion: String(metadata.packageVersion),
  build: activeSequence,
  milestone: milestones.at(-1) ?? fallbackMilestone
});
