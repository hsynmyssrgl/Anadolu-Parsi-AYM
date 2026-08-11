import type { DerivedDataPolicyBinding } from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

/**
 * Durable metadata-only lineage boundary for governed derived data.
 *
 * Implementations must not persist a derived payload, file path, vault path,
 * OCR text or secret through this port. A write is valid only while the
 * caller owns an active policy-authorized repository transaction.
 */
export interface DerivedDataPolicyRepositoryPort {
  insertSealed(
    context: PolicyAuthorizedRepositoryExecutionContext,
    binding: DerivedDataPolicyBinding
  ): RepositoryResult<void>;

  findByHash(
    context: PolicyAuthorizedRepositoryExecutionContext,
    bindingHash: string
  ): RepositoryResult<DerivedDataPolicyBinding | undefined>;

  listBindingHashesBySource(
    context: PolicyAuthorizedRepositoryExecutionContext,
    sourceKey: string
  ): RepositoryResult<readonly string[]>;
}

export type { DerivedDataPolicyBinding };
