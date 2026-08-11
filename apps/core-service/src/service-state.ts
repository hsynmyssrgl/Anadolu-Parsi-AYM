import type { PlatformPolicyPackage } from '@ppt/platform-policy';

export type CoreServiceLifecycle = 'starting' | 'ready' | 'degraded' | 'stopping' | 'stopped';
export type ClusterRole = 'standalone' | 'leader' | 'follower' | 'witness' | 'backup_only' | 'maintenance';

export interface CoreServiceHealthSnapshot {
  readonly lifecycle: CoreServiceLifecycle;
  readonly role: ClusterRole;
  readonly writable: boolean;
  readonly safeMode: boolean;
  readonly writeFenceEpoch: number;
  readonly policyVersion: string;
  readonly policyPackage: PlatformPolicyPackage;
  readonly startedAt: string;
  readonly observedAt: string;
  readonly reasons: readonly string[];
}
