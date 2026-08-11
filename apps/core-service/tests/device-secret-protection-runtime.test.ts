import { describe, expect, it, vi } from 'vitest';
import { CoreServiceDeviceSecretProtectionError, CoreServiceDeviceSecretProtectionRuntime } from '../src/device-secret-protection-runtime.js';

const protector = (available: boolean) => ({
  protectionId: 'windows-dpapi-current-user-v1',
  required: true,
  isAvailable: vi.fn(() => available),
  protect: vi.fn((value: string) => `protected:${value}`),
  unprotect: vi.fn((value: string) => value.replace('protected:', ''))
});

describe('31-I Core Service device-secret protection prerequisite', () => {
  it('starts detached without exposing secret material or an Electron dependency', () => {
    const runtime = new CoreServiceDeviceSecretProtectionRuntime(() => '2026-08-10T23:00:00.000Z');
    expect(runtime.status()).toEqual({
      schemaVersion: 1,
      owner: 'detached',
      lifecycle: 'detached',
      providerId: null,
      required: false,
      available: false,
      secretMaterialExposed: false,
      electronDependency: false,
      reasons: ['DEVICE_SECRET_PROTECTOR_NOT_ATTACHED'],
      observedAt: '2026-08-10T23:00:00.000Z'
    });
  });

  it('reports ready only after an available headless protector is attached', () => {
    const runtime = new CoreServiceDeviceSecretProtectionRuntime(() => '2026-08-10T23:00:00.000Z');
    expect(runtime.attach(protector(true))).toMatchObject({
      owner: 'core-service', lifecycle: 'ready', providerId: 'windows-dpapi-current-user-v1', required: true,
      available: true, secretMaterialExposed: false, electronDependency: false
    });
  });

  it('fails closed when an attached provider is unavailable or throws', () => {
    const unavailable = new CoreServiceDeviceSecretProtectionRuntime();
    expect(unavailable.attach(protector(false))).toMatchObject({ owner: 'core-service', lifecycle: 'unavailable', available: false });
    const throwing = protector(true);
    throwing.isAvailable.mockImplementation(() => { throw new Error('probe failed'); });
    expect(new CoreServiceDeviceSecretProtectionRuntime().attach(throwing)).toMatchObject({ owner: 'core-service', lifecycle: 'unavailable', available: false });
  });

  it('rejects invalid or duplicate protector attachment', () => {
    const runtime = new CoreServiceDeviceSecretProtectionRuntime();
    expect(() => runtime.attach({ ...protector(true), protectionId: ' invalid ' })).toThrowError(
      expect.objectContaining<Partial<CoreServiceDeviceSecretProtectionError>>({ code: 'PROTECTOR_INVALID' })
    );
    runtime.attach(protector(true));
    expect(() => runtime.attach(protector(true))).toThrowError(
      expect.objectContaining<Partial<CoreServiceDeviceSecretProtectionError>>({ code: 'PROTECTOR_ALREADY_ATTACHED' })
    );
  });
});
