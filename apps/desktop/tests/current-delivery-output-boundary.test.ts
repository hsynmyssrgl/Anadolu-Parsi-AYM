import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

type CurrentRelease = {
  channel: 'Bronze' | 'Silver' | 'Gold';
  version: string;
  visibleRelease: string;
  packageVersion: string;
  releaseId: string;
};

type RepositoryMetadata = {
  visibleRelease: string;
  repositoryVersion: string;
  applicationVersion: string;
  packageVersion: string;
  edition: string;
  releaseId: string;
};

type DeliveryBoundary = {
  reportFileName: string;
  userVisibleFileName: string;
  reportRelativePath: string;
  userVisibleRelativePath: string;
  excludedRelativePaths: readonly string[];
};

const resolver = async () => {
  const moduleUrl = pathToFileURL(resolve('scripts/lib/governance-utils.mjs')).href;
  const source = await import(moduleUrl) as {
    resolveCurrentDeliveryOutputBoundary: (release: CurrentRelease, metadata: RepositoryMetadata) => DeliveryBoundary;
  };
  return source.resolveCurrentDeliveryOutputBoundary;
};

const fixture = (channel: CurrentRelease['channel'], version: string, packageVersion: string) => {
  const release: CurrentRelease = {
    channel,
    version,
    visibleRelease: `${channel} ${version}`,
    packageVersion,
    releaseId: `${channel.toLocaleLowerCase('en-US')}-${version.slice(6,10)}-${version.slice(3,5)}-${version.slice(0,2)}-r${version.slice(11)}`
  };
  const metadata: RepositoryMetadata = {
    visibleRelease: release.visibleRelease,
    repositoryVersion: version,
    applicationVersion: version,
    packageVersion,
    edition: channel,
    releaseId: release.releaseId
  };
  return { release, metadata };
};

describe('current delivery output boundary', () => {
  it.each([
    ['Bronze', '22.08.2026.50', '22.8.2026-50'],
    ['Silver', '03.09.2026.1', '3.9.2026-1'],
    ['Gold', '04.10.2026.2', '4.10.2026-2']
  ] as const)('derives exact %s report paths without a second naming rule', async (channel, version, packageVersion) => {
    const resolveBoundary = await resolver();
    const { release, metadata } = fixture(channel, version, packageVersion);
    const boundary = resolveBoundary(release, metadata);
    const suffix = `${channel}_${version}`;
    expect(boundary.reportRelativePath).toBe(`artifacts/reports/DELIVERY_STATUS_${version}.json`);
    expect(boundary.userVisibleRelativePath).toBe(`artifacts/deliveries/ParsYuva_Aile_Yasam_Merkezi_${suffix}.json`);
    expect(boundary.excludedRelativePaths).toEqual([
      boundary.userVisibleRelativePath,
      boundary.reportRelativePath
    ].sort());
  });

  it('fails closed on unsafe paths or release identity drift', async () => {
    const resolveBoundary = await resolver();
    const { release, metadata } = fixture('Bronze', '22.08.2026.50', '22.8.2026-50');
    expect(() => resolveBoundary({ ...release, version: '../22.08.2026.50' }, metadata)).toThrow('Unsafe current release version');
    expect(() => resolveBoundary({ ...release, visibleRelease: 'Silver 22.08.2026.50' }, metadata)).toThrow('Current release visible identity mismatch');
    expect(() => resolveBoundary({ ...release, packageVersion: '' }, { ...metadata, packageVersion: '' })).toThrow('Current release package identity mismatch');
    expect(() => resolveBoundary({ ...release, releaseId: '' }, { ...metadata, releaseId: '' })).toThrow('Current release ID mismatch');
    expect(() => resolveBoundary(release, { ...metadata, applicationVersion: '22.08.2026.49' })).toThrow('Release ledger and repository metadata identity mismatch');
  });
});
