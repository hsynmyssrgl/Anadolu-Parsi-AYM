import type { ExternalBackupRevocationEndpointView, FetchedExternalBackupEvidenceRevocationListView } from '@ppt/domain';
import {
  NetworkEgressPolicy,
  type NetworkEgressAuthoritativeContext,
  type NetworkEgressPin,
  type NetworkEgressRequest
} from '@ppt/platform-policy';
import {
  fetchExternalBackupEvidenceRevocationList,
  type MutualTlsClientIdentity
} from './secure-revocation-list-fetcher.js';
export type { MutualTlsClientIdentity } from './secure-revocation-list-fetcher.js';

export class NetworkEgressDeniedError extends Error {
  public constructor(public readonly reason: string) {
    super(`Ağ çıkışı merkezi politika tarafından reddedildi: ${reason}`);
    this.name = 'NetworkEgressDeniedError';
  }
}

export interface GovernedRevocationListFetchInput {
  readonly endpoint: ExternalBackupRevocationEndpointView;
  readonly expectedPins: readonly NetworkEgressPin[];
  readonly observedAt: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly mutualTlsIdentity?: MutualTlsClientIdentity;
}
export type SecureRevocationListFetcher = (input: Parameters<typeof fetchExternalBackupEvidenceRevocationList>[0]) => Promise<FetchedExternalBackupEvidenceRevocationListView>;

/**
 * Repository'den gelen allowlist profilini tek yetkili ağ adaptörüne bağlar.
 * Politika reddi halinde adaptör hiçbir koşulda çağrılmaz.
 */
export class GovernedRevocationListFetchUseCase {
  public constructor(
    private readonly policy = new NetworkEgressPolicy(),
    private readonly fetcher: SecureRevocationListFetcher = fetchExternalBackupEvidenceRevocationList
  ) {}

  public execute(input: GovernedRevocationListFetchInput): Promise<FetchedExternalBackupEvidenceRevocationListView> {
    const identityId = input.mutualTlsIdentity?.identityId ?? null;
    const tlsMode = input.mutualTlsIdentity ? 'mtls' as const : 'tls' as const;
    const request: NetworkEgressRequest = {
      schemaVersion: 1,
      endpointId: input.endpoint.id,
      sourceUrl: input.endpoint.sourceUrl,
      method: 'GET',
      purpose: 'external-backup-revocation-list.fetch',
      applicationId: 'windows-desktop',
      tlsMode,
      clientIdentityId: identityId
    };
    const authority: NetworkEgressAuthoritativeContext = {
      schemaVersion: 1,
      endpointId: input.endpoint.id,
      sourceUrl: input.endpoint.sourceUrl,
      endpointStatus: input.endpoint.status,
      allowedMethod: 'GET',
      allowedPurpose: 'external-backup-revocation-list.fetch',
      allowedApplicationId: 'windows-desktop',
      minimumTlsVersion: 'TLSv1.3',
      tlsMode,
      clientIdentityId: identityId,
      expectedPins: input.expectedPins,
      observedAt: input.observedAt
    };
    const decision = this.policy.authorize(request, authority);
    if (!decision.allowed) throw new NetworkEgressDeniedError(decision.reason);
    return this.fetcher({
      endpointId: input.endpoint.id,
      sourceUrl: input.endpoint.sourceUrl,
      expectedPins: input.expectedPins,
      ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }),
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.mutualTlsIdentity ? { mutualTlsIdentity: input.mutualTlsIdentity } : {})
    });
  }
}

const defaultUseCase = new GovernedRevocationListFetchUseCase();

export const fetchGovernedExternalBackupEvidenceRevocationList = (
  input: GovernedRevocationListFetchInput
): Promise<FetchedExternalBackupEvidenceRevocationListView> => defaultUseCase.execute(input);
