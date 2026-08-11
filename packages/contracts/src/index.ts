
import type { AppError, CorrelationId, Result } from '@ppt/core';

export const IPC_CONTRACT_VERSION = 1 as const;
export type IpcContractVersion = typeof IPC_CONTRACT_VERSION;

export interface IpcRequestContext {
  readonly contractVersion: IpcContractVersion;
  readonly requestedAt: string;
}

export interface IpcResponse<TValue> {
  readonly contractVersion: IpcContractVersion;
  readonly correlationId: CorrelationId;
  readonly result: Result<TValue, AppError>;
}

export const createIpcResponse = <TValue>(
  correlationId: CorrelationId,
  result: Result<TValue, AppError>
): IpcResponse<TValue> => ({
  contractVersion: IPC_CONTRACT_VERSION,
  correlationId,
  result
});

export * from './persistence.js';
