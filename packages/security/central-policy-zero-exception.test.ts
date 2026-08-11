import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CentralAuthorizationService,
  DIRECT_ROLE_AUTHORIZATION_EXCEPTIONS,
  authorizationRoleMatches,
  isAuthorizationRole
} from './src/index.js';

const NOW = '2026-08-11T14:00:00.000Z';
const service = new CentralAuthorizationService();
const request = (role: 'family_admin' | 'adult_member' = 'adult_member') => ({
  accountId: 'account-32-f', role, action: 'administer' as const,
  resourceType: 'family_membership', resourceId: '*', occurredAt: NOW,
  purpose: 'administration' as const
});

const productionTypeScript = (): readonly string[] => {
  const roots = ['apps', 'packages'];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && path.endsWith('.ts') && !path.endsWith('.test.ts')) files.push(path);
    }
  };
  for (const root of roots) visit(root);
  return files;
};

describe('32-F PPK-010 centralized policy with zero direct-role exceptions', () => {
  it('keeps the direct-role authorization exception registry empty', () => {
    expect(DIRECT_ROLE_AUTHORIZATION_EXCEPTIONS).toEqual([]);
  });

  it('recognizes only roles in the central policy vocabulary', () => {
    expect(isAuthorizationRole('family_admin')).toBe(true);
    expect(isAuthorizationRole('root')).toBe(false);
  });

  it('allows family administration through the central policy', () => {
    expect(service.authorize(request('family_admin'))).toMatchObject({ allowed: true, reason: 'role' });
  });

  it('denies adult administration through the same central policy', () => {
    expect(service.authorize(request('adult_member'))).toMatchObject({ allowed: false, reason: 'no_policy' });
  });

  it('keeps explicit deny above an administrative role', () => {
    expect(service.authorize({
      ...request('family_admin'), grants: [{
        id: 'deny-32-f', subjectAccountId: 'account-32-f', resourceType: 'family_membership',
        resourceId: '*', actions: ['administer'], effect: 'deny', purpose: 'administration',
        startsAt: '2026-08-11T13:00:00.000Z'
      }]
    })).toMatchObject({ allowed: false, reason: 'explicit_deny', matchedGrantId: 'deny-32-f' });
  });

  it('uses the central role vocabulary for identity consistency without granting access', () => {
    expect(authorizationRoleMatches('adult_member', 'adult_member')).toBe(true);
    expect(authorizationRoleMatches('adult_member', 'family_admin')).toBe(false);
    expect(authorizationRoleMatches('root', 'root')).toBe(false);
  });

  it('finds zero direct role allow or deny comparisons in production code', () => {
    const excluded = new Set([
      'packages/security/src/authorization.ts',
      'apps/core-service/src/core-service-runtime.ts'
    ]);
    const pattern = /new Set<[^>]*Role|roles\.some\([^\n]*\.has|roles\.includes\(|(?:\.|\b)role\s*(?:===|!==)/u;
    const findings = productionTypeScript()
      .map((path) => ({ path: relative(process.cwd(), path).replaceAll('\\', '/'), source: readFileSync(path, 'utf8') }))
      .filter(({ path, source }) => !excluded.has(path) && pattern.test(source))
      .map(({ path }) => path);
    expect(findings).toEqual([]);
  });

  it('routes administration adapters through CentralAuthorizationService', () => {
    for (const path of [
      'apps/desktop/src/main/data-repair-application-adapter.ts',
      'apps/desktop/src/main/person-lifecycle-application-adapter.ts',
      'apps/desktop/src/main/household-membership-application-adapter.ts'
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain('new CentralAuthorizationService()');
      expect(source).not.toMatch(/new Set<[^>]*AuthorizationRole/u);
    }
  });

  it('routes health and life row visibility through central policy calls', () => {
    expect(readFileSync('packages/repositories/src/health-repository.ts', 'utf8')).toContain('centralHealthAuthorization.authorize');
    expect(readFileSync('packages/repositories/src/life-repository.ts', 'utf8')).toContain('centralLifeAuthorization.authorize');
  });

  it('keeps every protected Desktop operation behind the Core-evaluated universal PEP', () => {
    const source = readFileSync('apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts', 'utf8');
    expect(source).toContain("dependencies.authorizationProvider?.decisionAuthority !== 'windows-core-service'");
    expect(source).toContain('runAuthorized(authorization, input.operation)');
  });
});
