import { describe, expect, it, vi } from 'vitest';
import { prepareIpcPolicyOperation } from '../src/main/ipc-runtime.js';

describe('IPC prepared policy operation ordering', () => {
  it('completes interactive preparation before exposing the protected operation', async () => {
    const order: string[] = [];
    const handler = vi.fn(() => 'unexpected');
    const operation = await prepareIpcPolicyOperation({
      event: {} as never,
      args: ['secret'] as [string],
      handler,
      preparer: async (_event, value) => {
        order.push(`selection:${value}`);
        return () => {
          order.push('authorized-mutation');
          return 'completed';
        };
      }
    });

    expect(order).toEqual(['selection:secret']);
    expect(handler).not.toHaveBeenCalled();
    expect(await operation()).toBe('completed');
    expect(order).toEqual(['selection:secret', 'authorized-mutation']);
  });

  it('keeps ordinary handlers on the same deferred operation boundary', async () => {
    const handler = vi.fn((_event: never, value: number) => value + 1);
    const operation = await prepareIpcPolicyOperation({
      event: {} as never,
      args: [41] as [number],
      handler
    });

    expect(handler).not.toHaveBeenCalled();
    expect(await operation()).toBe(42);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('fails closed when a preparer does not return an operation', async () => {
    await expect(prepareIpcPolicyOperation({
      event: {} as never,
      args: [] as [],
      handler: () => 'unused',
      preparer: (async () => undefined) as never
    })).rejects.toThrow('IPC_POLICY_OPERATION_PREPARATION_INVALID');
  });
});
