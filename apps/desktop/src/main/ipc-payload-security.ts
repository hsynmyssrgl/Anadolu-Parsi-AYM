export type IpcPayloadSecurityFailureReason =
  | 'TOO_MANY_ARGUMENTS'
  | 'DEPTH_LIMIT_EXCEEDED'
  | 'NODE_LIMIT_EXCEEDED'
  | 'BYTE_LIMIT_EXCEEDED'
  | 'STRING_LIMIT_EXCEEDED'
  | 'ARRAY_LENGTH_EXCEEDED'
  | 'OBJECT_KEY_LIMIT_EXCEEDED'
  | 'FORBIDDEN_KEY_REJECTED'
  | 'ACCESSOR_PROPERTY_REJECTED'
  | 'SYMBOL_PROPERTY_REJECTED'
  | 'NON_FINITE_NUMBER_REJECTED'
  | 'UNSUPPORTED_TYPE_REJECTED'
  | 'NON_PLAIN_OBJECT_REJECTED'
  | 'DUPLICATE_REFERENCE_REJECTED';

export interface IpcPayloadSecurityLimits {
  readonly maxArgumentCount: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxEstimatedBytes: number;
  readonly maxStringBytes: number;
  readonly maxArrayLength: number;
  readonly maxObjectKeys: number;
}

export interface IpcPayloadSecurityMetrics {
  readonly argumentCount: number;
  readonly nodeCount: number;
  readonly maximumDepth: number;
  readonly estimatedBytes: number;
}

export type IpcPayloadSecurityDecision =
  | { readonly accepted: true; readonly metrics: IpcPayloadSecurityMetrics }
  | {
      readonly accepted: false;
      readonly reason: IpcPayloadSecurityFailureReason;
      readonly path: string;
      readonly metrics: IpcPayloadSecurityMetrics;
    };

export const DEFAULT_IPC_PAYLOAD_SECURITY_LIMITS: IpcPayloadSecurityLimits = Object.freeze({
  maxArgumentCount: 16,
  maxDepth: 20,
  maxNodes: 20_000,
  maxEstimatedBytes: 1_048_576,
  maxStringBytes: 262_144,
  maxArrayLength: 10_000,
  maxObjectKeys: 10_000
});

const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const textEncoder = new TextEncoder();
const encodedLength = (value: string): number => textEncoder.encode(value).byteLength;

interface PendingValue {
  readonly value: unknown;
  readonly path: string;
  readonly depth: number;
}

const mergeLimits = (overrides?: Partial<IpcPayloadSecurityLimits>): IpcPayloadSecurityLimits => {
  const limits = { ...DEFAULT_IPC_PAYLOAD_SECURITY_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`IPC payload security limit ${name} must be a positive safe integer.`);
    }
  }
  return limits;
};

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const evaluateIpcPayloadSecurity = (
  rawArguments: readonly unknown[],
  overrides?: Partial<IpcPayloadSecurityLimits>
): IpcPayloadSecurityDecision => {
  const limits = mergeLimits(overrides);
  let nodeCount = 0;
  let maximumDepth = 0;
  let estimatedBytes = 0;
  const metrics = (): IpcPayloadSecurityMetrics => ({
    argumentCount: rawArguments.length,
    nodeCount,
    maximumDepth,
    estimatedBytes
  });
  const reject = (reason: IpcPayloadSecurityFailureReason, path: string): IpcPayloadSecurityDecision => ({
    accepted: false,
    reason,
    path,
    metrics: metrics()
  });

  if (rawArguments.length > limits.maxArgumentCount) {
    return reject('TOO_MANY_ARGUMENTS', '$');
  }

  const pending: PendingValue[] = rawArguments.map((value, index) => ({
    value,
    path: `$[${index}]`,
    depth: 0
  }));
  const seenReferences = new WeakSet<object>();

  while (pending.length > 0) {
    const current = pending.pop()!;
    nodeCount += 1;
    maximumDepth = Math.max(maximumDepth, current.depth);
    if (nodeCount > limits.maxNodes) return reject('NODE_LIMIT_EXCEEDED', current.path);
    if (current.depth > limits.maxDepth) return reject('DEPTH_LIMIT_EXCEEDED', current.path);

    const value = current.value;
    if (value === null || value === undefined) {
      estimatedBytes += 4;
    } else if (typeof value === 'boolean') {
      estimatedBytes += value ? 4 : 5;
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) return reject('NON_FINITE_NUMBER_REJECTED', current.path);
      estimatedBytes += 16;
    } else if (typeof value === 'string') {
      const stringBytes = encodedLength(value);
      if (stringBytes > limits.maxStringBytes) return reject('STRING_LIMIT_EXCEEDED', current.path);
      estimatedBytes += stringBytes + 2;
    } else if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
      return reject('UNSUPPORTED_TYPE_REJECTED', current.path);
    } else if (typeof value === 'object') {
      if (seenReferences.has(value)) return reject('DUPLICATE_REFERENCE_REJECTED', current.path);
      seenReferences.add(value);

      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) {
          return reject('NON_PLAIN_OBJECT_REJECTED', current.path);
        }
        if (value.length > limits.maxArrayLength) return reject('ARRAY_LENGTH_EXCEEDED', current.path);
      } else if (!isPlainObject(value)) {
        return reject('NON_PLAIN_OBJECT_REJECTED', current.path);
      }

      const keys = Reflect.ownKeys(value).filter((key) => key !== 'length');
      if (keys.some((key) => typeof key === 'symbol')) return reject('SYMBOL_PROPERTY_REJECTED', current.path);
      if (keys.length > limits.maxObjectKeys) return reject('OBJECT_KEY_LIMIT_EXCEEDED', current.path);

      for (const keyValue of keys) {
        const key = keyValue as string;
        const childPath = Array.isArray(value) && /^\d+$/.test(key)
          ? `${current.path}[${key}]`
          : `${current.path}.${key}`;
        if (forbiddenKeys.has(key)) return reject('FORBIDDEN_KEY_REJECTED', childPath);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.get || descriptor.set || !('value' in descriptor)) {
          return reject('ACCESSOR_PROPERTY_REJECTED', childPath);
        }
        estimatedBytes += encodedLength(key) + 3;
        pending.push({ value: descriptor.value, path: childPath, depth: current.depth + 1 });
      }
      estimatedBytes += Array.isArray(value) ? 2 : 2;
    }

    if (estimatedBytes > limits.maxEstimatedBytes) {
      return reject('BYTE_LIMIT_EXCEEDED', current.path);
    }
  }

  return { accepted: true, metrics: metrics() };
};
