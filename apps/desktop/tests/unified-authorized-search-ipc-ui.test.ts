import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

const occurredAt = '2026-08-15T00:00:00.000Z';
const safeResult = {
  schemaVersion: 1,
  items: [{
    module: 'archive',
    resourceType: 'archive_item',
    resourceId: 'archive-item-33-r',
    title: 'Yetkili belge',
    occurredAt
  }],
  searchedModules: ['family', 'event', 'archive', 'finance', 'health', 'life'],
  truncated: false,
  policyFiltered: true,
  complete: true,
  queryEchoed: false,
  generatedAt: occurredAt
} as const;

describe('33-R unified authorized search IPC and UI', () => {
  it('accepts only bounded exact query, module and limit inputs', () => {
    expect(evaluateIpcIntegrationPolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL, [{
      query: 'Ayşe rapor',
      modules: ['family', 'archive'],
      limit: 25
    }])).toEqual({ accepted: true });
    for (const input of [
      { query: 'x' },
      { query: 'rapor', limit: 26 },
      { query: 'rapor', modules: [] },
      { query: 'rapor', modules: ['archive', 'archive'] },
      { query: 'rapor', modules: ['unknown'] },
      { query: 'rapor', accountId: 'forged' }
    ]) expect(evaluateIpcIntegrationPolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL, [input])).toMatchObject({ accepted: false });
  });

  it('accepts only exact safe results and rejects query echo, owner authority and module/resource mismatch', () => {
    expect(evaluateIpcIntegrationResultPolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL, safeResult))
      .toEqual({ accepted: true });
    for (const forged of [
      { ...safeResult, query: 'Ayşe rapor' },
      { ...safeResult, familyId: 'family-forged' },
      { ...safeResult, complete: false },
      { ...safeResult, items: [{ ...safeResult.items[0], resourceType: 'health_record' }] },
      { ...safeResult, items: [{ ...safeResult.items[0], receipt: 'forged' }] }
    ]) expect(evaluateIpcIntegrationResultPolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL, forged))
      .toMatchObject({ accepted: false });
  });

  it('uses latest-wins cancellation, bounded admission and rate limiting without caching policy-derived results', () => {
    expect(resolveIpcRequestLifecyclePolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL)).toEqual({
      cancellable: true,
      latestWins: true,
      timeoutMs: 30_000
    });
    expect(resolveIpcRequestAdmissionPolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL)).toMatchObject({
      enabled: true,
      maxConcurrentPerChannel: 1,
      queueTimeoutMs: 6_000
    });
    expect(resolveIpcRequestRatePolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL)).toEqual({
      enabled: true,
      maxRequestsPerWindow: 60,
      windowMs: 60_000
    });
    expect(resolveIpcReadSharingPolicy(UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL).enabled).toBe(false);
  });

  it('registers one main handler and one preload method with the exact renderer type', () => {
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const globalTypes = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    expect(main.match(/registerIpcHandler\('unifiedSearch:search'/gu)).toHaveLength(1);
    expect(preload.match(/invoke\('unifiedSearch:search',input\)/gu)).toHaveLength(1);
    expect(preload).toContain('searchUnifiedAuthorizedRecords:(input:UnifiedAuthorizedSearchInput):Promise<UnifiedAuthorizedSearchView>');
    expect(globalTypes).toContain('searchUnifiedAuthorizedRecords(input:UnifiedAuthorizedSearchInput):Promise<UnifiedAuthorizedSearchView>');
  });

  it('keeps search on the existing archive route and presents fail-closed truth', () => {
    const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');
    expect(app.match(/<UnifiedAuthorizedSearchPanel\b/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'unified-search'");
    expect(app).toContain('Aile, olay, belge, finans, sağlık ve yaşam kayıtları');
    expect(app).toContain('Yalnız erişim izniniz olan kayıtlar aranır.');
    expect(app).toContain('Aramanız kaydedilmez');
    expect(app).toContain("searchUnifiedAuthorizedRecords({query,limit:25})");
    expect(styles).toContain('.unified-authorized-search-results');
  });
});
